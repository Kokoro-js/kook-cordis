import { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import * as Kook from '../types';
import { IBaseAPIResponse } from '../types';

export class ResponseError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'ResponseError';
    this.code = code;
  }
}

export abstract class AbstactBot {
  abstract http: AxiosInstance;

  static define(name: string, method: Method, path: string) {
    AbstactBot.prototype[name] = async function (this: AbstactBot, ...args: any[]) {
      const config: AxiosRequestConfig = {
        method,
      };

      if (method.toLowerCase() === 'get' || method.toLowerCase() === 'delete') {
        config.params = args[0];
      } else {
        config.data = args[0];
      }

      // Axios 在请求出现错误的时候会丢出详细错误，不需要手动判断
      const req = await this.http('/api/v3' + path, config);
      const response: IBaseAPIResponse<any> = req.data;
      if (response.code !== 0)
        throw new ResponseError(response.message || 'Unexpected Error', response.code);
      return response.data;
    };
  }

  async sendMessage(
    target_id: string,
    content: string,
    options?: { type?: Kook.MessageType; temp_target_id?: string; quote?: string },
  ) {
    const res = await this.http.post('/api/v3/message/create', { target_id, content, ...options });
    const response: IBaseAPIResponse<Kook.MessageReturn> = res.data;
    if (response.code != 0) {
      throw new ResponseError(response.message || 'Unexpected Error', response.code);
    }

    return response.data;
  }

  async updateMessage(
    msg_id: string,
    content: string,
    options?: {
      type?: Kook.MessageType.kmarkdown | Kook.MessageType.card;
      temp_target_id?: string;
      quote?: string;
    },
  ) {
    const res = await this.http.post('/api/v3/message/update', { msg_id, content, ...options });
    const response: IBaseAPIResponse<{}> = res.data;
    if (response.code != 0)
      throw new ResponseError(response.message || 'Unexpected Error', response.code);

    return response.data;
  }

  async deleteMessage(msg_id: string) {
    const res = await this.http.post('/api/v3/message/delete', { msg_id });
    const response: IBaseAPIResponse<{}> = res.data;
    if (response.code != 0)
      throw new ResponseError(response.message || 'Unexpected Error', response.code);

    return response.data;
  }

  async createAssest(
    file: Buffer | Blob | string | FormData,
    name: string = 'assest',
  ): Promise<string> {
    if (typeof file === 'string') {
      file = Buffer.from(file, 'base64');
    }
    if (Buffer.isBuffer(file) || file instanceof Blob) {
      const payload = new FormData();
      payload.append('file', file as any, name);
      file = payload;
    }

    const res = await this.http.post('/asset/create', file, {
      headers: {
        'Content-Type': 'form-data',
      },
    });
    const response: IBaseAPIResponse<{ url: string }> = res.data;
    if (response.code != 0)
      throw new ResponseError(response.message || 'Unexpected Error', response.code);

    return response.data.url;
  }
}

AbstactBot.define('getGuildList', 'GET', '/guild/list');
AbstactBot.define('getGuildView', 'GET', '/guild/view');
AbstactBot.define('getGuildUserList', 'GET', '/guild/user-list');
AbstactBot.define('setGuildUserNickname', 'POST', '/guild/nickname');
AbstactBot.define('leaveGuild', 'POST', '/guild/leave');
AbstactBot.define('kickoutGuildUser', 'POST', '/guild/kickout');
AbstactBot.define('getGuildMuteList', 'GET', '/guild-mute/list');
AbstactBot.define('createGuildMute', 'POST', '/guild-mute/create');
AbstactBot.define('deleteGuildMute', 'POST', '/guild-mute/delete');
AbstactBot.define('getGuildBoostHistory', 'GET', '/guild-boost/history');

AbstactBot.define('getChannelList', 'GET', '/channel/list');
AbstactBot.define('getChannelView', 'GET', '/channel/view');
AbstactBot.define('createChannel', 'POST', '/channel/create');
AbstactBot.define('updateChannel', 'POST', '/channel/update');
AbstactBot.define('deleteChannel', 'POST', '/channel/delete');
AbstactBot.define('getChannelUserList', 'GET', '/channel/user-list');
AbstactBot.define('kickChannelUser', 'POST', '/channel/kickout');
AbstactBot.define('moveChannelUser', 'POST', '/channel/move-user');
AbstactBot.define('getChannelRoleIndex', 'GET', '/channel-role/index');
AbstactBot.define('createChannelRole', 'POST', '/channel-role/create');
AbstactBot.define('updateChannelRole', 'POST', '/channel-role/update');
AbstactBot.define('deleteChannelRole', 'POST', '/channel-role/delete');

