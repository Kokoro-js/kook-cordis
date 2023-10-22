import { SystemExtra } from './system';
import { Data } from './base';

export * from './base';
export * from './message';
export * from './system';
export * from './api';

export type EventSession<T> = Session<Data<SystemExtra<T>>>;
export type MessageSession<T> = Session<Data<T>>;

export interface Session<T> {
  userId: string;
  selfId: string;
  guildId: string;
  channelId: string;
  data: T;
}
