import { defineProperty, Dict } from 'cosmokit';
import { Context } from '../../context';

import { CommandInstance } from './command';
import { Flags } from 'type-flag';
import { createLogger, logger } from '../../Logger';

import { search } from 'fast-fuzzy';
import { MessageSession, MessageType } from '../../types';
import { Bot } from '../../bot';
import { Next } from '../middleware';
import { CardTemplate } from './Template';
import Schema from 'schemastery';
import { escapeKmdText } from '../../utils';

export { CommandInstance };

export type IHelpMessage = Dict<IHelpContent>;

export type IHelpContent = {
  description: string;
  required?: Dict<string>;
  optional?: Dict<string>;
  flags?: Dict<string>;
};

export class Commander {
  readonly _commands: Map<Context, CommandInstance[]> = new Map();
  readonly prefix: string;
  static developerIds: string[];
  static readonly CommandLogger = createLogger('Command');
  static readonly PERMISSION = 'PERMISSION';

  // 方便添加冷却
  helpCommand: CommandInstance;
  inspectCommand: CommandInstance;

  helpMessageObj: IHelpMessage = {
    help: { description: '提供指令相关帮助', required: { command: '指令名称' } },
  };

  constructor(
    private ctx: Context,
    public config: Commander.Config,
  ) {
    defineProperty(this, Context.current, ctx);
    this.prefix = config.commandPrefix;
    Commander.developerIds = config.developerIds;

    ctx.middleware(this.setupCommandParser.bind(this), true); // 前置中间件保证指令得到优先处理

    this.helpCommand = this.command('help [command]', '指令帮助', {}).action(
      async (argv, bot, session) => {
        const meetCommands: CommandInstance[] = [];

        for (let [context, command] of this._commands.entries()) {
          if (context.filter(session)) {
            meetCommands.push(...command);
          }
        }

        // 没有指令则列出所有指令
        if (!argv.command) {
          const checkResults = meetCommands.map((command) => {
            // 首先检查命令是否是公开的
            if (!command.isPublic) {
              // 如果命令不是公开的，可以直接返回 false 或根据实际需求返回 true
              return false;
            }

            // 对于公开的命令，如果没有设置权限检查器，则认为检查通过
            if (!command.checkers[Commander.PERMISSION]) {
              return true;
            }
          });
          bot
            .sendMessage(
              session.channelId,
              CardTemplate.CommandList(
                `指令帮助 (指令前缀 "${this.prefix}")`,
                this.formatCommandListOutput(
                  meetCommands.filter((_, index) => checkResults[index]),
                ),
                session.data.content,
                session.data.extra.author.avatar,
              ),
              {
                type: MessageType.card,
                quote: session.data.msg_id,
              },
            )
            .catch((e) => {
              bot.logger.error(e, '处理 Help 时遇到错误');
            });
          return;
        }

        for (const obj of meetCommands) {
          if (obj.name !== argv.command && !obj.aliases.includes(argv.command)) continue;

          // 匹配到相应指令，首先检查有没有权限过滤器
          if ((await obj.checkers[Commander.PERMISSION]?.(bot, session)) === false) {
            return;
          }
          const content = this.helpMessageObj[obj.name];
          if (!content) {
            return `指令 **${obj.name}** - ${
              obj.description
            }\n **必填参数** ${obj.requiredMatches.toString()}\n **选填参数** ${obj.optionalMatches.toString()}\n **标签** ${Object.keys(
              obj.options,
            )}`;
          }
          bot
            .sendMessage(
              session.channelId,
              CardTemplate.HelpCardTemplate(
                `${obj.name} ${obj.aliases.length !== 0 ? `(${obj.aliases.toString()})` : ''}`,
                content,
              ),
              {
                type: MessageType.card,
                quote: session.data.msg_id,
              },
            )
            .catch((e) => {
              bot.logger.error(e, '处理 Help 时遇到错误');
            });
          return;
        }

        return `没有找到指令 ${escapeKmdText(argv.command ?? '')}`;
      },
    );

    this.inspectCommand = this.command('inspect', '获取当前情境的信息', {})
      .guildAdminOnly()
      .action((argv, bot, session) => {
        bot
          .sendMessage(
            session.channelId,
            `服务器: ${session.guildId}\n 频道: ${session.channelId}\n 用户: ${session.userId}`,
            { temp_target_id: session.userId },
          )
          .catch((e) => {
            bot.logger.error(e, '处理 inspect 时遇到错误');
          });
      });
  }

  protected get caller() {
    return this[Context.current] as Context;
  }

  get commands() {
    return this._commands.get(this.caller);
  }

  executeString(bot: Bot, session: MessageSession, input?: string) {
    return this.parseStringAndExecuteFound(bot, session, input);
  }

