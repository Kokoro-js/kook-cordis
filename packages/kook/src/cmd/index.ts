import type { Flags, TypeFlag, TypeFlagOptions } from "type-flag";
import { typeFlag } from "type-flag";

/* ──────────────────────────────────────────────────────────────
 * 类型层：从 pattern 推断参数类型
 * 支持：<req>  [opt]  以及  [...rest]（至多一个）
 * ---------------------------------------------------------------- */

type Trim<S extends string> = S extends ` ${infer A}`
	? Trim<A>
	: S extends `${infer A} `
		? Trim<A>
		: S;

// —— 提取必选参数 —— //
type ParseRequired<S extends string> =
	S extends `${infer B}<${infer P}>${infer A}`
		? Record<Trim<P>, string> & ParseRequired<`${B}${A}`>
		: {};

// —— 提取可选参数（不含 rest）—— //
type ParseOptional<S extends string> =
	S extends `${infer B}[...${string}]${infer A}` // 跳过 rest，留给 ParseRest
		? ParseOptional<`${B}${A}`>
		: S extends `${infer B}[${infer P}]${infer A}`
			? Partial<Record<Trim<P>, string>> & ParseOptional<`${B}${A}`>
			: {};

// —— 提取可选 rest（string[]） —— //
type ParseRest<S extends string> =
	S extends `${infer _B}[...${infer R}]${infer _A}`
		? { [K in Trim<R>]?: string[] }
		: {};

// —— 汇总 —— //
export type ExtractCommandParams<P extends string> = ParseRequired<P> &
	ParseOptional<P> &
	ParseRest<P>;

/* ──────────────────────────────────────────────────────────────
 * 运行时结构
 * ---------------------------------------------------------------- */

export type Awaitable<T> = T | Promise<T>;

export interface CommandSpec<P extends string, F extends Flags, C = unknown> {
	pattern: P;
	flags: F;
	flagOptions?: TypeFlagOptions;
	usage?: string;
	aliases?: string[]; // 仅命名 token（不能含 < > [ ]）
	action: (
		argv: TypeFlag<F> & ExtractCommandParams<P>,
		ctx: C,
	) => Awaitable<string | void>;
}

export interface Command<P extends string, F extends Flags, C = unknown> {
	/** 完整命名 tokens（用于 Trie） */
	readonly nameTokens: readonly string[];
	/** 预编译的 usage 文本 */
	toUsage(): string;
	/** 直接用 tokens 运行（flags + 位置参数） */
	runTokens(tokens: string[], ctx: C): Promise<string | void>;
	/** 从原始字符串运行（会先分词） */
	run(input: string, ctx: C): Promise<string | void>;
	/** 原始模式（可显示） */
	readonly pattern: P;
	/** 别名（经过规范化） */
	readonly aliases: readonly string[];
}

/* ──────────────────────────────────────────────────────────────
 * 分词器：保留简单 & 高性能（引号/转义）
 * 若你已有更强分词器，可替换这里的实现
 * ---------------------------------------------------------------- */
export function parseArgsStringToArgv(input: string): string[] {
	const out: string[] = [];
	let cur = "";
	let i = 0;
	let quote: '"' | "'" | null = null;
	while (i < input.length) {
		const ch = input[i++];
		if (quote) {
			if (ch === "\\") {
				// 简单转义
				if (i < input.length) cur += input[i++];
				continue;
			}
			if (ch === quote) {
				quote = null;
				continue;
			}
			cur += ch;
		} else {
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (/\s/.test(ch)) {
				if (cur) {
					out.push(cur);
					cur = "";
				}
				continue;
			}
			if (ch === "\\") {
				if (i < input.length) cur += input[i++];
				continue;
			}
			cur += ch;
		}
	}
	if (cur) out.push(cur);
	return out;
}

/* ──────────────────────────────────────────────────────────────
 * 编译 pattern：nameTokens / required[] / optional[] / restKey?
 * ---------------------------------------------------------------- */

interface CompiledPattern {
	nameTokens: string[]; // 命名 token（不含参数）
	required: string[]; // <a>
	optional: string[]; // [b]
	restKey?: string; // [...rest]
	usage: string; // 预构建 usage
}

