import WebSocket from 'ws';
import { logger } from './Logger';
import pino from 'pino';
import { PayLoad } from './types';
import { Time } from 'cosmokit';
import { Bot } from './bot';
import { internalWebhook } from './event-trigger';
import EventEmitter from 'events';

const heartbeatIntervals = [6, 2, 4];

export default class WSClient extends EventEmitter {
  static _retryCount = 0;
  _maxRetryCount = 5;
  socket: WebSocket;
  wsLogger: pino.Logger;
  _sn = 0;
  private _ping: NodeJS.Timer | null = null;
  private _heartbeat: NodeJS.Timer | null = null;
  private url: string;
  private bot: Bot;

  constructor(url: string, bot: Bot) {
    super();
    this.url = url;
    this.bot = bot;
    this.wsLogger = logger.child({ name: 'websocket' });
    this.connect();
  }

  private connect() {
    this.wsLogger.info(`Connecting to ${this.url}`);
    this.socket = new WebSocket(this.url);

    this.socket.on('open', () => {
      this.wsLogger.info(`Successfully connected to ${this.url}`);
      this.emit('connected');
      clearInterval(this._heartbeat!);
      this._heartbeat = setInterval(() => this.heartbeat(), Time.minute * 0.5);
    });

    this.socket.on('message', (data) => {
      let parsed: PayLoad;
      try {
        parsed = JSON.parse(data.toString());
      } catch (error) {
        this.wsLogger.warn('Cannot parse message', data);
        return;
      }

      this.wsLogger.debug('[receive] %o', parsed);
      if (parsed.s === Signal.event) {
        if (parsed.d.author_id === this.bot.userME.id) return;
        this._sn = Math.max(this._sn, parsed.sn);
        internalWebhook(this.bot.ctx, this.bot, parsed.d);
      } else if (parsed.s === Signal.hello) {
        this._heartbeat = setInterval(() => this.heartbeat(), Time.minute * 0.5);
      } else if (parsed.s === Signal.pong) {
        clearTimeout(this._ping!);
      } else if (parsed.s === Signal.resume) {
        this.socket.close(1000);
      }
    });

    this.socket.on('error', (error) => {
      this.wsLogger.error(error, `Error with ${this.url}`);
      this.emit('error', error);
    });

    this.socket.on('close', (code, reason) => {
      this.socket = null;
      this.wsLogger.info(`WebSocket closed with code ${code}`);
      this.emit('disconnected', code, reason);

      if (WSClient._retryCount >= this._maxRetryCount) {
        this.wsLogger.error(`Reached max retry times ${this._maxRetryCount}, Disposing bot.`);
        this.bot.ctx.scope.dispose();
        return;
      }

      this.wsLogger.info(`Tried ${WSClient._retryCount} times, Reconnecting...`);
      WSClient._retryCount++;
      this.bot.ctx.scope.restart();
    });
  }

  public reconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this.connect();
  }

  private heartbeat() {
    if (!this.socket) {
      clearInterval(this._heartbeat!);
      return;
    }

    let trials = 0;
    const send = () => {
      if (!this.socket) return;
      if (trials >= 2) {
        this.socket.close(1000);
        return;
      }
      this.socket.send(JSON.stringify({ s: Signal.ping, sn: this._sn }));
      this._ping = setTimeout(send, heartbeatIntervals[trials++] * Time.second);
    };
    send();
  }
}

export enum Signal {
  event,
  hello,
  ping,
  pong,
  reconnect,
  resume,
}
