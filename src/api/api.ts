import { AxiosInstance } from 'axios/index';
import { MessageType } from '../types';
import { IBaseResponse } from './types/base';
import { ICreateChannelMessage } from './types/message';

export abstract class AbstactBot {
  abstract http: AxiosInstance;

  async sendMessage(
    target_id: string,
    content: string,
    options?: { type?: MessageType; temp_target_id?: string; quote?: string },
  ) {
    const res = await this.http.post('/api/v3/message/create', { target_id, content, ...options });
    const response: IBaseResponse<ICreateChannelMessage> = res.data;
    if (response.code != 0) throw new Error(response.message);

    return response.data;
  }

  async updateMessage(
    msg_id: string,
    content: string,
    options?: {
      type?: MessageType.kmarkdown | MessageType.card;
      temp_target_id?: string;
      quote?: string;
    },
  ) {
    const res = await this.http.post('/api/v3/message/update', { msg_id, content, ...options });
    const response: IBaseResponse<[]> = res.data;
    if (response.code != 0) throw new Error(response.message);

    return response.data;
  }

  async deleteMessage(msg_id: string) {
    const res = await this.http.post('/api/v3/message/delete', { msg_id });
    const response: IBaseResponse<[]> = res.data;
    if (response.code != 0) throw new Error(response.message);

    return response.data;
  }
}
