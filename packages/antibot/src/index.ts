import { BasePlugin, Plugin } from "@pluxel/hmr";
// biome-ignore lint/style/useImportType: <KOOKBOT>
import { KOOKBOT, MessageType } from "pluxel-plugin-kook";
// biome-ignore lint/style/useImportType: <Render>
import { Render } from "pluxel-plugin-render";

/**
 * AntiBot plugin
 * 提供验证码生成接口，外部可自由决定如何处罚或验证用户。
 */
@Plugin({ name: "AntiBot" })
export class AntiBot extends BasePlugin {
	constructor(
		private render: Render,
		private kook: KOOKBOT,
	) {
		super();
	}

	/**
	 * 生成一个基础算术验证码 (简单的加法题)
	 */
	async createMathCaptcha(width = 300, height = 120) {
		const a = Math.floor(Math.random() * 10);
		const b = Math.floor(Math.random() * 10);
		const answer = a + b;

		const png = await this.render.renderLeaferPNG(width, height, (L, root) => {
			root.add(
				new L.Rect({
					width,
					height,
					fill: { type: "solid", color: "#fef3c7" },
				}),
			);
			root.add(
				new L.Text({
					x: 40,
					y: 40,
					text: `${a} + ${b} = ?`,
					fontSize: 48,
					fill: { type: "solid", color: "#1e293b" },
				}),
			);
		});

		return { png, answer };
	}

	/**
	 * 生成一个随机字符验证码 (A-Z, 4 位)
	 */
	async createCharCaptcha(width = 300, height = 120) {
		const chars = Array.from({ length: 4 }, () =>
			String.fromCharCode(65 + Math.floor(Math.random() * 26)),
		).join("");

		const png = await this.render.renderLeaferPNG(width, height, (L, root) => {
			root.add(
				new L.Rect({
					width,
					height,
					fill: { type: "solid", color: "#e0f2fe" },
				}),
			);
			root.add(
				new L.Text({
					x: 50,
					y: 40,
					text: chars,
					fontSize: 48,
					fill: { type: "solid", color: "#0f172a" },
				}),
			);
		});

		return { png, answer: chars };
	}

	/**
	 * KOOK 命令示例，生成验证码并发送图片
	 */
	async init() {
		this.kook.cmd.cmd("captcha").action(async (_, ctx) => {
			const { png, answer } = await this.createMathCaptcha();
			const file = await ctx.bot.createAssest(png);
			await ctx.bot.sendMessage(ctx.session.channelId, file, {
				type: MessageType.image,
			});

			// ⚠️ 验证逻辑、处罚方式交给外部应用使用者决定
			this.ctx.logger.info(`Captcha answer: ${answer}`);
		});
	}
}
