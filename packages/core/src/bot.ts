import { Context } from './context';
import { defineProperty, remove } from 'cosmokit';
import { createLogger } from './Logger';
import Schema from 'schemastery';
import pino from 'pino';
import axios, { AxiosInstance } from 'axios';
import { AbstactBot } from './api';
import { IBaseAPIResponse, UserME } from './types';
import WSClient from './WSClient';
import { Kafka } from 'kafkajs';
import { Packr, unpack } from 'msgpackr';
import { internalWebhook } from './event-trigger';

export class Bot extends AbstactBot {
  static reusable = true;
  static _retryCount = 0;
  static _maxRetryCount = 3;
  private packr;
  readonly verifyToken: string;
  readonly token: string;
  readonly logger: pino.Logger;
  readonly http: AxiosInstance;
  userME: UserME;
  private ws: WSClient;
  private webhookKeepAlive;

  constructor(
    public ctx: Context,
    public config: Bot.Config,
  ) {
    super();
    ({ verifyToken: this.verifyToken, token: this.token } = this.config);
    this.packr = new Packr({
      structures: this.ctx.root.config.msgpackr_structure,
      mapsAsObjects: true,
    });
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
    if (Bot._retryCount > Bot._maxRetryCount) {
      throw new Error(`机器人错误重启次数已达到上限 ${Bot._maxRetryCount} 次。`);
    }
    this.userME = data.data;
    // 如果未设置 webhook 则尝试 ws。
    if (this.ctx.root.config.kafka_brokers.length !== 0) {
      const id = this.userME.id;
      const kafka = new Kafka({
        clientId: `cordis_${id}`,
        brokers: this.ctx.root.config.kafka_brokers,
      });
      this.logger.info(id);
      const consumer = kafka.consumer({
        groupId: 'cordis',
        sessionTimeout: 6000,
      });
      await consumer.connect();
      await consumer.subscribe({ topic: `kook_${id}_msg` });
      await consumer.subscribe({ topic: `kook_${id}_event` });
      this.ctx.scope.disposables.push(() => {
        consumer.disconnect().then(() => this.logger.info('Consumer 已离线。'));
      });

      consumer
        .run({
          eachMessage: async ({ topic, partition, message }) => {
            let data;
            if (topic[topic.length - 1] == 'g') {
              data = this.packr.unpack(message.value);
            } else {
              data = unpack(message.value);
            }
            this.logger.debug(data, '收到事件数据：');
            internalWebhook(this.ctx, this, data);
          },
        })
        .catch((e) => {
          this.logger.error(e, '处理事件遇到错误。');
          this.ctx.scope.dispose();
        });
    } else if (this.ctx.root.config.webhook == undefined) {
      const { data: ws } = await this.http.get<{
        bot: string;
        code: number;
        data: { url: string };
      }>('/api/v3/gateway/index?compress=0');
      if (ws.code !== 0) throw new Error('机器人尝试获取 WS 链接失败。');
      this.ws = new WSClient(ws.data.url, this);
      return;
    } else {
      this.webhookKeepAlive = setInterval(async () => {
        const { data: status } = await this.http.get<{ code: number; data: { online: boolean } }>(
          '/api/v3/user/get-online-status',
        );
        if (status.code !== 0) {
          this.logger.error('机器人获取自身在线状态失败。');
          return;
        }
        if (status.data.online == false) {
          const { data } = await this.http.post('/api/v3/user/online');
          if (data.code !== 0) {
            this.logger.error('机器人自启失败。');
            Bot._retryCount++;
            clearInterval(this.webhookKeepAlive);
            this.ctx.scope.restart();
          }
        }
      }, 10000);
    }
  }

  protected dispose() {
    remove(this.ctx.bots, this);
    clearInterval(this.webhookKeepAlive);
  }
}

export namespace Bot {
  export interface Config {
    verifyToken?: string;
    token: string;
  }

  export const Config: Schema<Config> = Schema.object({
    verifyToken: Schema.string().default(''),
    token: Schema.string().required(),
  });
}
