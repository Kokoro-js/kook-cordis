import { BasePlugin, Config, Plugin, v } from '@pluxel/hmr'
// biome-ignore lint/style/useImportType: <explanation>
import { RedisPlugin } from './redis_plugin'

/** —— 配置（通用前缀 + 合理默认） —— */
const RatesConfig = v.object({
	/** Redis key 前缀命名空间 */
	namespace: v.optional(v.string(), 'rates'),
})
export type RatesConfig = v.InferOutput<typeof RatesConfig>

@Plugin({ name: 'Rates' })
export class Rates extends BasePlugin {
	@Config(RatesConfig)
	private config!: RatesConfig

	constructor(private redis: RedisPlugin) {
		super()
	}

	/** —— 脚本仓（文本与 SHA） —— */
	private sha = {
		cooldown: '' as string, // 固定冷却（SET NX + TTL 原子化）
		fixed: '' as string, // 固定窗口（INCR + 初次 EXPIRE）
		sliding: '' as string, // 滑动窗口（ZSET）
		token: '' as string, // 令牌桶（HASH: tokens/ts）
	}

	/** 统一 key 生成：<ns>:<kind>:<...parts> */
	private key(kind: string, ...parts: (string | number)[]) {
		return `${this.config.namespace}:${kind}:${parts.join(':')}`
	}

	/** ————————————————— 生命周期 ————————————————— */
	async init() {
		// 1) 固定冷却：成功->1；冷却中->返回负的剩余毫秒
		const cooldownLua = `
      -- KEYS[1]=key, ARGV[1]=ttlMs
      local ok = redis.call('SET', KEYS[1], '1', 'PX', ARGV[1], 'NX')
      if ok then return 1 end
      local ms = redis.call('PTTL', KEYS[1])
      if ms < 0 then ms = 0 end
      return 0 - ms
    `
		// 2) 固定窗口：periodSec 内最多 limit 次。返回剩余（可为负）
		const fixedLua = `
      -- KEYS[1]=key, ARGV[1]=limit, ARGV[2]=periodSec
      local limit = tonumber(ARGV[1])
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) end
      return limit - count
    `
		// 3) 滑动窗口：窗口更公平。返回 >=0 剩余；<0 为需等待毫秒
		const slidingLua = `
      -- KEYS[1]=zkey, ARGV[1]=winMs, ARGV[2]=limit
      local win = tonumber(ARGV[1])
      local lim = tonumber(ARGV[2])
      local t = redis.call('TIME')     -- {sec, usec}
      local now = t[1]*1000 + math.floor(t[2]/1000)

      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - win)
      local n = redis.call('ZCARD', KEYS[1])
      if n < lim then
        redis.call('ZADD', KEYS[1], now, now)
        redis.call('PEXPIRE', KEYS[1], win)
        return lim - n - 1
      else
        local pair = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        local oldest = pair[2] or now
        local retry = oldest + win - now
        if retry < 0 then retry = 0 end
        return 0 - retry
      end
    `
		// 4) 令牌桶：cap 容量；refill 每秒补充；cost 每次消耗
		const tokenLua = `
      -- KEYS[1]=hkey, ARGV[1]=cap, ARGV[2]=refillPerSec, ARGV[3]=cost
      local cap = tonumber(ARGV[1])
      local refill = tonumber(ARGV[2])
      local cost = tonumber(ARGV[3])

      local t = redis.call('TIME') -- server clock
      local now = t[1]*1000 + math.floor(t[2]/1000)

      local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
      local tokens = tonumber(data[1]) or cap
      local last = tonumber(data[2]) or now

      if now > last then
        local add = (now - last) * refill / 1000.0
        tokens = math.min(cap, tokens + add)
      end

      if tokens >= cost then
        tokens = tokens - cost
        redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
        -- 过期设成“不用就回收”，大约一个窗口大小
        local ttl = math.ceil( math.max(1000, cap/refill*1000) )
        redis.call('PEXPIRE', KEYS[1], ttl)
        return math.floor(tokens)  -- 返回剩余（向下取整）
      else
        local need = cost - tokens
        local waitMs = math.ceil(need / refill * 1000.0)
        redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
        return 0 - waitMs
      end
    `

		await this.redis.use(async (c) => {
			this.sha.cooldown = await c.scriptLoad(cooldownLua)
			this.sha.fixed = await c.scriptLoad(fixedLua)
			this.sha.sliding = await c.scriptLoad(slidingLua)
			this.sha.token = await c.scriptLoad(tokenLua)
		})
		this.ctx.logger.info('[Rates] scripts loaded')
	}

	async stop() {
		this.ctx.logger.info('[Rates] stopped')
	}

	/** ————————————————— 原语：不绑业务维度，只收 keyParts ————————————————— */