AbstactBot.define('getMessageList', 'GET', '/message/list');
AbstactBot.define('getMessageView', 'GET', '/message/view');
// AbstactBot.define('createMessage', 'POST', '/message/create')
// AbstactBot.define('updateMessage', 'POST', '/message/update')
// AbstactBot.define('deleteMessage', 'POST', '/message/delete')
AbstactBot.define('getMessageReactionList', 'GET', '/message/reaction-list');
AbstactBot.define('addMessageReaction', 'POST', '/message/add-reaction');
AbstactBot.define('deleteMessageReaction', 'POST', '/message/delete-reaction');

AbstactBot.define('getChannelJoinedUserList', 'GET', '/channel-user/get-joined-channel');

AbstactBot.define('getPrivateChatList', 'GET', '/user-chat/list');
AbstactBot.define('getPrivateChatView', 'GET', '/user-chat/view');
AbstactBot.define('createPrivateChat', 'POST', '/user-chat/create');
AbstactBot.define('deletePrivateChat', 'POST', '/user-chat/delete');

AbstactBot.define('getDirectMessageList', 'GET', '/direct-message/list');
AbstactBot.define('createDirectMessage', 'POST', '/direct-message/create');
AbstactBot.define('updateDirectMessage', 'POST', '/direct-message/update');
AbstactBot.define('deleteDirectMessage', 'POST', '/direct-message/delete');
AbstactBot.define('getDirectMessageReactionList', 'GET', '/direct-message/reaction-list');
AbstactBot.define('addDirectMessageReaction', 'POST', '/direct-message/add-reaction');
AbstactBot.define('deleteDirectMessageReaction', 'POST', '/direct-message/delete-reaction');

AbstactBot.define('getGateway', 'GET', '/gateway/index');
AbstactBot.define('getToken', 'POST', '/oauth2/token');
// AbstactBot.define('createAsset', 'POST', '/asset/create');

AbstactBot.define('getUserMe', 'GET', '/user/me');
AbstactBot.define('getUserView', 'GET', '/user/view');
AbstactBot.define('offline', 'POST', '/user/offline');

AbstactBot.define('getGuildRoleList', 'GET', '/guild-role/list');
AbstactBot.define('createGuildRole', 'POST', '/guild-role/create');
AbstactBot.define('updateGuildRole', 'POST', '/guild-role/update');
AbstactBot.define('deleteGuildRole', 'POST', '/guild-role/delete');
AbstactBot.define('grantGuildRole', 'POST', '/guild-role/grant');
AbstactBot.define('revokeGuildRole', 'POST', '/guild-role/revoke');

AbstactBot.define('getIntimacy', 'GET', '/intimacy/index');
AbstactBot.define('updateIntimacy', 'POST', '/intimacy/update');

AbstactBot.define('getGuildEmojiList', 'GET', '/guild-emoji/list');
AbstactBot.define('createGuildEmoji', 'POST', '/guild-emoji/create');
AbstactBot.define('updateGuildEmoji', 'POST', '/guild-emoji/update');
AbstactBot.define('deleteGuildEmoji', 'POST', '/guild-emoji/delete');

AbstactBot.define('getInviteList', 'GET', '/invite/list');
AbstactBot.define('createInvite', 'POST', '/invite/create');
AbstactBot.define('deleteInvite', 'POST', '/invite/delete');

AbstactBot.define('getBlacklist', 'GET', '/blacklist/list');
AbstactBot.define('createBlacklist', 'POST', '/blacklist/create');
AbstactBot.define('deleteBlacklist', 'POST', '/blacklist/delete');

AbstactBot.define('getGuildBadge', 'GET', '/badge/guild');
AbstactBot.define('getGameList', 'GET', '/game');
AbstactBot.define('createGame', 'POST', '/game/create');
AbstactBot.define('updateGame', 'POST', '/game/update');
AbstactBot.define('deleteGame', 'POST', '/game/delete');
AbstactBot.define('createGameActivity', 'POST', '/game/activity');
AbstactBot.define('deleteGameActivity', 'POST', '/game/delete-activity');

export interface AbstactBot {
  getGuildList(param?: Kook.Pagination): Promise<Kook.GuildList>;

  getGuildView(param: { guild_id: string }): Promise<Kook.Guild>;

  getGuildUserList(param: { guild_id: string } & Kook.Pagination): Promise<Kook.GuildUserList>;

