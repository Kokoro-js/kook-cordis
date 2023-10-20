import { Flags, typeFlag, TypeFlag } from 'type-flag';
import { Awaitable } from 'cosmokit';
import { MessageSession } from '../events';
import { MessageExtra } from '../types';
import { Bot } from '../bot';

export class CommandInstance<T extends Flags> {
  name: string;
  description: string;
  options: T;
  commandFunction: callbackFunction<T>;

  constructor(name: string, desc: string, options: T) {
    this.name = name;
    this.description = desc;
    this.options = options;
  }

  action(callback: callbackFunction<T>): void {
    this.commandFunction = callback;
  }

  async execute(possible: string, bot: Bot, session: MessageSession<MessageExtra>) {
    /*    const exe = this.commandFunction.bind(
      null,
      typeFlag(this.options, parseArgsStringToArgv(possible)),
      bot,
      session,
    );*/
    const result = await this.commandFunction(
      typeFlag(this.options, parseArgsStringToArgv(possible)),
      bot,
      session,
    );
    if (result) await bot.sendMessage(session.channelId, result);
  }
}

function parseArgsStringToArgv(value) {
  const args = [];
  let inQuotes = false;
  let escape = false;
  let arg = '';

  for (let i = 0; i < value.length; i++) {
    const current = value[i];

    if (escape) {
      arg += current;
      escape = false;
    } else if (current === '\\') {
      escape = true;
    } else if (current === '"') {
      inQuotes = !inQuotes;
    } else if (current === ' ' && !inQuotes) {
      if (arg.length > 0) {
        args.push(arg);
        arg = '';
      }
    } else {
      arg += current;
    }
  }

  if (arg.length > 0) {
    args.push(arg);
  }

  return args;
}

type callbackFunction<T extends Flags<Record<string, unknown>>> = (
  argv: TypeFlag<T>,
  bot: Bot,
  session: MessageSession<MessageExtra>,
) => Awaitable<void | string>;
