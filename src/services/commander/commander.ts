import { Awaitable, defineProperty, Dict } from 'cosmokit';
import { Context } from '../../context';

import { CommandInstance } from './command';
import { Flags } from 'type-flag';
import { logger } from '../../Logger';

import { search } from 'fast-fuzzy';
import { MessageExtra, MessageSession, MessageType } from '../../types';
import { Bot } from '../../bot';
import { Next } from '../middleware';
import { CardTemplate } from './Template';

export { CommandInstance };

export type IHelpMessage = Dict<IHelpContent>;

export type IHelpContent = {
  description: string;
  required?: Dict<string>;
  optional?: Dict<string>;
  flags?: Dict<string>;
};

declare module '../../context' {
  interface Context {
    $commander: Commander;

    command<T extends Flags<Record<string, unknown>>, P extends string>(
      commandName: P,
      description: string,
      options: T,
    ): CommandInstance<T, P>;

    get commands(): CommandInstance[];

    addCommandHelp(message: IHelpMessage): IHelpMessage;
  }

  interface Events {
    'command/before-parse'(
      input: string,
      bot: Bot,
      session: MessageSession<MessageExtra>,
    ): Awaitable<void | string | boolean>;

    'command/before-execute'(
      command: CommandInstance,
      bot: Bot,
      session: MessageSession<MessageExtra>,
    ): Awaitable<void | string>;

    'command/execute'(
      command: CommandInstance,
      bot: Bot,
      session: MessageSession<MessageExtra>,
    ): void;
  }
}

export class Commander {
  _commands: Map<Context, CommandInstance[]> = new Map();
  prefix: string;
  helpCommand: CommandInstance; // 方便别人添加检查
  helpMessageObj: IHelpMessage = {
    help: { description: '提供指令相关帮助', required: { command: '指令名称' } },
  };

  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx);
    this.prefix = ctx.scope.config.commandPrefix;

    ctx.middleware(this.setupCommandParser.bind(this), true); // 前置中间件保证指令得到优先处理

    this.helpCommand = this.command('help [command]', '指令帮助', {}).action(
      (argv, bot, session) => {
        const meetCommands: CommandInstance[] = [];

        for (let [context, command] of this._commands.entries()) {
          if (context.filter(session)) {
            meetCommands.push(...command);
          }
        }

        // 没有指令则列出所有指令
        if (!argv.command) {
          bot.sendMessage(
            session.channelId,
            CardTemplate.CommandList(
              '指令帮助',
              this.formatCommandListOutput(meetCommands),
              session.data.content,
              session.data.extra.author.avatar,
            ),
            {
              type: MessageType.card,
              quote: session.data.msg_id,
            },
          );
          return;
        }

        for (const obj of meetCommands) {
          if (obj.name == argv.command) {
            const content = this.helpMessageObj[obj.name];
            if (!content) {
              return `指令 **${obj.name}** - ${
                obj.description
              }\n **必填参数** ${obj.requiredMatches.toString()}\n **选填参数** ${obj.optionalMatches.toString()}\n **标签** ${Object.keys(
                obj.options,
              )}`;
            }
            bot.sendMessage(
              session.channelId,
              CardTemplate.HelpCardTemplate(
                `${obj.name} ${obj.aliases.length !== 0 ? `(${obj.aliases.toString()})` : ''}`,
                content,
              ),
              {
                type: MessageType.card,
                quote: session.data.msg_id,
              },
            );
            return;
          }
        }
        return `没有找到指令 ${argv.command}`;
      },
    );
  }

  protected get caller() {
    return this[Context.current] as Context;
  }

  get commands() {
    return this._commands.get(this.caller);
  }

  command<T extends Flags<Record<string, unknown>>, P extends string>(
    commandName: P,
    description: string,
    options: T,
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

  private async setupCommandParser(bot: Bot, session: MessageSession<MessageExtra>, next: Next) {
    if (!session.data.content.startsWith(this.prefix)) return next();
    let input = session.data.content.substring(this.prefix.length);

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
              .catch((e) => logger.error(e));
          }
        });

        return;
      }
      // 没匹配到就把该指令放进相似指令匹配列表
      commandArray.push(obj);
    }

    // 默认使用 damerau-levenshtein，只有相似度达到 0.6 返回结果
    const result = search(commandInputMain, commandArray, { keySelector: (obj) => obj.name });

    // 没有相似的，告诉用户找不到指令
    if (result.length === 0) {
      bot.sendMessage(session.channelId, '找不到相关指令', { quote: session.data.msg_id });
      return;
    }

    bot.sendMessage(
      session.channelId,
      CardTemplate.CommandList(
        '相似指令提示',
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
