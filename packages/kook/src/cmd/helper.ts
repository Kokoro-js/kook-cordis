/**
 * 更快的 argv 解析：
 * - 单/双引号包裹的段会被合并
 * - 反斜杠转义下一个字符（包括空白与引号）
 * - 空白分隔：space/tab/newline/carriage return
 * - 默认保留空引号参数：a "" b  => ["a", "", "b"]
 * - 容错：未闭合引号将按已读内容收尾
 */
export interface ArgvParseOptions {
	/** 是否保留空引号形成的空实参（默认为 true） */
	preserveEmptyQuotes?: boolean;
}

export function parseArgsStringToArgv(
	value: string,
	opts: ArgvParseOptions = {},
): string[] {
	const preserveEmptyQuotes = opts.preserveEmptyQuotes ?? true;

	const out: string[] = [];
	const n = value.length;

	// —— Fast path：无引号/反斜杠且仅空格分隔 —— //
	// 避免正则与多余分配
	if (
		value.indexOf('"') === -1 &&
		value.indexOf("'") === -1 &&
		value.indexOf("\\") === -1 &&
		value.indexOf("\t") === -1 &&
		value.indexOf("\n") === -1 &&
		value.indexOf("\r") === -1
	) {
		let i = 0;
		while (i < n) {
			// skip spaces
			while (i < n && value.charCodeAt(i) === 32) i++;
			let j = i;
			while (j < n && value.charCodeAt(j) !== 32) j++;
			if (j > i) out.push(value.slice(i, j));
			i = j + 1;
		}
		return out;
	}

	// —— 通用路径：切片累积，避免字符级拼接 —— //
	let i = 0;
	let segStart = 0; // 当前未推入片段的起始索引
	const pieces: string[] = []; // 当前 token 的片段集合
	let inQuote = 0; // 0/34(")/39(')
	let sawQuote = false; // 当前 token 是否出现过引号

	const isWS = (code: number) =>
		code === 32 || code === 9 || code === 10 || code === 13; // space \t \n \r

	while (i < n) {
		const code = value.charCodeAt(i);

		// 反斜杠转义：吃掉反斜杠，把下一个字符原样并入
		if (code === 92 /* \ */) {
			if (i > segStart) pieces.push(value.slice(segStart, i));
			i++;
			if (i < n) {
				pieces.push(value[i]); // 原样并入被转义字符
				i++;
			}
			segStart = i;
			continue;
		}

		// 引号进入/退出
		if (code === 34 /* " */ || code === 39 /* ' */) {
			if (inQuote === 0) {
				if (i > segStart) pieces.push(value.slice(segStart, i));
				inQuote = code;
				sawQuote = true;
				i++;
				segStart = i;
				continue;
			}
			if (inQuote === code) {
				if (i > segStart) pieces.push(value.slice(segStart, i));
				inQuote = 0;
				i++;
				segStart = i;
				continue;
			}
			// 与当前引号类型不同：视作普通字符，落下去由默认分支处理
		}

		// 引号外的空白 => token 边界
		if (inQuote === 0 && isWS(code)) {
			if (i > segStart) pieces.push(value.slice(segStart, i));
			const token =
				pieces.length > 0
					? pieces.join("")
					: sawQuote && preserveEmptyQuotes
						? ""
						: null;
			if (token !== null) out.push(token as string);

			// 重置 token 状态
			pieces.length = 0;
			sawQuote = false;

			// 吃掉连续空白
			do {
				i++;
			} while (i < n && isWS(value.charCodeAt(i)));
			segStart = i;
			continue;
		}

		i++; // 普通字符前进
	}

	// 收尾
	if (i > segStart) pieces.push(value.slice(segStart, i));
	const last =
		pieces.length > 0
			? pieces.join("")
			: sawQuote && preserveEmptyQuotes
				? ""
				: null;
	if (last !== null) out.push(last as string);

	return out;
}
