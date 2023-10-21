import * as cordis from 'cordis';
import Schema from 'schemastery';
import uWS, { HttpResponse } from 'uWebSockets.js';
import zlib from 'zlib';
import { KookEvent } from './events';
import {
  Data,
  IMessageButtonClickBody,
  MessageExtra,
  MessageSession,
  PayLoad,
  Session,
} from './types';
import { logger } from './Logger';
import { Bot } from './bot';
import { internalWebhook } from './event-tigger';
import { FilterService, Processor, Commander, CommandInstance } from './services';
import { Awaitable } from 'cosmokit';

export interface Events<C extends Context = Context> extends cordis.Events<C>, KookEvent {
  // 'internal/webhook'(bot: Bot, obj: any): void;
  'command/before-execute'(
    command: CommandInstance<any>,
    bot: Bot,
    session: MessageSession<MessageExtra>,
  ): Awaitable<void | string>;
}

export type EffectScope = cordis.EffectScope<Context>;
export type ForkScope = cordis.ForkScope<Context>;
export type MainScope = cordis.MainScope<Context>;
export type Service = cordis.Service<Context>;

export const Service = cordis.Service<Context>;

export type { Disposable, ScopeStatus } from 'cordis';

export interface Context {
  [Context.config]: Context.Config;
  [Context.events]: Events<Context>;
  bots: Bot[];
}

export class Context extends cordis.Context {
  static readonly session = Symbol('session');
  prompt_timeout: number;

  constructor(options: Context.Config) {
    super(options);

    let port = options.port;
    let path = options.webhook;
    this.prompt_timeout = options.prompt_timeout || 5000;

    this.on('internal/warning', (format, ...args) => {
      logger.warn(format, ...args);
    });
    // 避免再注册一个插件添加 Webhook 的处理时间
    // this.plugin(require('./event-tigger'));
    const webhookLogger = logger.child({ name: 'webhook' });
    const app = uWS.App();

    app.post(path, (res, req) => {
      readJson(
        res,
        options.compressed,
        (obj: PayLoad) => {
          webhookLogger.debug(obj, '接收到 POST Body');
          const data: Data<any> = obj.d;
          const verifyToken = data.verify_token;
          const bot: Bot = this.bots[verifyToken];
          if (!bot) {
            res.writeStatus('403 Bad Request').end();
            return;
          }

          if (data.channel_type == 'WEBHOOK_CHALLENGE') {
            const body = { challenge: data.challenge };
            res.writeStatus('200 OK').end(JSON.stringify(body));
            return;
          }
          res.writeStatus('200 OK').end();

          // 避免再注册一个插件添加 Webhook 的处理时间
          // @ts-ignore
          // this.emit('internal/webhook', bot, data);

          internalWebhook(this, bot, data);
        },
        (message: string) => {
          webhookLogger.error(message);
        },
      );
    });

    app.listen(port, (token) => {
      if (token) {
        logger.info('Listening to port ' + port);
      } else {
        logger.fatal('Failed to listen to port ' + port);
      }
    });
  }

  prompt(current: Session<any>, timeout = this.prompt_timeout) {
    return new Promise<string>((resolve) => {
      const dispose = this.middleware(async (bot, session, next) => {
        if (session.userId !== current.userId || session.selfId !== current.selfId) return next();
        clearTimeout(timer);
        dispose();
        resolve(session.data.content);
      }, true);
      const timer = setTimeout(() => {
        dispose();
        resolve(undefined);
      }, timeout);
    });
  }

  suggest(current: Session<any>, timeout = this.prompt_timeout) {
    return new Promise<IMessageButtonClickBody>((resolve) => {
      const dispose = this.on(
        'button-click',
        async (bot, session) => {
          if (session.userId !== current.userId || session.selfId !== current.selfId) return;
          clearTimeout(timer);
          dispose();
          resolve(session.data.extra.body);
        },
        true,
      );
      const timer = setTimeout(() => {
        dispose();
        resolve(undefined);
      }, timeout);
    });
  }
}
export namespace Context {
  export interface Config extends cordis.Context.Config {
    port: number;
    webhook: string;
    compressed: boolean;
    prompt_timeout?: number;
    commandPrefix?: string;
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      port: Schema.number().default(3000).required(),
      webhook: Schema.string().default('/kook').required(),
      compressed: Schema.boolean().default(true).required(),
      prompt_timeout: Schema.natural().default(5000),
      commandPrefix: Schema.string().default('/'),
    }),
  ]);

  namespace Config {
    export interface Static extends Schema<Config> {}
  }
}

Context.service(
  'bots',
  class {
    constructor(root: Context) {
      const list: Bot[] = [];
      return new Proxy(list, {
        get(target, prop) {
          if (prop in target || typeof prop === 'symbol') {
            return target[prop];
          }
          return list.find((bot) => bot.verifyToken === prop);
        },
        deleteProperty(target, prop) {
          if (prop in target || typeof prop === 'symbol') {
            return delete target[prop];
          }
          const bot = target.findIndex((bot) => bot.verifyToken === prop);
          if (bot < 0) return true;
          target.splice(bot, 1);
          return true;
        },
      });
    }
  },
);

Context.service('$filter', FilterService);
Context.service('$internal', Processor);
Context.service('$commander', Commander);

function readJson(
  res: HttpResponse,
  compressed: boolean,
  cb: { (obj: any): void },
  err: (message: string) => void,
) {
  let buffer: Buffer;

  // 注册
  res.onData((ab, isLast) => {
    const chunk = Buffer.from(ab);
    if (buffer) {
      buffer = Buffer.concat([buffer, chunk]);
    } else {
      buffer = Buffer.from(chunk);
    }

    if (isLast) {
      let jsonData;
      if (compressed) {
        zlib.inflate(buffer, (inflateErr, result) => {
          if (inflateErr) {
            // 发生解压缩错误时发送适当的错误响应给客户端
            err('解压遇到了错误' + inflateErr.message);
            res.close();
            return;
          }

          try {
            const decodedData = result.toString('utf8');
            jsonData = JSON.parse(decodedData);
          } catch (e) {
            // 发生JSON解析错误时发送适当的错误响应给客户端
            err('解析遇到了错误' + e.message);
            res.close();
            return;
          }
          cb(jsonData);
        });
      } else {
        try {
          const decodedData = buffer.toString('utf8');
          jsonData = JSON.parse(decodedData);
        } catch (e) {
          // 发生JSON解析错误时发送适当的错误响应给客户端
          err('解析遇到了错误' + e.message);
          res.close();
          return;
        }
        cb(jsonData);
      }
    }
  });

  // 处理客户端中止请求的情况

  res.onAborted(() => {});
}
