import { BasePlugin, Plugin } from '@pluxel/hmr'
// biome-ignore lint/style/useImportType: <explanation>
import { Rates } from './rates'

@Plugin({ name: 'test', type: 'hook' })
export class Test extends BasePlugin {
	constructor(private ratesService: Rates) {
		super()
	}
	async init() {
		console.log('aaaa')
		const rates = this.ratesService
		// 例如：按 “资源类型/资源ID/动作/主体ID” 组合 key 维度
		// e.g. rate on: API: /comments -> create -> actor: 123

		// 固定冷却：同一主体对同一动作 2s 一次
		const cd = await rates.guard({
			type: 'cooldown',
			parts: ['api', 'comments', 'create', 123],
			ttlMs: 2000,
		})
		if (!cd.ok) console.log(`冷却中，请 ${Math.ceil(cd.retryAfterMs / 1000)} 秒后再试`)

		// 滑动窗口：60s 内最多 20 次（更公平）
		const sw = await rates.guard({
			type: 'sliding',
			parts: ['api', 'comments', 'create', 123],
			windowMs: 60_000,
			limit: 20,
		})
		if (!sw.ok) console.log(`太快啦，约 ${Math.ceil(sw.retryAfterMs / 1000)} 秒后再试`)

		// 令牌桶：容量 40，匀速 10/s，每次耗 1 token（弹性更好）
		const tb = await rates.guard({
			type: 'token',
			parts: ['api', 'comments', 'create', 123],
			cap: 40,
			refillPerSec: 10,
		})
		if (!tb.ok) console.log(`拥挤中，${Math.ceil(tb.retryAfterMs / 1000)} 秒后重试`)
		console.log(cd, sw, tb)
	}

	doSomething(): void {
		// console.log(this.ctx.caller, 'call from')
		console.log('PluginB doing something...')
	}
}
