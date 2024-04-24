import { Data, PayLoad } from './types';
import { Bot } from './bot';
import { internalWebhook } from './event-trigger';
import { logger } from './Logger';
import { readJson } from './services';
import { Context } from './context';

export default function setupUWSJS(
  config: {
    path: string;
    pluginPath: string;
    port: number;
    isExpectCompressed: boolean;
  },
  ctx: Context,
  webhookLogger,
) {
  const app = require('uWebSockets.js').App();
  app.post(config.path, (res, req) => {
    readJson(
      res,
      (obj: PayLoad) => {
        webhookLogger.trace(obj, '接收到 POST Body');
        const data: Data<any> = obj.d;
        const verifyToken = data.verify_token;
        const bot: Bot = ctx.bots[verifyToken];
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
      config.isExpectCompressed,
    );
  });

  app.any(`${config.pluginPath}/*`, (res, req) => {
    const method = req.getMethod();
    const url = (req.getUrl() || '/').substring(config.pluginPath.length);

    if (ctx.$routers._routes[method] && ctx.$routers._routes[method][url]) {
      ctx.$routers._routes[method][url](res, req);
    } else {
      res.end('404 Not Found');
    }
  });

  app.listen(config.port, (token) => {
    if (token) {
      logger.info('Listening to port ' + config.port);
    } else {
      logger.fatal('Failed to listen to port ' + config.port);
    }
  });
}
