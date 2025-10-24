import { inflateRawSync, inflateSync } from 'node:zlib'
import WebSocket, { type RawData } from 'ws'

/** —— 信令 —— */
enum Sig {
	EVENT = 0,
	HELLO = 1,
	PING = 2,
	PONG = 3,
	RESUME = 4,
	RECONNECT = 5,
	RESUME_ACK = 6,
}

type HelloOk = { s: Sig.HELLO; d: { code: 0; session_id: string } }
type HelloFail = { s: Sig.HELLO; d: { code: number } }
type EventFrame = { s: Sig.EVENT; d: any; sn: number }
type PongFrame = { s: Sig.PONG }
type Reconnect = { s: Sig.RECONNECT; d?: { code?: number; err?: string } }
type ResumeAck = { s: Sig.RESUME_ACK; d: { session_id: string } }
type Frame = HelloOk | HelloFail | EventFrame | PongFrame | Reconnect | ResumeAck | any

export type GatewayState =
	| 'idle'
	| 'fetching_gateway'
	| 'connecting'
	| 'handshaking'
	| 'resuming'
	| 'online'
	| 'weak'
	| 'backoff'
	| 'closed'

type HeartbeatMode = 'strict' | 'lax'

/** —— 文档状态码策略 —— */
const HELLO_CODE = {
	40100: { name: '缺少参数', hint: 'retry_url' as const },
	40101: { name: '无效的 token', hint: 'fatal_token' as const },
	40102: { name: 'token 验证失败', hint: 'fatal_token' as const },
	40103: { name: 'token 过期', hint: 'token_refresh' as const },
} as const

const RECONNECT_CODE = {
	40106: { name: 'resume 缺少参数', clear: true },
	40107: { name: 'session 过期 / sn 无效', clear: true },
	40108: { name: 'sn 无效 / 不存在（resume 失败）', clear: true },
} as const

export interface KookGatewayClientOptions {
	getGatewayUrl: (p: {
		resume: 0 | 1
		sn?: number
		session_id?: string
		compress: 0 | 1
	}) => Promise<string>

	onEvent: (sn: number, data: any) => void
	onError?: (err: unknown) => void
	onFrame?: (f: Frame) => void
	onStateChange?: (prev: GatewayState, next: GatewayState, meta?: Record<string, any>) => void
	onDebug?: (e: { tag: string; data?: Record<string, any>; msg?: string }) => void

	/** 性能 & 调试 */
	compress?: 0 | 1 // 默认 1（省带宽）；调试可设 0
	heartbeatMode?: HeartbeatMode // 默认 'strict'

	heartbeatBaseMs?: number // 默认 30_000
	heartbeatJitterMs?: number // 默认 5_000
	pongTimeoutMs?: number // 默认 6_000
	firstConnectBackoffMs?: number[] // 默认 [2000, 4000]
	resumeBackoffMs?: number[] // 默认 [8000, 16000]
	maxGatewayBackoffMs?: number // 默认 60_000
	bufferMax?: number // 默认 10_000

	persistence?: {
		load: () => Promise<{ lastSn: number; sessionId?: string } | undefined>
		save: (d: { lastSn: number; sessionId: string | undefined }) => Promise<void>
		clear?: () => Promise<void>
	}
}

export interface Snapshot {
	state: GatewayState
	sessionId?: string
	lastSn: number
	buffered: number
	currentUrl?: string
	counters: {
		connectAttempts: number
		resumeAttempts: number
		pingSent: number
		pongRecv: number
		reconnectNotices: number
	}
	timers: {
		lastHelloAt?: number
		lastPingAt?: number
		lastPongAt?: number
		lastEventAt?: number
		currentBackoffMs?: number
	}
	lastError?: string
}

type Phase = 'awaitingHello' | 'awaitingResumeAck' | 'online'