  setGuildUserNickname(param: {
    guild_id: string;
    user_id: string;
    nickname: string;
  }): Promise<void>;

  leaveGuild(param: { guild_id: string }): Promise<void>;

  kickoutGuildUser(param: { guild_id: string; target_id: string }): Promise<void>;

  getGuildMuteList(param: { guild_id: string }): Promise<Kook.GuildMuteList>;

  createGuildMute(param: {
    guild_id: string;
    user_id: string;
    type: Kook.GuildMute.Type;
  }): Promise<void>;

  deleteGuildMute(param: {
    guild_id: string;
    user_id: string;
    type: Kook.GuildMute.Type;
  }): Promise<void>;

  getGuildBoostHistory(param: {
    guild_id: string;
    start_time: number;
    end_time: number;
  }): Promise<Kook.List<Kook.GuildBoost>>;

  getChannelList(param: { guild_id: string } & Kook.Pagination): Promise<Kook.List<Kook.Channel>>;

  getChannelView(param: { target_id: string }): Promise<Kook.Channel>;

  createChannel(param: {
    guild_id: string;
    parent_id?: string;
    name: string;
    type?: number;
    limit_amount?: number;
    voice_quality?: string;
    is_category?: 0 | 1;
  }): Promise<Kook.Channel>;

  updateChannel(param: {
    channel_id: string;
    name?: string;
    topic?: string;
    slow_mode?:
      | 0
      | 5000
      | 10000
      | 15000
      | 30000
      | 60000
      | 120000
      | 300000
      | 600000
      | 900000
      | 1800000
      | 3600000
      | 7200000
      | 21600000;
  }): Promise<Kook.Channel>;

  deleteChannel(param: { channel_id: string }): Promise<void>;

  getChannelUserList(param: { channel_id: string }): Promise<Kook.List<Kook.User>>;

  kickChannelUser(param: { channel_id: string; user_id: string }): Promise<void>;

  moveChannelUser(param: {
    target_id: string;
    user_ids: string[];
  }): Promise<{ user_ids: string[] }>;

  getChannelRoleIndex(param: { channel_id: string }): Promise<Kook.ChannelRoleIndex>;

  createChannelRole(param: {
    channel_id: string;
    type?: 'user_id';
    value?: string;
  }): Promise<Omit<Kook.ChannelRole, 'role_id'>>;

  createChannelRole(param: {
    channel_id: string;
    type: 'role_id';
    value?: string;
  }): Promise<Omit<Kook.ChannelRole, 'user_id'>>;

  updateChannelRole(param: {
    channel_id: string;
    type?: 'user_id';
    value?: string;
    allow?: number;
    deny?: number;
  }): Promise<Omit<Kook.ChannelRole, 'role_id'>>;

  updateChannelRole(param: {
    channel_id: string;
    type: 'role_id';
    value?: string;
    allow?: number;
    deny?: number;
  }): Promise<Omit<Kook.ChannelRole, 'user_id'>>;

  deleteChannelRole(param: {
    channel_id: string;
    type?: 'role_id' | 'user_id';
    value?: string;
  }): Promise<void>;

