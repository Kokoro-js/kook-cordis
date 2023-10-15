import { Context } from './context';
import { defineProperty, isNullable, remove } from 'cosmokit';
import { logger } from './Logger';
import Schema from 'schemastery';
import pino from 'pino';
import axios, { AxiosInstance } from 'axios';
import { AbstactBot } from './api/api';
import { IBaseResponse, UserME } from './api/types/base';
import { Session } from './filter';

export class Bot extends AbstactBot {
  static reusable = true;
  readonly verifyToken: string;
  readonly token: string;
  logger: pino.Logger<{ name: string }>;
  readonly http: AxiosInstance;
  userME: UserME;
  protected context: Context;

  constructor(
    public ctx: Context,
    public config: Bot.Config,
  ) {
    super();
    this.context = ctx;
    this.verifyToken = config.verifyToken;
    this.token = config.token;
    this.logger = logger.child({ name: `bot-${this.verifyToken}` });
    defineProperty(Bot, 'filter', false);
    this.http = axios.create({
      baseURL: 'https://www.kookapp.cn', // 设置基本的URL
      headers: {
        Authorization: `Bot ${this.token}`, // 设置授权头
      },
    });

    this.ctx.bots.push(this);
    ctx.start();
    ctx.on('ready', async () => {
      return this.start();
    });

    ctx.on('dispose', () => this.dispose());
  }

  protected async start() {
    try {
      const response = await this.http.get('/api/v3/user/me');
      const data = response.data as IBaseResponse<UserME>;
      if (data.code !== 0) {
        this.logger.error('机器人获取自身信息失败');
      }
      this.userME = data.data;
    } catch (error) {
      this.logger.error('启动机器人失败，请检查 Token 是否相符。');
      this.dispose();
      throw error;
    }
  }

  protected dispose() {
    remove(this.ctx.bots, this);
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