export class KookGatewayClient {
	private readonly opt: Required<
		Omit<
			KookGatewayClientOptions,
			| 'persistence'
			| 'getGatewayUrl'
			| 'onEvent'
			| 'onError'
			| 'onFrame'
			| 'onStateChange'
			| 'onDebug'
		>
	> &
		Pick<
			KookGatewayClientOptions,
			| 'persistence'
			| 'getGatewayUrl'
			| 'onEvent'
			| 'onError'
			| 'onFrame'
			| 'onStateChange'
			| 'onDebug'
		>

	private ws?: WebSocket
	private state: GatewayState = 'idle'
	private running = false
	private connecting = false

	private lastSn = 0
	private sessionId?: string
	private currentUrl?: string

	private heartbeatTimer?: NodeJS.Timeout
	private pongTimer?: NodeJS.Timeout

	private buffer = new Map<number, EventFrame>()
	private gatewayBackoffMs = 1000

	private counters = {
		connectAttempts: 0,
		resumeAttempts: 0,
		pingSent: 0,
		pongRecv: 0,
		reconnectNotices: 0,
	}
	private marks: Snapshot['timers'] = {}
	private lastError?: string

	// 握手期：先挂监听，缓存早到帧，消灭竞态
	private phase: Phase = 'awaitingHello'
	private earlyFrames: Frame[] = []
	private helloResolve?: () => void
	private helloReject?: (e: Error) => void
	private helloTimer?: NodeJS.Timeout

	private resumeAckResolve?: () => void
	private resumeAckReject?: (e: Error) => void
	private resumeAckTimer?: NodeJS.Timeout

	private hbMode: HeartbeatMode

	constructor(options: KookGatewayClientOptions) {
		this.opt = {
			compress: options.compress ?? 1, // 性能优先
			heartbeatMode: options.heartbeatMode ?? 'strict',
			heartbeatBaseMs: options.heartbeatBaseMs ?? 30_000,
			heartbeatJitterMs: options.heartbeatJitterMs ?? 5_000,
			pongTimeoutMs: options.pongTimeoutMs ?? 6_000,
			firstConnectBackoffMs: options.firstConnectBackoffMs ?? [2000, 4000],
			resumeBackoffMs: options.resumeBackoffMs ?? [8000, 16000],
			maxGatewayBackoffMs: options.maxGatewayBackoffMs ?? 60_000,
			bufferMax: options.bufferMax ?? 10_000,
			getGatewayUrl: options.getGatewayUrl,
			onEvent: options.onEvent,
			onError: options.onError,
			onFrame: options.onFrame,
			onStateChange: options.onStateChange,
			onDebug: options.onDebug,
			persistence: options.persistence,
		}
		this.hbMode = this.opt.heartbeatMode
	}

	/** 动态切换心跳模式（严格/宽松） */
	setHeartbeatMode(mode: HeartbeatMode) {
		this.hbMode = mode
	}

	// —— 观测 —— //
	getStatus(): GatewayState {
		return this.state
	}
	getSnapshot(): Snapshot {
		return {
			state: this.state,
			sessionId: this.sessionId,
			lastSn: this.lastSn,
			buffered: this.buffer.size,
			currentUrl: this.currentUrl,
			counters: { ...this.counters },
			timers: { ...this.marks, currentBackoffMs: this.gatewayBackoffMs },
			lastError: this.lastError,
		}
	}

	// —— 启停 —— //
	async start(): Promise<void> {
		if (this.running) return
		this.running = true
		try {
			const x = await this.opt.persistence?.load?.()
			if (x) {
				this.lastSn = x.lastSn ?? 0
				this.sessionId = x.sessionId
			}
		} catch {}

		while (this.running) {
			if (await this.tryResumeFlow()) continue
			await this.fullConnectFlow()
		}
	}

	async stop(): Promise<void> {
		this.running = false
		this.emitState('closed', { reason: 'stop()' })
		this.clearTimers()
		try {
			this.ws?.close()
		} catch {}
		this.ws = undefined
	}