	/** 固定冷却：允许 -> {ok:true}；冷却中 -> {ok:false, retryAfterMs} */
	async guardCooldown(parts: (string | number)[], ttlMs: number) {
		const k = this.key('cool', ...parts)
		const r = await this.evalWithReload<number>(
			(c) => c.evalSha(this.sha.cooldown, { keys: [k], arguments: [String(ttlMs)] }),
			'cooldown',
		)
		if (r === 1) return { ok: true as const }
		return { ok: false as const, retryAfterMs: Math.max(0, -Number(r)) }
	}

	/** 固定窗口：periodSec 内 limit 次。返回剩余；<0 表示已超限 */
	async consumeFixed(parts: (string | number)[], periodSec: number, limit: number) {
		const k = this.key('fixed', ...parts)
		const left = await this.evalWithReload<number>(
			(c) =>
				c.evalSha(this.sha.fixed, {
					keys: [k],
					arguments: [String(limit), String(periodSec)],
				}),
			'fixed',
		)
		return Number(left)
	}

	/** 滑动窗口：windowMs 内 limit 次。>=0 剩余；<0 需等待毫秒 */
	async consumeSliding(parts: (string | number)[], windowMs: number, limit: number) {
		const k = this.key('slide', ...parts)
		const ret = await this.evalWithReload<number>(
			(c) =>
				c.evalSha(this.sha.sliding, {
					keys: [k],
					arguments: [String(windowMs), String(limit)],
				}),
			'sliding',
		)
		return Number(ret)
	}

	/** 令牌桶：cap 容量，refill 每秒补充，cost 每次消耗。>=0 剩余；<0 需等待毫秒 */
	async consumeToken(parts: (string | number)[], cap: number, refillPerSec: number, cost = 1) {
		const k = this.key('token', ...parts)
		const ret = await this.evalWithReload<number>(
			(c) =>
				c.evalSha(this.sha.token, {
					keys: [k],
					arguments: [String(cap), String(refillPerSec), String(cost)],
				}),
			'token',
		)
		return Number(ret)
	}

	/** 统一守卫：策略抽象，返回结构化结果 */
	async guard(
		opts:
			| { type: 'cooldown'; parts: (string | number)[]; ttlMs: number }
			| {
					type: 'fixed'
					parts: (string | number)[]
					periodSec: number
					limit: number
			  }
			| {
					type: 'sliding'
					parts: (string | number)[]
					windowMs: number
					limit: number
			  }
			| {
					type: 'token'
					parts: (string | number)[]
					cap: number
					refillPerSec: number
					cost?: number
			  },
	): Promise<
		{ ok: true; remaining?: number } | { ok: false; retryAfterMs: number; remaining?: number }
	> {
		switch (opts.type) {
			case 'cooldown': {
				const r = await this.guardCooldown(opts.parts, opts.ttlMs)
				return r.ok ? r : { ok: false, retryAfterMs: r.retryAfterMs }
			}
			case 'fixed': {
				const left = await this.consumeFixed(opts.parts, opts.periodSec, opts.limit)
				if (left < 0) {
					// 固窗只能粗略估计回退时间，用 TTL 不是原子；如需准确请改用滑窗/令牌桶
					return { ok: false, retryAfterMs: 0, remaining: left }
				}
				return { ok: true, remaining: left }
			}
			case 'sliding': {
				const r = await this.consumeSliding(opts.parts, opts.windowMs, opts.limit)
				return r >= 0 ? { ok: true, remaining: r } : { ok: false, retryAfterMs: -r }
			}
			case 'token': {
				const r = await this.consumeToken(opts.parts, opts.cap, opts.refillPerSec, opts.cost ?? 1)
				return r >= 0 ? { ok: true, remaining: r } : { ok: false, retryAfterMs: -r }
			}
		}
	}

	/** —————————————— 工具：遇 NOSCRIPT 时自动重载一次 —————————————— */
	private async evalWithReload<T>(
		run: (c: any) => Promise<T>,
		which: keyof Rates['sha'],
	): Promise<T> {
		try {
			return await this.redis.use(run)
		} catch (e: any) {
			const msg = String(e?.message || e)
			if (!msg.includes('NOSCRIPT')) throw e
			this.ctx.logger.info(`[Rates] ${which}: NOSCRIPT -> reload`)
			// 重新加载脚本
			await this.init() // 简洁处理：小规模项目可直接重载四个脚本
			return await this.redis.use(run)
		}
	}

	/** —— 便捷 key 生成（调用方按需组合） —— */
	makeKey(kind: 'cool' | 'fixed' | 'slide' | 'token', ...parts: (string | number)[]) {
		return this.key(kind, ...parts)
	}
}
