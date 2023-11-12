import { Flags, typeFlag, TypeFlag } from 'type-flag';
import { Awaitable } from 'cosmokit';
import { MessageExtra, MessageSession } from '../../types';
import { Bot } from '../../bot';

type ParseRequired<T extends string> = T extends `${infer Before} <${infer Param}> ${infer After}`
  ? { [K in Param]: string } & ParseRequired<`${Before} ${After}`>
  : T extends `${infer Before} <${infer Param}>`
  ? { [K in Param]: string }
  : {};

type ParseOptional<T extends string> = T extends `${infer Before} [${infer Param}] ${infer After}`
  ? { [K in Param]?: string } & ParseOptional<`${Before} ${After}`>
  : T extends `${infer Before} [${infer Param}]`
  ? { [K in Param]?: string }
  : {};

type ExtractCommandParams<T extends string> = ParseRequired<T> & ParseOptional<T>;

type CallbackFunction<T extends Flags<Record<string, unknown>>, P extends string> = (
  argv: TypeFlag<T> & ExtractCommandParams<P>,
  bot: Bot,
  session: MessageSession<MessageExtra>,
) => Awaitable<void | string>;

type CheckerFunction = (
  bot: Bot,
  session: MessageSession<MessageExtra>,
) => Awaitable<void | boolean>;

export class CommandInstance<T extends Flags = any, P extends string = any> {
  readonly name: string;
  readonly description: string;
  readonly options: T;
  aliases: string[] = [];
  commandFunction: CallbackFunction<T, P>;
  checkers: Record<string, CheckerFunction> = {};

  readonly requiredMatches: string[];
  readonly optionalMatches: string[];

  constructor(name: P, desc: string, options: T) {
    const [commandName, ...paramStrings] = name.split(' ');
    this.name = commandName;
    this.requiredMatches = [];
    this.optionalMatches = [];
    for (const param of paramStrings) {
      if (param.startsWith('<')) this.requiredMatches.push(param.slice(1, -1));
      else if (param.startsWith('[')) this.optionalMatches.push(param.slice(1, -1));
    }
    this.description = desc;
    this.options = options;
  }

  action(callback: CallbackFunction<T, P>) {
    this.commandFunction = callback;
    return this;
  }

  alias(alias: string[] | string) {
    if (Array.isArray(alias)) this.aliases.push(...alias);
    else this.aliases.push(alias);
    return this;
  }

  addChecker(name: string, check: CheckerFunction) {
    this.checkers[name] = check;
    return this;
  }

  async execute(possible: string, bot: Bot, session: MessageSession<MessageExtra>) {
    for (const check of Object.values(this.checkers)) {
      if ((await check(bot, session)) === false) return false;
    }

    let argv = typeFlag(this.options, parseArgsStringToArgv(possible));
    const params: Record<string, string> = {};

    if (this.requiredMatches.length > argv._.length) {
      bot.sendMessage(
        session.channelId,
        `须填参数 ${argv._.length} 个，还缺少 ${
          argv._.length - this.requiredMatches.length
        } 个参数。`,
        { quote: session.data.msg_id },
      );
      return;
    }

    this.requiredMatches.forEach((paramName, index) => {
      params[paramName] = argv._[index];
    });

    this.optionalMatches.forEach((paramName, index) => {
      if (index + this.requiredMatches.length < argv._.length) {
        params[paramName] = argv._[index + this.requiredMatches.length];
      }
    });

    argv = { ...argv, ...params };
    const result = await this.commandFunction(argv as any, bot, session);
    if (result) await bot.sendMessage(session.channelId, result);
    return true;
  }
}

function parseArgsStringToArgv(value: string) {
  const args = [];
  let inQuotes = false;
  let escape = false;
  let arg = '';

  for (const current of value) {
    if (escape) {
      arg += current;
      escape = false;
    } else if (current === '\\') {
      escape = true;
    } else if (current === '"') {
      inQuotes = !inQuotes;
    } else if (current === ' ' && !inQuotes) {
      if (arg) {
        args.push(arg);
        arg = '';
      }
    } else {
      arg += current;
    }
  }

  if (arg) args.push(arg);

  return args;
}