	send(data: any) {
		const s = this.ws
		if (!s || s.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not open')
		s.send(typeof data === 'string' ? data : JSON.stringify(data))
	}

	reconnectSoft(): void {
		if (!this.running) {
			void this.start()
			return
		}
		try {
			this.ws?.close()
		} catch {}
	}

	async reconnectHard(dropPersistence = true): Promise<void> {
		this.buffer.clear()
		this.lastSn = 0
		this.sessionId = undefined
		if (dropPersistence) {
			try {
				await this.opt.persistence?.clear?.()
			} catch {}
		}
		if (!this.running) {
			void this.start()
			return
		}
		try {
			this.ws?.close()
		} catch {}
	}

	// —— 内部流程 —— //
	private async fullConnectFlow(): Promise<void> {
		const url = await this.fetchGatewayLoop({ resume: 0 })
		if (!this.running) return

		for (;;) {
			const ok = await this.tryConnect(url, false)
			if (ok) return

			for (const ms of this.opt.firstConnectBackoffMs) {
				await this.backoff(ms, { stage: 'firstConnect', ms })
				if (!this.running) return
				const ok2 = await this.tryConnect(url, false)
				if (ok2) return
			}
			const newUrl = await this.fetchGatewayLoop({ resume: 0 })
			if (!this.running) return
			return await this.fullConnectFlow()
		}
	}

	private async tryResumeFlow(): Promise<boolean> {
		if (!this.sessionId) return false
		for (const ms of this.opt.resumeBackoffMs) {
			this.counters.resumeAttempts++
			const url = await this.fetchGatewayLoop({
				resume: 1,
				sn: this.lastSn,
				session_id: this.sessionId,
			})
			if (!this.running) return true
			const ok = await this.tryConnect(url, true)
			if (ok) return true
			await this.backoff(ms, { stage: 'resume', ms })
		}
		this.sessionId = undefined
		return false
	}

	private async fetchGatewayLoop(p: {
		resume: 0 | 1
		sn?: number
		session_id?: string
	}): Promise<string> {
		this.emitState('fetching_gateway', {
			resume: p.resume,
			sn: p.sn,
			session_id: !!p.session_id,
		})
		let delay = Math.min(this.gatewayBackoffMs, this.opt.maxGatewayBackoffMs)
		for (;;) {
			try {
				const url = await this.opt.getGatewayUrl({
					...p,
					compress: this.opt.compress,
				})
				this.currentUrl = url
				this.gatewayBackoffMs = 1000
				this.debug('gateway.ok', { resume: p.resume, url })
				return url
			} catch (err) {
				this.recordError(err, 'gateway.fail')
				if (!this.running) throw err
				this.emitState('backoff', { reason: 'gateway.fail', delay })
				await this.sleep(delay)
				delay = Math.min(delay * 2, this.opt.maxGatewayBackoffMs)
				this.gatewayBackoffMs = delay
			}
		}
	}

	/** —— 连接：统一监听先行；HELLO →（可选）RESUME → ONLINE —— */
	private async tryConnect(url: string, resumed: boolean): Promise<boolean> {
		if (!this.running) return false
		this.emitState(resumed ? 'resuming' : 'connecting', { url })
		if (this.connecting) return false
		this.connecting = true
		this.counters.connectAttempts++

		try {
			const ws = new WebSocket(url, { perMessageDeflate: false })
			this.ws = ws
			this.emitState('handshaking', { url })

			// 统一监听先挂，避免竞态丢帧
			ws.on('message', this.onMessage)
			ws.on('close', (code, reason) => this.onClose(code, reason))
			ws.on('error', (e) => this.opt.onError?.(e))
			ws.on('pong', () => {
				// 控制帧 PONG
				this.counters.pongRecv++
				this.marks.lastPongAt = Date.now()
				this.debug('pong.ws')
				if (this.hbMode === 'strict' && this.state === 'weak')
					this.emitState('online', { probe: true, wsLevel: true })
				if (this.pongTimer) {
					clearTimeout(this.pongTimer)
					this.pongTimer = undefined
				}
			})

			// 等 HELLO（由 onMessage 解析）
			this.phase = 'awaitingHello'
			const helloPromise = new Promise<void>((resolve, reject) => {
				this.helloResolve = resolve
				this.helloReject = reject
				const t = setTimeout(() => reject(new Error('HELLO timeout')), 6000)
				;(t as any).unref?.()
				this.helloTimer = t
			})
			await helloPromise

			// 回放 HELLO 前缓存帧
			if (this.earlyFrames.length) {
				const list = this.earlyFrames
				this.earlyFrames = []
				for (const fr of list) this.processFrame(fr)
			}

			// 恢复握手
			if (resumed) {
				this.phase = 'awaitingResumeAck'
				const ackPromise = new Promise<void>((resolve, reject) => {
					this.resumeAckResolve = resolve
					this.resumeAckReject = reject
					const t = setTimeout(() => reject(new Error('RESUME ack timeout')), 6000)
					;(t as any).unref?.()
					this.resumeAckTimer = t
				})
				ws.send(JSON.stringify({ s: Sig.RESUME, sn: this.lastSn }))
				this.debug('resume.send', { sn: this.lastSn })
				await ackPromise
			}

			this.phase = 'online'
			this.emitState('online', { resumed })

			// 首发 PING（链式定时）
			this.scheduleNextHeartbeat(0) // 立刻发一次

			await new Promise<void>((r) => ws.once('close', r))
			return true
		} catch (err) {
			this.recordError(err, 'connect.fail', { url, resumed })
			return false
		} finally {
			this.connecting = false
			this.clearTimers()
			this.ws = undefined
			this.helloResolve = this.helloReject = undefined
			this.resumeAckResolve = this.resumeAckReject = undefined
			this.phase = 'awaitingHello'
			this.earlyFrames = []
		}
	}

	// —— 统一 message 入口 —— //
	private onMessage = (raw: RawData) => {
		const f = this.decode(raw)
		if (!f) return
		this.opt.onFrame?.(f)

		if (this.phase === 'awaitingHello') {
			if (f.s === Sig.HELLO) {
				if (this.helloTimer) {
					clearTimeout(this.helloTimer)
					this.helloTimer = undefined
				}
				this.marks.lastHelloAt = Date.now()
				const code = f?.d?.code
				if (code === 0 && typeof f?.d?.session_id === 'string') {
					this.sessionId = f.d.session_id
					void this.persist()
					this.debug('hello.ok', { sessionId: this.sessionId })
					this.helloResolve?.()
				} else {
					const entry = HELLO_CODE[code as keyof typeof HELLO_CODE]
					if (entry && (entry.hint === 'token_refresh' || entry.hint === 'fatal_token'))
						this.sessionId = undefined
					this.helloReject?.(new Error(`HELLO failed: ${entry?.name ?? `code=${code}`}`))
				}
			} else {
				this.earlyFrames.push(f)
			}
			return
		}

		if (this.phase === 'awaitingResumeAck' && f.s === Sig.RESUME_ACK) {
			if (typeof f?.d?.session_id === 'string') {
				this.sessionId = f.d.session_id
				void this.persist()
			}
			if (this.resumeAckTimer) {
				clearTimeout(this.resumeAckTimer)
				this.resumeAckTimer = undefined
			}
			this.debug('resume.ack', { sessionId: this.sessionId })
			this.resumeAckResolve?.()
			return
		}

		this.processFrame(f)
	}

	private processFrame(f: Frame) {
		switch (f.s) {
			case Sig.PONG: {
				this.counters.pongRecv++
				this.marks.lastPongAt = Date.now()
				this.debug('pong.payload')
				if (this.hbMode === 'strict' && this.state === 'weak')
					this.emitState('online', { probe: true })
				if (this.pongTimer) {
					clearTimeout(this.pongTimer)
					this.pongTimer = undefined
				}
				return
			}
			case Sig.RECONNECT: {
				this.counters.reconnectNotices++
				const code = f?.d?.code as keyof typeof RECONNECT_CODE | undefined
				const action = code ? RECONNECT_CODE[code] : undefined
				this.debug('reconnect.notice', {
					code,
					info: action?.name,
					err: f?.d?.err,
				})
				this.buffer.clear()
				this.lastSn = 0
				this.sessionId = undefined
				if (action?.clear) void this.opt.persistence?.clear?.().catch(() => {})
				try {
					this.ws?.close()
				} catch {}
				return
			}
			case Sig.EVENT: {
				this.handleEventOrdered(f as EventFrame)
				return
			}
			default:
				return
		}
	}

	private onClose = (code: number, reasonBuf: Buffer) => {
		const reason = reasonBuf?.toString?.() || ''
		this.clearTimers()
		this.emitState('closed', { code, reason })
		this.debug('ws.close', { code, reason })
	}

	// —— 有序消费 —— //
	private handleEventOrdered(ev: EventFrame) {
		const sn = ev.sn
		if (typeof sn !== 'number') return
		if (sn <= this.lastSn) return
		const expected = this.lastSn + 1
		if (sn !== expected) {
			this.buffer.set(sn, ev)
			if (this.buffer.size > this.opt.bufferMax) {
				this.debug('buffer.highWater', { size: this.buffer.size })
				this.reconnectSoft()
			}
			return
		}
		this.consume(ev)
		for (let next = this.lastSn + 1; ; next = this.lastSn + 1) {
			const f = this.buffer.get(next)
			if (!f) break
			this.buffer.delete(next)
			this.consume(f)
		}
	}
	private consume(ev: EventFrame) {
		this.lastSn = ev.sn
		this.marks.lastEventAt = Date.now()
		void this.persist()
		this.opt.onEvent(ev.sn, ev.d)
	}

	// —— 心跳（严格/宽松二选一；严格下支持 weak + 快速探测）—— //
	private scheduleNextHeartbeat(delayMs?: number) {
		if (this.heartbeatTimer) {
			clearTimeout(this.heartbeatTimer)
			this.heartbeatTimer = undefined
		}
		const jitter = (Math.random() * 2 - 1) * this.opt.heartbeatJitterMs
		const base = delayMs ?? Math.max(1000, this.opt.heartbeatBaseMs + jitter)
		const t = setTimeout(() => this.sendPing(), base)
		;(t as any).unref?.()
		this.heartbeatTimer = t
	}

	private sendPing() {
		const s = this.ws
		if (!s || s.readyState !== WebSocket.OPEN) return
		s.send(JSON.stringify({ s: Sig.PING, sn: this.lastSn }))
		this.counters.pingSent++
		this.marks.lastPingAt = Date.now()
		this.debug('ping', { sn: this.lastSn })

		// 宽松模式：只链式下一轮；严格模式：同时启动 PONG 超时观察
		if (this.hbMode === 'strict') {
			if (this.pongTimer) {
				clearTimeout(this.pongTimer)
				this.pongTimer = undefined
			}
			const p = setTimeout(() => this.onPongTimeout(), this.opt.pongTimeoutMs)
			;(p as any).unref?.()
			this.pongTimer = p
		}
		this.scheduleNextHeartbeat()
	}

	private async onPongTimeout() {
		// 严格模式才触发 weak + 探测
		if (this.hbMode !== 'strict') return
		this.emitState('weak', { reason: 'pong.timeout' })
		// 两次快速探测（2s、4s）
		for (const ms of [2000, 4000]) {
			const ok = await this.waitPong(this.opt.pongTimeoutMs)
			if (ok) {
				this.emitState('online', { probe: true })
				return
			}
			await this.sleep(ms)
			const s = this.ws
			if (!s || s.readyState !== WebSocket.OPEN) break
			s.send(JSON.stringify({ s: Sig.PING, sn: this.lastSn }))
			this.debug('probe.ping', { wait: this.opt.pongTimeoutMs })
		}
		try {
			this.ws?.close()
		} catch {}
	}

	private waitPong(ms: number): Promise<boolean> {
		return new Promise((resolve) => {
			let done = false
			const handler = (raw: RawData) => {
				const f = this.decode(raw)
				if (f?.s === Sig.PONG && !done) {
					done = true
					cleanup()
					resolve(true)
				}
			}
			const cleanup = () => {
				this.ws?.off('message', handler as any)
			}
			this.ws?.on('message', handler as any)
			const t = setTimeout(() => {
				if (!done) {
					cleanup()
					resolve(false)
				}
			}, ms)
			;(t as any).unref?.()
		})
	}

	// —— 解码（文本优先 → zlib/raw → 文本兜底；尽量少分配）—— //
	private decode(raw: RawData): Frame | null {
		try {
			if (typeof raw === 'string') return this.parseJsonLike(raw)

			const buf = Buffer.isBuffer(raw)
				? raw
				: Array.isArray(raw)
					? Buffer.concat(raw as Buffer[])
					: Buffer.from(raw as ArrayBuffer)

			if (buf.length === 0) return null

			// 尝试直接按文本（一次 toString）
			const s1 = buf.toString('utf8').trim()
			if (s1) {
				const j = this.tryParseJsonLike(s1)
				if (j) return j
			}

			// zlib 头判定：0x78 01/5E/9C/DA
			const z =
				buf[0] === 0x78 &&
				(buf[1] === 0x01 || buf[1] === 0x5e || buf[1] === 0x9c || buf[1] === 0xda)
			if (z) {
				const out = inflateSync(buf)
				const s = out.toString('utf8').trim()
				const j = this.tryParseJsonLike(s)
				if (j) return j
			} else {
				try {
					const out = inflateRawSync(buf)
					const s = out.toString('utf8').trim()
					const j = this.tryParseJsonLike(s)
					if (j) return j
				} catch {
					// 兜底：再尝试文本一次（某些代理可能改首字节）
					const s = buf.toString('utf8').trim()
					const j = this.tryParseJsonLike(s)
					if (j) return j
				}
			}
			this.debug('decode.fail', { len: buf.length })
			return null
		} catch {
			this.debug('decode.fail', { reason: 'exception' })
			return null
		}
	}

	private parseJsonLike(s: string): Frame | null {
		const t = s.trim()
		if (!t) return null
		if (t === '3') return { s: Sig.PONG } // 纯数字 PONG 兼容
		try {
			const obj = JSON.parse(t)
			if (obj && obj.op != null && obj.s == null) obj.s = obj.op // 兼容 op→s
			return obj
		} catch {
			return null
		}
	}
	private tryParseJsonLike(s: string): Frame | null {
		return this.parseJsonLike(s)
	}

	// —— 持久化/状态/工具 —— //
	private async persist() {
		try {
			await this.opt.persistence?.save?.({
				lastSn: this.lastSn,
				sessionId: this.sessionId,
			})
		} catch {}
	}
	private emitState(next: GatewayState, meta?: Record<string, any>) {
		const prev = this.state
		this.state = next
		this.opt.onStateChange?.(prev, next, meta)
	}
	private debug(tag: string, data?: Record<string, any>, msg?: string) {
		this.opt.onDebug?.({ tag, data, msg })
	}
	private recordError(err: any, tag: string, extra?: Record<string, any>) {
		const msg = err instanceof Error ? err.message : String(err)
		this.lastError = msg
		this.debug(tag, { ...extra, error: msg })
		this.opt.onError?.(err)
	}
	private clearTimers() {
		if (this.helloTimer) {
			clearTimeout(this.helloTimer)
			this.helloTimer = undefined
		}
		if (this.resumeAckTimer) {
			clearTimeout(this.resumeAckTimer)
			this.resumeAckTimer = undefined
		}
		if (this.heartbeatTimer) {
			clearTimeout(this.heartbeatTimer)
			this.heartbeatTimer = undefined
		}
		if (this.pongTimer) {
			clearTimeout(this.pongTimer)
			this.pongTimer = undefined
		}
	}
	private async backoff(ms: number, meta?: Record<string, any>) {
		this.emitState('backoff', meta ?? { ms })
		await this.sleep(ms)
	}
	private sleep(ms: number) {
		return new Promise<void>((r) => {
			const t = setTimeout(r, ms)
			;(t as any).unref?.()
		})
	}
}
