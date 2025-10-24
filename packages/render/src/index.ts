import fs from "node:fs";
import path from "node:path";
import * as leaferNode from "@leafer-ui/node";
import Napi from "@napi-rs/canvas";
import { BasePlugin, Config, Plugin, v } from "@pluxel/hmr";
import type { ECharts, EChartsOption } from "echarts";
import * as echartsNode from "echarts";

/* ─────────────────────────────────────────────────────────
 * 配置 Schema（Valibot）
 * ───────────────────────────────────────────────────────── */
export const RenderCfgSchema = v.object({
	/** 启动时尝试注册的字体目录（可空，支持多目录） */
	fontDirs: v.optional(v.array(v.string()), ["./fonts"]),
	/** ECharts 默认主题 */
	defaultTheme: v.optional(v.string(), "light"),
	/** 默认画布尺寸 */
	width: v.optional(v.number(), 1000),
	height: v.optional(v.number(), 700),
	/** ECharts 默认字体（作为 textStyle.fontFamily 的默认） */
	presetFont: v.optional(v.string(), "LXGW WenKai"),
});
type RenderCfg = typeof RenderCfgSchema;

/* ─────────────────────────────────────────────────────────
 * 插件实现：不往 ctx 挂任何东西；通过 DI 注入本类使用
 * ───────────────────────────────────────────────────────── */
@Plugin({ name: "Render" })
export class Render extends BasePlugin {
	@Config(RenderCfgSchema)
	private cfg!: Config<RenderCfg>;

	/** 直接暴露底层依赖，方便高阶自定义 */
	public readonly canvas = Napi;
	public readonly echarts = echartsNode;
	public readonly leafer = leaferNode;

	/** 平台 API 只装一次（静态守护，兼容 HMR 多实例） */
	private static platformReady = false;

	/** 获取默认字体名 */
	get presetFont(): string {
		return this.cfg.presetFont ?? "LXGW WenKai";
	}

	constructor() {
		super();
	}

	/* ───────────────────────── init/stop ───────────────────────── */

	async init(_abort: AbortSignal): Promise<void> {
		const log = this.ctx.logger;

		// 1) 为 ECharts 安装 Napi Canvas 平台 API（只做一次）
		if (!Render.platformReady) {
			this.echarts.setPlatformAPI({
				createCanvas: () => this.canvas.createCanvas(32, 32) as any,
				// 兼容 dataURL / Buffer / Image 多形态输入
				loadImage: (src: any) => {
					if (src instanceof this.canvas.Image) return src;
					const img = new this.canvas.Image() as any;
					let source: any = src;
					if (typeof source === "string") {
						const commaIdx = source.indexOf(",");
						const encoding =
							source.lastIndexOf("base64", commaIdx) < 0 ? "utf-8" : "base64";
						source = Buffer.from(source.slice(commaIdx + 1), encoding);
					}
					img.src = source;
					return img;
				},
			});
			Render.platformReady = true;
			log.debug("[Render] ECharts platform ready");
		}

		// 2) 尝试注册配置中的字体目录（存在则加载）
		const dirs = this.cfg.fontDirs ?? [];
		for (const d of dirs) this.registerFontDirSafe(d, /*silent*/ true);

		leaferNode.useCanvas("napi", this.canvas);
		log.info("[Render] initialized");
	}

	async stop(_abort: AbortSignal): Promise<void> {
		// 当前实现没有全局可释放句柄；ECharts 平台 API 装一次即可
		this.ctx.logger.info("[Render] stopped");
	}

	/* ───────────────────────── Public API ───────────────────────── */

	/**
	 * 扫描并注册字体目录（.ttf/.otf/.ttc/.woff/.woff2）
	 * - 可在运行期多次调用
	 */
	public registerFontDir(dir: string): void {
		this.registerFontDirSafe(dir, /*silent*/ false);
	}

	/**
	 * 创建 ECharts 实例与其 backing canvas，并返回处置句柄
	 * - 默认：关闭动画；补充全局 textStyle.fontFamily 为 presetFont
	 * - 适合长生命周期/批量渲染，调用者自行 chart.dispose()
	 */
	public createChart(
		width: number = this.cfg.width,
		height: number = this.cfg.height,
		options: EChartsOption,
		theme?: string,
		opts?: { animation?: boolean; applyDefaultTextStyle?: boolean },
	): { canvas: Napi.Canvas; chart: ECharts; dispose: () => void } {
		let _canvas = this.canvas.createCanvas(width, height);
		let chart = this.echarts.init(
			_canvas as any,
			theme ?? this.cfg.defaultTheme,
		);

		const applyDefaultText = opts?.applyDefaultTextStyle ?? true;
		const animation = opts?.animation ?? false;

		if (applyDefaultText) {
			const def = {
				fontFamily: this.presetFont,
				fontSize: 18,
			};
			options = {
				textStyle: { ...def, ...(options.textStyle ?? {}) },
				...options,
			};
		}
		if (options.animation == null) options.animation = animation;

		chart.setOption(options);

		const dispose = () => {
			try {
				chart?.dispose();
			} finally {
				// 释放强引用，帮助 GC
				// @ts-expect-error
				chart = null;
				// @ts-expect-error
				_canvas = null;
			}
		};

		return { canvas: _canvas, chart, dispose };
	}

	/**
	 * 一步到位输出 PNG Buffer（内部自动 dispose）
	 * - 适合临时渲染：无需手动管理生命周期
	 */
	public async createChartPNG(
		width: number = this.cfg.width,
		height: number = this.cfg.height,
		options: EChartsOption,
		theme?: string,
		opts?: { animation?: boolean; applyDefaultTextStyle?: boolean },
	): Promise<Buffer> {
		const h = this.createChart(width, height, options, theme, opts);
		try {
			return (h.canvas as any).toBuffer("image/png") as Buffer;
		} finally {
			h.dispose();
		}
	}

	/**
	 * 使用 Leafer 渲染一张 PNG
	 * - 在 builder 回调中用 Leafer API 构建场景
	 */
	public async renderLeaferPNG(
		width: number,
		height: number,
		builder: (
			L: typeof leaferNode,
			root: leaferNode.Leafer,
		) => void | Promise<void>,
	): Promise<Buffer> {
		const leafer = new this.leafer.Leafer({ width, height });
		await Promise.resolve(builder(this.leafer, leafer));
		const out = await leafer.export("png", { blob: true });
		return Buffer.from(out.data);
	}

	/* ───────────────────────── Internal ───────────────────────── */

	private registerFontDirSafe(dir: string, silent: boolean) {
		const log = this.ctx.logger;
		const abs = path.resolve(dir);
		const exts = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2"]);

		try {
			if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
				if (!silent) log.warn(`[Render] fontDir not found: ${abs}`);
				return;
			}
			const files = fs.readdirSync(abs);
			let count = 0;
			for (const f of files) {
				const ext = path.extname(f).toLowerCase();
				if (!exts.has(ext)) continue;
				try {
					this.canvas.GlobalFonts.registerFromPath(path.join(abs, f));
					count++;
				} catch (e) {
					log.debug(`[Render] font register failed: ${f}`, e);
				}
			}
			if (count > 0) log.info(`[Render] fonts loaded: ${count} from ${abs}`);
		} catch (e) {
			if (!silent) log.warn(`[Render] fontDir scan failed: ${abs}`, e);
		}
	}
}

/* ─────────────────────────────────────────────────────────
 * 对外类型/依赖转出（可选）
 * ───────────────────────────────────────────────────────── */
export type { EChartsOption };
export {
	Napi as CanvasNapi,
	echartsNode as EChartsNode,
	leaferNode as LeaferNode,
};
