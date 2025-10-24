import { BasePlugin, Config, Plugin, v } from '@pluxel/hmr'
import { createClient } from 'redis'

/** —— 配置：只保留核心项 —— */
const RedisConfig = v.object({
	url: v.string(), // redis://user:pass@host:port/db
	lazy: v.optional(v.boolean(), false), // init() 时连接；true 则首次 use() 再连
	pingOnStart: v.optional(v.boolean(), true),
})
export type RedisPluginConfig = Config<typeof RedisConfig>
type RedisClientType = ReturnType<typeof createClient>

@Plugin({ name: 'Redis' })
export class RedisPlugin extends BasePlugin {
	@Config(RedisConfig)
	private config!: RedisPluginConfig

	private client: RedisClientType | null = null

	/** 直接访问底层 client；若还未连接会抛错 */
	get redis(): RedisClientType {
		if (!this.client) throw new Error('[Redis] client not connected')
		return this.client
	}

	/** 初始化：默认立刻连接 */
	override async init(abort: AbortSignal): Promise<void> {
		if (!this.config.lazy) {
			await this.connect()
		}
	}

	/** 停止：优雅退出，失败则强制断开 */
	async stop() {
		const c = this.client
		this.client = null
		if (!c) return
		try {
			await c.quit()
			this.ctx.logger.info('[Redis] quit ok')
		} catch (err) {
			this.ctx.logger.info('[Redis] quit failed, fallback to disconnect')
			try {
				c.disconnect()
			} catch {}
			this.ctx.logger.error(err)
		}
	}

	/** 便捷调用：确保连接后执行回调 */
	async use<T>(fn: (c: RedisClientType) => Promise<T> | T): Promise<T> {
		await this.connect()
		return await fn(this.redis)
	}

	/** 连接（幂等）：已连则直接返回 */
	private async connect() {
		if (this.client?.isReady) return
		if (!this.client) {
			const c = createClient({ url: this.config.url })
			// —— 事件日志 —— //
			c.on('ready', () => this.ctx.logger.info('[Redis] ready'))
			c.on('end', () => this.ctx.logger.info('[Redis] end'))
			c.on('reconnecting', () => this.ctx.logger.info('[Redis] reconnecting'))
			c.on('error', (e) => this.ctx.logger.error(e))
			this.client = c
		}
		if (!this.client.isReady) {
			await this.client.connect()
			if (this.config.pingOnStart) {
				try {
					await this.client.ping()
				} catch (e) {
					this.ctx.logger.error(e)
				}
			}
		}
	}
}
