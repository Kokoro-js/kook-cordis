import * as cordis from 'cordis';
import Schema from 'schemastery';
import uWS from 'uWebSockets.js';
import { KookEvent } from './events';
import { Data, IMessageButtonClickBody, PayLoad, Session, SystemExtra } from './types';
import { logger } from './Logger';
import { Bot } from './bot';
import { internalWebhook } from './event-tigger';
import { Commander, FilterService, Processor, Quester, readJson, Routers } from './services';
import { defineProperty, Dict } from 'cosmokit';

export { uWS, Quester, readJson };

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
  bots: Bot[] & Dict<Bot>;
  http: Quester;
}

export class Context extends cordis.Context {
  static readonly session = Symbol('session');
  public baseDir = process.cwd();
  public bots = new Proxy([], {
    get(target, prop) {
      if (prop in target || typeof prop === 'symbol') {
        return Reflect.get(target, prop);
      }
      return target.find((bot) => bot.verifyToken === prop);
    },
    deleteProperty(target, prop) {
      if (prop in target || typeof prop === 'symbol') {
        return Reflect.deleteProperty(target, prop);
      }
      const bot = target.findIndex((bot) => bot.verifyToken === prop);
      if (bot < 0) return true;
      target.splice(bot, 1);
      return true;
    },
  }) as Bot[] & Dict<Bot>;

  constructor(options: Context.Config) {
    super(options);

    this.root.config = new Context.Config(options);
    this.http = new Quester(this.root.config.request);

    this.setupMixins();
    this.setupProviders();
    this.setupWebServer(this.root.config);

    this.on('internal/warning', function (format, ...args) {
      logger.warn(format, ...args);
    });
  }

  prompt(current: Session<any>, timeout = this.root.config.prompt_timeout) {
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

  suggest(current: Session<any>, timeout = this.root.config.prompt_timeout) {
    return new Promise<Data<SystemExtra<IMessageButtonClickBody>>>((resolve) => {
      const dispose = this.on(
        'serial-button-click',
        async (bot, session) => {
          if (session.userId !== current.userId || session.selfId !== current.selfId) return;
          clearTimeout(timer);
          dispose();
          resolve(session.data);
        },
        true,
      );
      const timer = setTimeout(() => {
        dispose();
        resolve(undefined);
      }, timeout);
    });
  }

  private setupMixins() {
    this.mixin('$filter', [
      'any',
      'never',
      'union',
      'intersect',
      'exclude',
      'user',
      'self',
      'guild',
      'channel',
      'private',
      'mergeFilterData',
      'removeFilterData',
      'addAndFilterToThis',
      'addOrFilterToThis',
    ]);
    this.mixin('$processor', ['middleware']);
    this.mixin('$commander', ['command', 'addCommandHelp']);
    this.mixin('$routers', ['router']);
  }

  private setupProviders() {
    this.provide('$filter', new FilterService(this), true);
    this.provide('$processor', new Processor(this), true);
    this.provide('$commander', new Commander(this), true);
    this.provide('$routers', new Routers(this), true);
  }

  private setupWebServer(config: Context.Config) {
    const app = uWS.App();
    const webhookLogger = logger.child({ name: 'webhook' });
    const path = config.webhook;
    const port = config.port;
    const pluginPath = config.pluginRouterPath;

    app.post(path, (res, req) => {
      readJson(
        res,
        (obj: PayLoad) => {
          webhookLogger.trace(obj, '接收到 POST Body');
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
        config.compressed,
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
}

export namespace Context {
  export interface Config extends cordis.Context.Config {
    port: number;
    webhook: string;
    pluginRouterPath?: string;
    compressed?: boolean;
    prompt_timeout?: number;
    commandPrefix?: string;
    request?: Quester.Config;
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      port: Schema.number().default(3000).required(),
      webhook: Schema.string().default('/kook').required(),
      pluginRouterPath: Schema.string().default('/api'),
      compressed: Schema.boolean().default(true),
      prompt_timeout: Schema.natural().default(5000),
      commandPrefix: Schema.string().default('/'),
    }),
    Quester.Config,
  ]);

  namespace Config {
    export interface Static extends Schema<Config> {}
  }
}

declare module './services/axios' {
  namespace Quester {
    export const Config: Schema<Config>;

    export function createConfig(this: typeof Quester, endpoint?: string | boolean): Schema<Config>;
  }
}

defineProperty(
  Quester,
  'Config',
  Schema.object({
    timeout: Schema.natural().role('ms').description('等待连接建立的最长时间。'),
    proxyAgent: Schema.string().description('使用的代理服务器地址。'),
  }).description('请求设置'),
);

Quester.createConfig = function createConfig(this, endpoint) {
  return Schema.object({
    endpoint: Schema.string()
      .role('link')
      .description('要连接的服务器地址。')
      .default(typeof endpoint === 'string' ? endpoint : null)
      .required(typeof endpoint === 'boolean' ? endpoint : false),
    headers: Schema.dict(String).role('table').description('要附加的额外请求头。'),
    ...this.Config.dict,
  }).description('请求设置');
};
