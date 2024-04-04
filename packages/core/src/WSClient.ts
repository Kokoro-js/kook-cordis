import { WsReconnect } from 'websocket-reconnect';
import { logger } from './Logger';
import pino from 'pino';
import { PayLoad } from './types';
import { Time } from 'cosmokit';
import { Bot } from './bot';
import { internalWebhook } from './event-trigger';

const heartbeatIntervals = [6, 2, 4];
export default class WSClient {
  socket;
  wsLogger: pino.Logger;
  _sn = 0;
  _ping: NodeJS.Timeout;
  _heartbeat: NodeJS.Timeout;

  constructor(url: string, p: Bot) {
    this.wsLogger = logger.child({ name: 'websocket' });
    this.wsLogger.info(url);
    const socket = new WsReconnect({ reconnectDelay: 5000 });
    socket.open(url);
    socket.on('open', (e) => {
      this.wsLogger.info(`成功连接到 ${url}`);
      this._sn = 0;
      clearInterval(this._heartbeat);
    });
    socket.on('message', (e) => {
      let parsed: PayLoad;
      try {
        parsed = JSON.parse(e);
      } catch (error) {
        return this.wsLogger.warn('cannot parse message', e);
      }

      this.wsLogger.debug('[receive] %o', parsed);
      if (parsed.s === Signal.event) {
        if (parsed.d.author_id == p.userME.id) return;
        this._sn = Math.max(this._sn, parsed.sn);
        internalWebhook(p.ctx, p, parsed.d);
      } else if (parsed.s === Signal.hello) {
        this._heartbeat = setInterval(() => this.heartbeat(), Time.minute * 0.5);
      } else if (parsed.s === Signal.pong) {
        clearTimeout(this._ping);
      } else if (parsed.s === Signal.resume) {
        this.socket.close(1013);
      }
    });
    socket.on('close', (e) => {
      this.wsLogger.info(e, 'Websocket Closed.');
    });
    socket.on('error', (e) => this.wsLogger.error(e, `Meet Error with ${url}`));
    socket.on('reconnect', (e) => this.wsLogger.info(e, 'Reconnecting...'));
    this.socket = socket;
  }

  heartbeat() {
    if (!this.socket) {
      clearInterval(this._heartbeat);
      return;
    }
    let trials = 0;
    const send = () => {
      if (!this.socket) return;
      if (trials >= 2) {
        return this.socket.close(1013);
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
