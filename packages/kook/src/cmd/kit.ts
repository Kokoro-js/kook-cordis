import type { Flags, TypeFlag, TypeFlagOptions } from "type-flag";
import {
	type Awaitable,
	type Command,
	type CommandSpec,
	defineCommand,
	type ExtractCommandParams,
} from "./index";

/* ──────────────────────────────────────────────────────────────
 * 中间件模型
 * ---------------------------------------------------------------- */
export type CmdNext<C> = (argv: any, ctx: C) => Awaitable<string | void>;
export type CmdMiddleware<C> = (next: CmdNext<C>) => CmdNext<C>;

/* ──────────────────────────────────────────────────────────────
 * Builder & Kit 接口
 * ---------------------------------------------------------------- */
export interface CommandBuilder<P extends string, F extends Flags, C> {
	alias(...names: string[]): this;
	usage(text: string): this;
	describe(text: string): this;
	use(mw: CmdMiddleware<C>): this;
	action(
		handler: (
			argv: TypeFlag<F> & ExtractCommandParams<P>,
			ctx: C,
		) => Awaitable<string | void>,
	): Command<P, F, C>;
}

export interface CommandKit<C> {
	cmd<P extends string, F extends Flags = {}>(
		pattern: P,
		flags?: F,
		flagOptions?: TypeFlagOptions,
	): CommandBuilder<P, F, C>;

	group(name: string, def: (kit: CommandKit<C>) => void): void;
	list(): ReadonlyArray<Command<any, any, C>>;
	help(): string;
}

/* ──────────────────────────────────────────────────────────────
 * 实现：定义即注册、分组前缀、中间件
 * ---------------------------------------------------------------- */
export function createCommandKit<C>(bus: {
	register: (cmd: Command<any, any, C>) => any;
	list: () => Command<any, any, C>[];
}): CommandKit<C> {
	type AnyCmd = Command<any, any, C>;
	const meta = new Map<AnyCmd, { desc?: string; group?: string }>();
	const groupStack: string[] = [];

	type LocalMeta = { desc?: string; group?: string; mws: CmdMiddleware<C>[] };
	type Chain = (argv: any, ctx: C) => Awaitable<string | void>;

	const wrap = <P extends string, F extends Flags>(
		full: CommandSpec<P, F, C>,
		local: LocalMeta,
	): Command<P, F, C> => {
		const origin = full.action;
		const chain = local.mws.reduceRight<Chain>(
			(next, mw) => mw(next),
			(argv, ctx) => origin(argv, ctx),
		);
		const cmd = defineCommand<P, F, C>({ ...full, action: chain as any });
		meta.set(cmd, { desc: local.desc, group: local.group });
		bus.register(cmd);
		return cmd;
	};

	const kit: CommandKit<C> = {
		cmd<P extends string, F extends Flags = {}>(
			pattern: P,
			flags?: F,
			flagOptions?: TypeFlagOptions,
		) {
			const group = groupStack[groupStack.length - 1];
			const pat = (group ? `${group} ${pattern}` : pattern) as P;

			// 先准备“基础字段”，避免在 builder 阶段就被 TS 要求 action
			const base = {
				pattern: pat,
				flags: (flags ?? ({} as F)) as F,
				flagOptions,
				aliases: [] as string[],
			} satisfies Omit<CommandSpec<P, F, C>, "action" | "usage">;

			let usageText: string | undefined;
			const local: LocalMeta = { group, mws: [] };

			const builder: CommandBuilder<P, F, C> = {
				alias(...names) {
					base.aliases.push(...names);
					return this;
				},
				usage(text) {
					usageText = text;
					return this;
				},
				describe(text) {
					local.desc = text;
					return this;
				},
				use(mw) {
					local.mws.push(mw);
					return this;
				},
				action(handler) {
					const full: CommandSpec<P, F, C> = {
						...base,
						...(usageText ? { usage: usageText } : {}),
						action: handler,
					};
					return wrap(full, local);
				},
			};
			return builder;
		},

		group(name, def) {
			groupStack.push(name);
			try {
				def(kit);
			} finally {
				groupStack.pop();
			}
		},

		list() {
			return bus.list();
		},

		help() {
			const lines: string[] = [];
			const groups = new Map<string | undefined, AnyCmd[]>();
			for (const c of bus.list()) {
				const m = meta.get(c) || {};
				if (!groups.has(m.group)) groups.set(m.group, []);
				groups.get(m.group)!.push(c);
			}
			for (const [g, cmds] of groups) {
				if (g) lines.push(`\n# ${g}`);
				for (const c of cmds) {
					const m = meta.get(c) || {};
					lines.push(`- ${c.toUsage()}${m.desc ? ` — ${m.desc}` : ""}`);
				}
			}
			return lines.join("\n");
		},
	};

	return kit;
}
