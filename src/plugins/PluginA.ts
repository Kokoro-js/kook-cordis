import { BasePlugin, Config, f, Optional, Plugin, v } from '@pluxel/hmr'
// PluginA.ts
// PluginA 依赖 PluginB 为必选依赖，依赖 PluginC 为可选依赖
// biome-ignore lint/style/useImportType: <PluginSystem>
import { PluginB } from './PluginB'
// biome-ignore lint/style/useImportType: <PluginSystem>
import { PluginC } from './PluginC'

const test = v.object({
		id: v.pipe(
			v.number(),
			
					f.numberMeta({
						type: 'slider',
						options: {
							min: 0,
							max: 100,
							step: 5,
							marks: [
								{ value: 0, label: '0' },
								{ value: 5, label: '5' },
								{ value: 10, label: '10' },
							],
						},
					}),
					v.maxValue(10),
		),
		name: v.optional(v.pipe(v.string(), v.hexColor()), '#000000'),
		check: v.optional(v.boolean(), true),
	})
@Plugin({ name: 'PluginA' })
export class PluginA extends BasePlugin {
	@Config(test)
	private config!: Config<typeof test>;

	constructor(public pluginB: PluginB, @Optional() public pluginC?: PluginC) {
    super();
  }

	init(_abort: AbortSignal) {
		this.ctx.logger.info('PluginA initialized')
		// 使用必需依赖 PluginB
		this.pluginB.doSomething()
		// 可选依赖 PluginC 进行判断
		if (this.pluginC) {
			this.ctx.logger.info('PluginA using PluginC dependency')
		} else {
			this.ctx.logger.info('PluginA: PluginC dependency not injected')
		}
		this.ctx.test.collect()
		this.ctx.honoService.modifyApp((app) => {
			app.get("/a", (c) => { return c.html("text")})
		})
	}

	stop(abort: AbortSignal) {
		
	}
	doSomething(): void {
		this.ctx.logger.info('PluginA doing something...')
	}
}