  command<T extends Flags, P extends string>(
    commandName: P,
    description: string,
    options: T = {} as T,
  ): CommandInstance<T, P> {
    const command = new CommandInstance<T, P>(commandName, description, options);
    const context = this.caller;

    if (this._commands.has(context)) {
      this._commands.get(context).push(command);
    } else {
      this._commands.set(context, [command]);
    }

    // 在情境卸载的时候也移除注册的指令
    context.runtime.disposables.push(() => this._commands.delete(context));
    return command;
  }

  addCommandHelp(message: IHelpMessage) {
    this.helpMessageObj = { ...this.helpMessageObj, ...message };
    return this.helpMessageObj;
  }

  private async parseStringAndExecuteFound(
    bot: Bot,
    session: MessageSession,
    input?: string,
  ): Promise<CommandInstance[] | undefined> {
    if (input == undefined) {
      input = session.data.content.substring(this.prefix.length);
    }

    const response = await this.ctx.bail('command/before-parse', input, bot, session);
    // 如果 response 没被返回任何内容，则正常解析，如果返回了一个字符串则覆盖要解析的内容，如果返回了 false 则取消该指令解析
    if (response !== undefined) {
      if (typeof response == 'string') input = response;
      else if (!response) return;
    }

    const index: number = input.indexOf(' ');
    let commandInputMain: string, args: string;
    if (index !== -1) {
      commandInputMain = input.substring(0, index);
      args = input.substring(index + 1);
    } else {
      commandInputMain = input;
      args = '';
    }

    // 筛选符合特定情境的指令
    const meetCommands = [];

    for (let [context, command] of this._commands.entries()) {
      if (context.filter(session)) {
        meetCommands.push(...command);
      }
    }

    let commandArray: CommandInstance[] = [];
    for (const obj of meetCommands) {
      // 如果匹配到指令就直接结束
      if (commandInputMain === obj.name || obj.aliases.includes(commandInputMain)) {
        this.ctx.serial(session, 'command/before-execute', obj, bot, session).then((result) => {
          if (typeof result === 'string') {
            bot.sendMessage(session.channelId, result, { quote: session.data.msg_id });
          } else {
            obj
              .execute(args, bot, session)
              .then((r) => {
                if (r) this.ctx.parallel('command/execute', obj, bot, session);
              })
              // 此处会把所有指令调用时发生的错误捕获并发布，比如 bot.sendMessage 遇到错误时。
              .catch(obj.handleError);
          }
        });
        // 匹配到了就直接返回只有一个指令的数组
        /*        commandArray.push(obj);
        return commandArray;*/
        return;
      }
      // 没匹配到就把该指令放进相似指令匹配列表
      if (this.config.enableLikelyCommand) commandArray.push(obj);
    }

    // 默认使用 damerau-levenshtein，只有相似度达到 0.6 返回结果
    return search(commandInputMain, commandArray, { keySelector: (obj) => obj.name });
  }

  private async setupCommandParser(bot: Bot, session: MessageSession, next: Next) {
    if (!session.data.content.startsWith(this.prefix)) return next();

    const result = await this.parseStringAndExecuteFound(bot, session);

    if (!(result && result.length !== 0)) return;
    // 没有相似的，告诉用户找不到指令
    if (this.config.enableNotFoundMessage && result.length === 0) {
      const response = await this.ctx.bail('command/not-found', bot, session);
      // 返回任意内容则取消找不到相关指令的提示
      if (response !== undefined) return;
      await bot.sendMessage(session.channelId, '找不到相关指令', { quote: session.data.msg_id });
      return;
    }

    await bot.sendMessage(
      session.channelId,
      CardTemplate.CommandList(
        `相似指令提示 (指令前缀 "${this.prefix}")`,
        this.formatCommandListOutput(result),
        session.data.content,
        session.data.extra.author.avatar,
      ).toString(),
      {
        type: MessageType.card,
        quote: session.data.msg_id,
      },
    );
  }

  private formatCommandListOutput(commandList: CommandInstance[]) {
    return commandList.map((item) => ({
      name: `${item.name} ${item.aliases.length !== 0 ? `(${item.aliases.toString()})` : ''}`,
      description: item.description,
    }));
  }
}

export namespace Commander {
  export interface Config {
    commandPrefix?: string;
    enableLikelyCommand?: boolean;
    enableNotFoundMessage?: boolean;
    developerIds?: string[];
  }
  export const Config: Schema<Commander.Config> = Schema.object({
    commandPrefix: Schema.string().default('/'),
    enableLikelyCommand: Schema.boolean().default(true),
    enableNotFoundMessage: Schema.boolean().default(false),
    developerIds: Schema.array(String).default([]),
  });
}
