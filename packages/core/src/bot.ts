import { Context } from './context';
import { defineProperty, remove } from 'cosmokit';
import { createLogger, logger } from './Logger';
import Schema from 'schemastery';
import pino from 'pino';
import axios, { AxiosInstance } from 'axios';
import { AbstactBot } from './api';
import { IBaseAPIResponse, UserME } from './types';
import WSClient from './WSClient';

export class Bot extends AbstactBot {
  static reusable = true;
  readonly verifyToken: string;
  readonly token: string;
  readonly logger: pino.Logger;
  readonly http: AxiosInstance;
  userME: UserME;
  protected context: Context;
  private ws: WSClient;

  constructor(
    public ctx: Context,
    public config: Bot.Config,
  ) {
    super();
    this.context = ctx;
    ({ verifyToken: this.verifyToken, token: this.token } = this.config);
    this.logger = createLogger(`bot-${this.verifyToken}`);
    defineProperty(Bot, 'filter', false);
    this.http = axios.create({
      baseURL: 'https://www.kookapp.cn', // 设置基本的URL
      headers: {
        Authorization: `Bot ${this.token}`, // 设置授权头
      },
    });

    this.ctx.bots.push(this);

    ctx.start().catch((e) => {
      this.logger.error(e);
      ctx.stop();
    });

    ctx.on('ready', () => {
      return this.start();
    });

    ctx.on('dispose', () => this.dispose());
  }

  protected async start() {
    const response = await this.http.get('/api/v3/user/me');
    const data = response.data as IBaseAPIResponse<UserME>;
    if (data.code !== 0) {
      throw new Error('机器人获取自身信息失败。');
    }
    this.userME = data.data;
    // 如果未设置 webhook 则尝试 ws。
    if (this.ctx.root.config.webhook !== undefined) return;

    const { data: ws } = await this.http.get<{ bot: string; code: number; data: { url: string } }>(
      '/api/v3/gateway/index?compress=0',
    );
    if (ws.code !== 0) throw new Error('机器人尝试获取 WS 链接失败。');
    this.ws = new WSClient(ws.data.url, this);
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