// 仅提取命名 token（遇到 < > [ ] 停）
function compilePattern(pattern: string): CompiledPattern {
	const parts = pattern.trim().split(/\s+/);
	const nameTokens: string[] = [];
	let i = 0;
	for (; i < parts.length; i++) {
		const p = parts[i];
		if (p.startsWith("<") || p.startsWith("[")) break;
		nameTokens.push(p);
	}

	const required: string[] = [];
	const optional: string[] = [];
	let restKey: string | undefined;

	for (; i < parts.length; i++) {
		const p = parts[i];
		if (p.startsWith("<") && p.endsWith(">")) {
			required.push(p.slice(1, -1).trim());
		} else if (p.startsWith("[") && p.endsWith("]")) {
			const inner = p.slice(1, -1).trim();
			if (inner.startsWith("...")) {
				if (restKey) throw new Error(`Duplicate rest in pattern: ${pattern}`);
				restKey = inner.slice(3).trim();
				if (!restKey) throw new Error(`Empty rest name in pattern: ${pattern}`);
			} else {
				optional.push(inner);
			}
		} else {
			throw new Error(`Invalid token in pattern "${pattern}": ${p}`);
		}
	}

	const usage = `${nameTokens.join(" ")}${required.map((k) => ` <${k}>`).join("")}${optional.map((k) => ` [${k}]`).join("")}${restKey ? ` [...${restKey}]` : ""}`;

	return { nameTokens, required, optional, restKey, usage };
}

/* ──────────────────────────────────────────────────────────────
 * defineCommand：把 Spec 编译成可执行命令
 * ---------------------------------------------------------------- */

export function defineCommand<P extends string, F extends Flags, C = unknown>(
	spec: CommandSpec<P, F, C>,
): Command<P, F, C> {
	const cp = compilePattern(spec.pattern);

	// 别名校验：只允许命名 token
	const aliases = Object.freeze(
		Array.from(
			new Set((spec.aliases ?? []).map((s) => s.trim()).filter(Boolean)),
		),
	);
	for (const a of aliases) {
		if (/[<>[\]]/.test(a)) {
			throw new Error(`Alias should not contain parameters: "${a}"`);
		}
	}

	const usage = spec.usage ?? cp.usage;

	const toUsage = () => usage;

	const runCore = async (tokens: string[], ctx: C) => {
		// 1) flags 交给 type-flag（保留你的习惯：默认 permissive）
		const argv = typeFlag(spec.flags as any, tokens, spec.flagOptions);

		// 2) 位置参数处理（argv._ 为剩余）
		const pos = (argv._ as string[]) ?? [];
		if (pos.length < cp.required.length) {
			throw new CommandError(
				`Expected ${cp.required.length} args, got ${pos.length}. Usage: ${usage}`,
			);
		}

		const params: Record<string, any> = Object.create(null);
		let k = 0;

		// 必选
		for (let i = 0; i < cp.required.length; i++)
			params[cp.required[i]] = pos[k++];

		// 可选
		for (let i = 0; i < cp.optional.length; i++) {
			const v = pos[k];
			if (v !== undefined) {
				params[cp.optional[i]] = v;
				k++;
			}
		}

		// rest
		if (cp.restKey) {
			params[cp.restKey] = pos.slice(k); // string[]
			k = pos.length;
		} else {
			// 无 rest：多余即报错（更严格）
			if (k < pos.length) {
				throw new CommandError(`Too many positional args. Usage: ${usage}`);
			}
		}

		// 合并（flags 优先，然后是命名位置参数）
		const merged = Object.assign(
			Object.create(null),
			argv,
			params,
		) as TypeFlag<F> & ExtractCommandParams<P>;
		return spec.action(merged, ctx);
	};

	return {
		nameTokens: cp.nameTokens,
		pattern: spec.pattern,
		aliases,
		toUsage,
		runTokens(tokens, ctx) {
			return runCore(tokens, ctx);
		},
		run(input, ctx) {
			return runCore(parseArgsStringToArgv(input), ctx);
		},
	};
}

