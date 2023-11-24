import { Flags, typeFlag, TypeFlag } from 'type-flag';
import { Awaitable } from 'cosmokit';
import { MessageExtra, MessageSession, Permissions } from '../../types';
import { Bot } from '../../bot';
import { hasPermission } from '../../utils';
import { pino } from '../../Logger';
import { Commander } from './commander';

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
  readonly logger: pino.Logger<{ name: string; level: string }>;
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
    this.logger = Commander.CommandLogger.child({ name, desc });
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

  guildAdminOnly() {
    this.checkers['admin'] = async (bot, session) => {
      const guildRoles = await bot.getGuildRoleList({ guild_id: session.guildId });
      const role = session.data.extra.author.roles[0];
      const targetRole = guildRoles.items.find((item) => item.role_id == role);
      if (targetRole && hasPermission(targetRole.permissions, Permissions.GUILD_ADMIN)) return true;
      await bot.sendMessage(session.channelId, '你没有权限执行此操作。');
      return false;
    };
    return this;
  }

  developerOnly() {
    this.checkers['developer'] = (bot, session) => {
      return Commander.developerIds.includes(session.userId);
    };
    return this;
  }

  async execute(possible: string, bot: Bot, session: MessageSession<MessageExtra>) {
    for (const check of Object.values(this.checkers)) {
      if ((await check(bot, session)) === false) return false;
    }

    let argv = typeFlag(this.options, parseArgsStringToArgv(possible));
    const params: Record<string, string> = {};

    if (this.requiredMatches.length > argv._.length) {
      await bot.sendMessage(
        session.channelId,
        `须填参数 ${this.requiredMatches.length} 个，还缺少 ${
          this.requiredMatches.length - argv._.length
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

  handleError = (e: Error) => {
    this.logger.error(e);
  };
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