  getMessageList(
    param: {
      target_id: string;
      msg_id?: string;
      pin?: 0 | 1;
      flag?: 'before' | 'around' | 'after';
    } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Message>>;

  getMessageView(param: { msg_id: string }): Promise<Kook.Message>;

  // createMessage(param: { type?: Type; target_id: string; content: string; quote?: string; nonce?: string; temp_target_id?: string }): Promise<MessageReturn>
  // updateMessage(param: { msg_id: string; content: string; quote?: string; temp_target_id?: string }): Promise<void>
  // deleteMessage(param: { msg_id: string }): Promise<void>
  getMessageReactionList(param: { msg_id: string; emoji: string }): Promise<Kook.User[]>;

  addMessageReaction(param: { msg_id: string; emoji: string }): Promise<void>;

  deleteMessageReaction(param: { msg_id: string; emoji: string; user_id?: string }): Promise<void>;

  getChannelJoinedUserList(
    param: { guild_id: string; user_id: string } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Channel>>;

  getPrivateChatList(
    param?: Kook.Pagination,
  ): Promise<Kook.List<Omit<Kook.PrivateChat, 'is_friend' | 'is_blocked' | 'is_target_blocked'>>>;

  getPrivateChatView(param: { chat_code: string }): Promise<Kook.PrivateChat>;

  createPrivateChat(param: { target_id: string }): Promise<Kook.PrivateChat>;

  deletePrivateChat(param: { chat_code: string }): Promise<void>;

  getDirectMessageList(
    param: {
      target_id?: string;
      chat_code?: string;
      msg_id?: string;
      flag?: 'before' | 'around' | 'after';
    } & Kook.Pagination,
  ): Promise<{ items: Kook.Message[] }>;

  createDirectMessage(param: {
    target_id?: string;
    chat_code?: string;
    type?: Kook.MessageType;
    content: string;
    quote?: string;
    nonce?: string;
  }): Promise<Kook.MessageReturn>;

  updateDirectMessage(param: { msg_id: string; content: string; quote?: string }): Promise<void>;

  deleteDirectMessage(param: { msg_id: string }): Promise<void>;

  getDirectMessageReactionList(param: { msg_id: string; emoji?: string }): Promise<Kook.User[]>;

  addDirectMessageReaction(param: { msg_id: string; emoji: string }): Promise<void>;

  deleteDirectMessageReaction(param: {
    msg_id: string;
    emoji: string;
    user_id?: string;
  }): Promise<void>;

  getGateway(param: { compress?: 0 | 1 }): Promise<{ url: string }>;

  getToken(param: {
    grant_type: 'authorization_code';
    client_id: string;
    client_secret: string;
    code: string;
    redirect_uri: string;
  }): Promise<Kook.AccessToken>;

  // createAsset(param: { file: FormData }): Promise<{ url: string }>

  getUserMe(): Promise<Kook.User>;

  getUserView(param: { user_id: string; guild_id?: string }): Promise<Kook.User>;

  offline(): Promise<void>;

  getGuildRoleList(
    param: { guild_id: string } & Kook.Pagination,
  ): Promise<Kook.List<Kook.GuildRole>>;

  createGuildRole(param: { name?: string; guild_id: string }): Promise<Kook.GuildRole>;

  updateGuildRole(
    param: { guild_id: string; role_id: number } & Partial<Omit<Kook.GuildRole, 'role_id'>>,
  ): Promise<Kook.GuildRole>;

  deleteGuildRole(param: { guild_id: string; role_id: number }): Promise<void>;

  grantGuildRole(param: {
    guild_id: string;
    user_id?: string;
    role_id: number;
  }): Promise<Kook.GuildRoleReturn>;

  revokeGuildRole(param: {
    guild_id: string;
    user_id?: string;
    role_id: number;
  }): Promise<Kook.GuildRoleReturn>;

  getIntimacy(param: { user_id: string }): Promise<Kook.Intimacy>;

  updateIntimacy(param: {
    user_id: string;
    score?: number;
    social_info?: string;
    img_id?: string;
  }): Promise<void>;

  getGuildEmojiList(param?: Kook.Pagination): Promise<Kook.List<Kook.Emoji>>;

  // createGuildEmoji(param: { name?: string; guild_id: string; emoji: FormData }): Promise<Emoji>
  updateGuildEmoji(param: { name: string; id: string }): Promise<void>;

  deleteGuildEmoji(param: { id: string }): Promise<void>;

  getInviteList(
    param: { guild_id?: string; channel_id?: string } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Invite>>;

  createInvite(param: {
    guild_id?: string;
    channel_id?: string;
    duration?: number;
    setting_times?: number;
  }): Promise<{ url: string }>;

  deleteInvite(param: { url_code: string; guild_id?: string; channel_id?: string }): Promise<void>;

  getBlacklist(param: { guild_id: string } & Kook.Pagination): Promise<Kook.List<Kook.BlackList>>;

  createBlacklist(param: {
    guild_id: string;
    target_id: string;
    remark?: string;
    del_msg_days?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }): Promise<void>;

  deleteBlacklist(param: { guild_id: string; target_id: string }): Promise<void>;

  // getGuildBadge(param: { guild_id: string; style?: 0|1|2 }): Promise<void> // 未实现
  getGameList(param?: { type?: 0 | 1 | 2 }): Promise<Kook.List<Kook.Game>>;

  createGame(param: { name: string; icon?: string }): Promise<Kook.List<Kook.Game>>;

  updateGame(param: { id: number; name?: string; icon?: string }): Promise<Kook.List<Kook.Game>>;

  deleteGame(param: { id: number }): Promise<void>;

  createGameActivity(param: {
    id: number;
    data_type: 1 | 2;
    software?: 'cloudmusic' | 'qqmusic' | 'kugou';
    singer?: string;
    music_name?: string;
  }): Promise<void>;

  deleteGameActivity(param: { data_type: 1 | 2 }): Promise<void>;
}
