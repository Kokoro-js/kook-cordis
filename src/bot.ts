import { Context } from './context';
import { remove } from 'cosmokit';
import { logger } from './Logger';
import Schema from 'schemastery';
import pino from 'pino';
import axios, { AxiosInstance } from 'axios';

export class Bot {
  verifyToken: string;
  token: string;
  logger: pino.Logger<{ name: string }>;
  http: AxiosInstance;
  protected context: Context;

  constructor(
    public ctx: Context,
    public config: Bot.Config,
  ) {
    this.context = ctx;
    this.verifyToken = config.verifyToken;
    this.token = config.token;
    this.logger = logger.child({ name: `bot-${this.verifyToken}` });
    this.http = axios.create({
      baseURL: 'https://www.kookapp.cn', // 设置基本的URL
      headers: {
        Authorization: `Bot ${this.token}`, // 设置授权头
      },
    });

    this.http.get('/api/v3/user/me').then((r) => logger.info(r.data));
    ctx.bots.push(this); // this.context.emit('bot-added', this);
  }
}

export namespace Bot {
  export interface Config {
    verifyToken: string;
    token: string;
  }

  export const Config: Schema<Config> = Schema.object({
    verifyToken: Schema.string().required(),
    token: Schema.string().required(),
  });
}
