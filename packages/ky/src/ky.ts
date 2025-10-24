// KyPlugin.ts

import { BasePlugin, Config, Plugin, v } from '@pluxel/hmr'
import ky, { HTTPError, type KyInstance, type Options } from 'ky'

export type * from 'ky'

/** —— 1) 核心 —— */
const CoreCfg = v.object({
	baseURL: v.optional(v.string(), ''), // 统一前缀
	timeout: v.optional(v.number(), 10_000), // ms
	throwHttpErrors: v.optional(v.boolean(), true),
})

/** —— 2) 重试 —— */
const RetryCfg = v.object({
	limit: v.optional(v.number(), 2), // 简单且够用
})

/** —— 3) 头信息（常见默认即可） —— */
const HeadersCfg = v.object({
	headers: v.optional(v.record(v.string(), v.string()), {
		accept: 'application/json',
		'user-agent': 'pluxel-ky/1',
	}),
})

/** —— 4) 代理（最常用的三个开关） —— */
const ProxyCfg = v.object({
	enabled: v.optional(v.boolean(), false),
	url: v.optional(v.string()), // e.g. http://127.0.0.1:8080
	applyGlobalDispatcher: v.optional(v.boolean(), true), // 是否改全局 fetch
})

@Plugin({ name: 'Ky', type: 'service' })
export class KyPlugin extends BasePlugin {
	@Config(CoreCfg) private core!: v.InferOutput<typeof CoreCfg>
	@Config(RetryCfg) private retry!: v.InferOutput<typeof RetryCfg>
	@Config(HeadersCfg) private header!: v.InferOutput<typeof HeadersCfg>
	@Config(ProxyCfg) private proxy!: v.InferOutput<typeof ProxyCfg>

	/** 共享实例：其他插件直接用它 */
	public client!: KyInstance

	// Node: 保存/恢复全局 dispatcher
	private _prevDispatcher: unknown | undefined
	private _appliedGlobal = false

	async init(_abort: AbortSignal): Promise<void> {
		const isNode = typeof process !== 'undefined' && !!(process as any).versions?.node

		// —— 代理（Node 下可选）——
		if (isNode && this.proxy.enabled) {
			try {
				const undici = (await import('undici')) as any
				const { ProxyAgent, Agent, getGlobalDispatcher, setGlobalDispatcher } = undici

				const dispatcher = this.proxy.url
					? new ProxyAgent({ uri: this.proxy.url })
					: new Agent({ keepAlive: true })

				if (this.proxy.applyGlobalDispatcher) {
					this._prevDispatcher = getGlobalDispatcher?.()
					setGlobalDispatcher?.(dispatcher)
					this._appliedGlobal = true
					this.ctx.logger.info('Ky: global dispatcher applied')
				} else {
					this.ctx.logger.info('Ky: dispatcher created (not global)')
				}
			} catch (e) {
				this.ctx.logger.warn('Ky: undici unavailable, skip proxy', e)
			}
		}

		// —— ky 实例 ——（只用最常见项）
		this.client = ky.create({
			prefixUrl: this.core.baseURL || undefined,
			timeout: this.core.timeout,
			throwHttpErrors: this.core.throwHttpErrors,
			headers: this.header.headers,
			retry: { limit: this.retry.limit },
			hooks: {
				beforeError: [
					async (err) => {
						if (err instanceof HTTPError) {
							const res = err.response
							let body = ''
							try {
								body = await res.text()
							} catch {}
							this.ctx.logger.error('HTTP', {
								url: res.url,
								status: res.status,
								body: body.slice(0, 2048),
							})
						} else {
							this.ctx.logger.error('HTTP', { message: err.message })
						}
						return err
					},
				],
			},
		})

		this.ctx.logger.info('KyPlugin initialized')
	}

	async stop(_abort: AbortSignal): Promise<void> {
		if (this._appliedGlobal) {
			try {
				const undici = (await import('undici')) as any
				undici.setGlobalDispatcher?.(this._prevDispatcher ?? undici.getGlobalDispatcher?.())
				this.ctx.logger.info('Ky: global dispatcher restored')
			} catch {}
		}
	}

	/** 小工具：需要临时不同前缀/头时派生一个客户端 */
	createClient(overrides: Options): KyInstance {
		return this.client.extend(overrides)
	}

	/** 小工具：直接取 JSON（带类型） */
	getJSON<T>(url: string, opts?: Options) {
		return this.client.get(url, opts).json<T>()
	}
}