/* ──────────────────────────────────────────────────────────────
 * Router（Command Bus）：单词快表 + Trie 最长匹配
 * ---------------------------------------------------------------- */

export class CommandError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "CommandError";
	}
}

export function createCommandBus<C = unknown>(opts?: {
	prefix?: string; // 若提供，将要求并剥离此前缀（如 "/"）
	caseInsensitive?: boolean;
}) {
	type AnyCmd = Command<any, any, C>;
	const norm = (s: string) => (opts?.caseInsensitive ? s.toLowerCase() : s);

	// 单词快表 + 全量视图
	const byHead = new Map<string, AnyCmd>();
	const all = new Set<AnyCmd>();

	// Trie 结点
	type Node = { cmd?: AnyCmd; next: Map<string, Node> };
	const root: Node = { next: new Map() };

	const put = (tokens: readonly string[], cmd: AnyCmd) => {
		let cur = root;
		for (const raw of tokens) {
			const t = norm(raw);
			let n = cur.next.get(t);
			if (!n) cur.next.set(t, (n = { next: new Map() }));
			cur = n;
		}
		cur.cmd = cmd;
	};

	const find = (tokens: string[]) => {
		let cur = root;
		let last: AnyCmd | undefined;
		let consumed = 0;
		for (let i = 0; i < tokens.length; i++) {
			const t = norm(tokens[i]);
			const n = cur.next.get(t);
			if (!n) break;
			cur = n;
			consumed = i + 1;
			if (cur.cmd) last = cur.cmd;
		}
		return last ? { cmd: last, consumed } : undefined;
	};

	return {
		register<CMD extends AnyCmd>(cmd: CMD) {
			all.add(cmd);
			if (cmd.nameTokens.length === 0)
				throw new Error(`Empty command name in pattern "${cmd.pattern}"`);
			if (cmd.nameTokens.length === 1) byHead.set(norm(cmd.nameTokens[0]), cmd);
			put(cmd.nameTokens, cmd);
			for (const a of cmd.aliases) {
				const toks = a.split(/\s+/);
				if (toks.length === 1) byHead.set(norm(toks[0]), cmd);
				put(toks, cmd);
			}
			return this;
		},

		/** 可选：返回反注册器（便于 HMR） */
		unregister(cmd: AnyCmd) {
			// 简化：仅移出视图/快表；Trie 不拆（HMR 期间开销更低）
			all.delete(cmd);
			if (cmd.nameTokens.length === 1) byHead.delete(norm(cmd.nameTokens[0]));
			for (const a of cmd.aliases) {
				const toks = a.split(/\s+/);
				if (toks.length === 1) byHead.delete(norm(toks[0]));
			}
		},

		list(): AnyCmd[] {
			return Array.from(all);
		},

		/** 分发（字符串入口）：一次分词，全链路复用 */
		async dispatch(input: string, ctx: C): Promise<string | void> {
			const tokens = parseArgsStringToArgv(input);
			if (!tokens.length) throw new CommandError("Empty input");

			// 前缀处理（可选）
			if (opts?.prefix) {
				const p = opts.prefix;
				if (tokens[0]?.startsWith(p)) {
					tokens[0] = tokens[0].slice(p.length);
					if (!tokens[0]) tokens.shift();
				} else {
					throw new CommandError(`Missing prefix "${p}"`);
				}
			}
			if (!tokens.length) throw new CommandError("Missing command name");

			// 单词快路径
			const fast = byHead.get(norm(tokens[0]));
			if (fast && fast.nameTokens.length === 1) {
				return fast.runTokens(tokens.slice(1), ctx);
			}

			// Trie 最长匹配
			const found = find(tokens);
			if (!found) return;
			const rest = tokens.slice(found.consumed);
			return found.cmd.runTokens(rest, ctx);
		},
	};
}

/* ──────────────────────────────────────────────────────────────
 * 工具：为特定 C 生成泛型化 define
 * ---------------------------------------------------------------- */
export function defineFor<C>() {
	return function define<P extends string, F extends Flags>(
		spec: CommandSpec<P, F, C>,
	) {
		return defineCommand<P, F, C>(spec);
	};
}
