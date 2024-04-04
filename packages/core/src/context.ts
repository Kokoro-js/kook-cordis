import * as cordis from 'cordis';
import Schema from 'schemastery';
import { KookEvent, ServiceContext, ServiceEvent } from './events';
import { Data, IMessageButtonClickBody, PayLoad, Session, SystemExtra } from './types';
import { logger } from './Logger';
import { Bot } from './bot';
import { internalWebhook } from './event-trigger';
import { Commander, FilterService, Processor, Quester, Routers } from './services';
import { defineProperty, Dict } from 'cosmokit';
import setupUWSJS from './NodeWebServer';

export { Quester };

export interface Events<C extends Context = Context>
  extends cordis.Events<C>,
    KookEvent,
    ServiceEvent {
  // 'internal/webhook'(bot: Bot, obj: any): void;
}

export type EffectScope = cordis.EffectScope<Context>;
export type ForkScope = cordis.ForkScope<Context>;
export type MainScope = cordis.MainScope<Context>;
export type Service = cordis.Service<Context>;

export const Service = cordis.Service<Context>;

export type { Disposable, ScopeStatus } from 'cordis';

export interface Context extends ServiceContext {
  [Context.config]: Context.Config;
  [Context.events]: Events;
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
    ]);
    this.mixin('$processor', ['middleware']);
    this.mixin('$commander', ['command', 'commands', 'executeString', 'addCommandHelp']);
    this.mixin('$routers', ['router']);
  }

  private setupProviders() {
    this.provide('$filter', new FilterService(this), true);
    this.provide('$processor', new Processor(this), true);
    this.provide('$commander', new Commander(this), true);
    this.provide('$routers', new Routers(this), true);
  }

  private setupWebServer(config: Context.Config) {
    const path = config.webhook;
    if (!path) return;

    const port = config.port;
    const pluginPath = config.pluginRouterPath;
    const isExpectCompressed = config.compressed;
    const webhookLogger = logger.child({ name: 'webhook' });
    const ctx = this;
    if (process.versions.bun == undefined) {
      setupUWSJS({ port, pluginPath, isExpectCompressed, path }, ctx, webhookLogger);
      return;
    }
    // 如果是在 Bun 下运行的

    Bun.serve({
      fetch(req) {
        const url = new URL(req.url);
        const urlPath = url.pathname;
        webhookLogger.trace(urlPath);
        // 对于 POST 请求的处理
        if (req.method === 'POST' && urlPath === path) {
          return req
            .arrayBuffer()
            .then((buffer) => {
              let dataPromise;

              // 根据 compressed 决定是否解压数据
              if (isExpectCompressed) {
                // 使用 Bun 的 zlib 解压
                dataPromise = Bun.inflateSync(buffer);
              } else {
                // 直接使用未压缩的数据
                dataPromise = Promise.resolve(buffer);
              }

              return dataPromise.then((data: AllowSharedBufferSource) => {
                // 假设解压缩后的数据是 JSON 格式的
                const obj = JSON.parse(new TextDecoder().decode(data));
                webhookLogger.trace(obj, '接收到 POST Body');

                const dataObj = obj.d;
                const verifyToken = dataObj.verify_token;
                const bot = ctx.bots[verifyToken];
                if (!bot) {
                  return new Response(null, { status: 403 });
                }

                if (dataObj.channel_type == 'WEBHOOK_CHALLENGE') {
                  const body = { challenge: dataObj.challenge };
                  return new Response(JSON.stringify(body), { status: 200 });
                }

                // 逻辑处理...
                internalWebhook(ctx, bot, dataObj);

                return new Response(null, { status: 200 });
              });
            })
            .catch((error) => {
              webhookLogger.error(error);
              return new Response(null, { status: 500 });
            });
        }

        // 对于其他类型请求的处理
        const method = req.method.toLowerCase();
        const routes = ctx.$routers._routes;
        if (routes[method] && routes[method][urlPath]) {
          return routes[method][urlPath](req);
        } else {
          return new Response('404 Not Found', { status: 404 });
        }
      },
      port: port,
    });

    webhookLogger.info(`Bun 服务器正在端口 ${port} 上运行。`);
  }
}

export namespace Context {
  export interface Config extends cordis.Context.Config {
    port: number;
    webhook?: string;
    pluginRouterPath?: string;
    compressed?: boolean;
    prompt_timeout?: number;
    commandPrefix?: string;
    developerIds?: string[];
    request?: Quester.Config;
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      port: Schema.number().default(3000).required(),
      webhook: Schema.string(),
      pluginRouterPath: Schema.string().default('/api'),
      compressed: Schema.boolean().default(true),
      prompt_timeout: Schema.natural().default(5000),
      commandPrefix: Schema.string().default('/'),
      developerIds: Schema.array(Schema.string()).default([]),
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
