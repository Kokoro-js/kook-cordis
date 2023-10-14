import { Awaitable, defineProperty, Dict, makeArray, Time } from 'cosmokit';
import { Session } from './filter';
import { Context } from './context';
import { logger } from './Logger';
import { Bot } from './bot';
import { Data, MessageExtra } from './types';

declare module './context' {
  interface Context {
    $internal: Processor;

    middleware(middleware: Middleware, prepend?: boolean): () => boolean;
  }

  interface Events {
    'middleware'(bot: Bot, data: Data<MessageExtra>): void;
  }
}

export class SessionError extends Error {
  constructor(
    public path: string | string[],
    public param?: Dict,
  ) {
    super(makeArray(path)[0]);
  }
}

export type Next = (next?: Next.Callback) => Promise<void | string>;
export type Middleware = (
  bot: Bot,
  data: Data<MessageExtra>,
  session: Session,
  next: Next,
) => Awaitable<void | string>;

export namespace Next {
  export const MAX_DEPTH = 64;

  export type Queue = ((next?: Next) => Awaitable<void | string>)[];
  export type Callback = void | string | ((next?: Next) => Awaitable<void | string>);

  export async function compose(callback: Callback, next?: Next) {
    return typeof callback === 'function' ? callback(next) : callback;
  }
}

export class Processor {
  static readonly methods = ['middleware', 'match'];

  _hooks: [Context, Middleware][] = [];

  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx);

    // bind built-in event listeners
    ctx.on('message', this._handleMessage.bind(this));
  }

  private async _handleMessage(bot, data, session: Session) {
    const queue: Next.Queue = this._hooks
      .filter(([context]) => context.filter(session))
      .map(([, middleware]) => middleware.bind(null, bot, data, session));

    // execute middlewares
    let index = 0;
    const next: Next = async (callback) => {
      try {
        if (callback !== undefined) {
          queue.push((next) => Next.compose(callback, next));
          if (queue.length > Next.MAX_DEPTH) {
            throw new Error(`middleware stack exceeded ${Next.MAX_DEPTH}`);
          }
        }
        return await queue[index++]?.(next);
      } catch (error) {
        logger.warn(error);
      }
    };

    try {
      const result = await next();
      if (result) await bot.sendMessage(session.channelId, result);
    } finally {
      // @ts-ignore
      this.ctx.emit(session, 'middleware', bot, data);
    }
  }
  protected get caller() {
    return this[Context.current] as Context;
  }

  middleware(middleware: Middleware, prepend = false) {
    return this.caller.lifecycle.register('middleware', this._hooks, middleware, prepend);
  }
}
