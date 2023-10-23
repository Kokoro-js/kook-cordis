import * as cordis from 'cordis';
import Schema from 'schemastery';
import uWS from 'uWebSockets.js';
import { KookEvent } from './events';
import { Data, IMessageButtonClickBody, PayLoad, Session } from './types';
import { logger } from './Logger';
import { Bot } from './bot';
import { internalWebhook } from './event-tigger';
import { FilterService, Processor, Commander, Routers, readJson } from './services';

export { uWS, readJson };

export interface Events<C extends Context = Context> extends cordis.Events<C>, KookEvent {
  // 'internal/webhook'(bot: Bot, obj: any): void;
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
    let pluginPath = options.pluginRouterPath || '/api';

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
        options.compressed,
      );
    });

    app.any(`${pluginPath}/*`, (res, req) => {
      const method = req.getMethod();
      const url = (req.getUrl() || '/').substring(pluginPath.length);

      if (this.$routers._routes[method] && this.$routers._routes[method][url]) {
        this.$routers._routes[method][url](res, req);
      } else {
        res.end('404 Not Found');
      }
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
    pluginRouterPath?: string;
    compressed: boolean;
    prompt_timeout?: number;
    commandPrefix?: string;
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      port: Schema.number().default(3000).required(),
      webhook: Schema.string().default('/kook').required(),
      pluginRouterPath: Schema.string().default('/api'),
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
Context.service('$routers', Routers);
