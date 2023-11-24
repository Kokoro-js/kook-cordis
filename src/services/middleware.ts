import { Awaitable, defineProperty } from 'cosmokit';
import { Context } from '../context';
import { createLogger } from '../Logger';
import { Bot } from '../bot';
import { Data, MessageExtra, MessageSession, Session } from '../types';

declare module '../context' {
  interface Context {
    $processor: Processor;

    middleware(middleware: Middleware, prepend?: boolean): () => boolean;
  }

  interface Events {
    'middleware'(bot: Bot, data: MessageSession): void;
  }
}

export type Next = (next?: Next.Callback) => Promise<void | string>;
export type Middleware = (
  bot: Bot,
  session: Session<Data<MessageExtra>>,
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
  // 不用 Map 来一个 Context 对应数个 Middlewares 优化的原因是要保证顺序
  _hooks: [Context, Middleware][] = [];
  protected _logger = createLogger('Middleware');

  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx);

    // 将中间件处理逻辑绑定到 message 事件触发，并绑定 this(Processor) 避免在函数里 this 到事件的 thisArgs
    ctx.on('message', this._handleMessage.bind(this));
  }

  protected get caller() {
    return this[Context.current] as Context;
  }

  middleware(middleware: Middleware, prepend = false) {
    return this.caller.lifecycle.register('middleware', this._hooks, middleware, prepend);
  }

  private async _handleMessage(bot: Bot, session: MessageSession<any>) {
    // 筛选出符合特定 session 内容的中间件组成数组
    const queue: Next.Queue = this._hooks
      .filter(([context]) => context.filter(session))
      .map(([, middleware]) => middleware.bind(null, bot, session));

    // 开始执行中间件，从第一个开始
    let index = 0;
    const next: Next = async (callback) => {
      try {
        // 支持动态添加新的中间件函数
        if (callback !== undefined) {
          // 将新的中间件函数添加到队列末尾
          queue.push((next) => Next.compose(callback, next));
          if (queue.length > Next.MAX_DEPTH) {
            throw new Error(`middleware stack exceeded ${Next.MAX_DEPTH}`);
          }
        }
        // 执行当前中间件函数，index 自增，并将 next 函数作为参数传递给它
        // 如果中间件函数内部调用了 next()，则会递归调用下一个中间件函数，实现洋葱模型
        return await queue[index++]?.(next);
      } catch (error) {
        this._logger.warn(error);
      }
    };

    // 调用 next() 函数触发中间件执行，并获取 await queue[最后一个中间件] 的执行结果
    // 如果结果是一个字符串，我们将其作为信息发送出去
    try {
      const result = await next();
      if (result) await bot.sendMessage(session.channelId, result, { quote: session.data.msg_id });
    } finally {
      this.ctx.emit(session, 'middleware', bot, session);
    }
  }
}
