import * as cordis from 'cordis';
import Schema from 'schemastery';
import uWS, { HttpResponse } from 'uWebSockets.js';
import zlib from 'zlib';
import { KookEvent } from './events';
import { Data } from './types';
import { logger } from './Logger';
import { Bot } from './bot';

export interface Events<C extends Context = Context> extends cordis.Events<C>, KookEvent {}

export interface Context {
  [Context.config]: Context.Config;
  [Context.events]: Events<Context>;
  bots: Bot[];
}

export class Context extends cordis.Context {
  static readonly session = Symbol('session');

  constructor(options: Context.Config) {
    super(options);

    let port = options.port;
    let path = options.webhook;
    const webhookLogger = logger.child({ name: 'Webhook' });
    const app = uWS.App();

    app.post(path, async (res, req) => {
      readJson(
        res,
        options.compressed,
        (obj) => {
          webhookLogger.debug('webhook:data', '接收到 POST Body:' + obj);
          const data: Data<any> = obj.d;
          const verifyToken = data.verify_token;
          const bot = this.bots[verifyToken];
          if (!bot) {
            res.writeStatus('403 Bad Request').endWithoutBody();
            return;
          }

          if (data.channel_type == 'WEBHOOK_CHALLENGE') {
            const body = { challenge: data.challenge };
            res.writeStatus('200 OK').end(JSON.stringify(body));
            return;
          }
          res.writeStatus('200 OK').endWithoutBody();
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
}

export namespace Context {
  export interface Config extends cordis.Context.Config {
    port: number;
    webhook: string;
    compressed?: boolean;
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      port: Schema.number().default(3000).required(),
      webhook: Schema.string().default('/kook').required(),
      compressed: Schema.boolean().default(true),
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
      }
      cb(jsonData);
    }
  });

  // 处理客户端中止请求的情况

  res.onAborted(() => {});
}
