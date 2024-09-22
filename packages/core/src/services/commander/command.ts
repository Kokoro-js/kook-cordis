import { Flags, typeFlag, TypeFlag } from 'type-flag';
import { Awaitable } from 'cosmokit';
import { MessageSession, Permissions } from '../../types';
import { Bot } from '../../bot';
import { hasPermission } from '../../utils';
import { Commander } from './commander';
import { parseArgsStringToArgv } from './helper';
import { req } from 'agent-base';

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

type CallbackFunction<T extends Flags, P extends string> = (
  argv: TypeFlag<T> & ExtractCommandParams<P>,
  bot: Bot,
  session: MessageSession,
) => Awaitable<void | string>;

type CheckerFunction = (bot: Bot, session: MessageSession) => Awaitable<void | boolean | Object>;

export class CommandInstance<T extends Flags = any, P extends string = any> {
  readonly name: string;
  readonly description: string;
  readonly options: T;
  readonly logger;
  isPublic: boolean = true;
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
    this.logger = Commander.CommandLogger.child({ command: name, desc });
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

  addPermissionChecker(check: CheckerFunction) {
    this.addChecker(Commander.PERMISSION, check);
    return this;
  }

  guildAdminOnly() {
    this.isPublic = false;
    this.checkers['admin'] = async (bot, session) => {
      const guildRoles = await bot.getGuildRoleList({ guild_id: session.guildId });
      const userRoles = session.data.extra.author.roles;
      const hasAdminPermission = userRoles.some(roleId => {
        const targetRole = guildRoles.items.find((item) => item.role_id == roleId);
        return targetRole && hasPermission(targetRole.permissions, Permissions.GUILD_ADMIN);
      });
      if (hasAdminPermission) {
        return true;
      }
      await bot.sendMessage(session.channelId, '你没有权限执行此操作。');
      return false;
    };
    return this;
  }

  developerOnly() {
    this.isPublic = false;
    this.checkers['developer'] = (bot, session) => {
      return Commander.developerIds.includes(session.userId);
    };
    return this;
  }

  private() {
    this.isPublic = false;
    return this;
  }

  async execute(possible: string, bot: Bot, session: MessageSession) {
    for (const check of Object.values(this.checkers)) {
      const returned = await check(bot, session);
      if (returned === false) return false;
      // 在 js 中 undefined 也是一个 object
      if (returned !== undefined && typeof returned == 'object') session.internalData = returned;
    }

    const parsedArgv = parseArgsStringToArgv(possible);

    if (this.requiredMatches.length > parsedArgv.length) {
      await bot.sendMessage(
        session.channelId,
        `须填参数 ${this.requiredMatches.length} 个，还缺少 ${
          this.requiredMatches.length - parsedArgv.length
        } 个参数。`,
        { quote: session.data.msg_id },
      );
      return;
    }

    const params: Record<string, string> = {};
    this.requiredMatches.forEach((paramName, index) => {
      params[paramName] = parsedArgv[index];
    });

    const argv = typeFlag(this.options, parsedArgv);

    this.optionalMatches.forEach((paramName, index) => {
      if (index + this.requiredMatches.length < argv._.length) {
        params[paramName] = argv._[index + this.requiredMatches.length];
      }
    });

    const result = await this.commandFunction(Object.assign(argv, params) as any, bot, session);
    if (result) await bot.sendMessage(session.channelId, result);
    return true;
  }

  handleError = (e: Error) => {
    this.logger.error(e);
  };
}
