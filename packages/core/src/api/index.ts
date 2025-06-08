import { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import * as Kook from '../types';
import { BotOnlineStatus, DirectMessageGetType, IBaseAPIResponse, IVoiceInfo } from '../types';

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
    options?: {
      type?: Kook.MessageType;
      temp_target_id?: string;
      quote?: string;
      template_id?: string;
    },
  ) {
    const res = await this.http.post('/api/v3/message/create', { target_id, content, ...options });
    const response: IBaseAPIResponse<Kook.MessageReturn> = res.data;
    if (response.code != 0) {
      throw new ResponseError(response.message || 'Unexpected Error', response.code);
    }

    return response.data;
  }

  createTempMessageBuilder(
    target_id: string,
    user_id: string,
    builderOptions?: { type?: Kook.MessageType; quote?: string; template_id?: string },
  ) {
    // 返回一个新的函数，这个新函数只接受一个参数
    return async (content: string, options?: { type?: Kook.MessageType; quote?: string }) => {
      return await this.sendMessage(target_id, content, {
        ...builderOptions,
        ...options,
        temp_target_id: user_id,
      });
    };
  }

  createMessageBuilder(
    target_id: string,
    builderOptions?: { type?: Kook.MessageType; quote?: string; template_id?: string },
  ) {
    return async (content: string, options?: { type?: Kook.MessageType; quote?: string }) => {
      // 直接调用 sendMessage，不需要传递 temp_target_id
      return await this.sendMessage(target_id, content, {
        ...builderOptions,
        ...options,
      });
    };
  }

  async updateMessage(
    msg_id: string,
    content: string,
    options?: {
      type?: Kook.MessageType.kmarkdown | Kook.MessageType.card;
      temp_target_id?: string;
      quote?: string;
      template_id?: string;
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
    if (Buffer.isBuffer(file)) {
      file = new Blob([file], { type: 'application/octet-stream' });
    }
    if (file instanceof Blob) {
      const payload = new FormData();
      payload.append('file', file, name);
      file = payload;
    }
    const res = await this.http.post('/api/v3/asset/create', file, {
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
AbstactBot.define('syncChannelRole', 'POST', '/channel-role/sync');
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
AbstactBot.define('sendPipeMessage', 'POST', '/message/send-pipemsg');

AbstactBot.define('getUserJoinedChannelList', 'GET', '/channel-user/get-joined-channel');

AbstactBot.define('getPrivateChatList', 'GET', '/user-chat/list');
AbstactBot.define('getPrivateChatView', 'GET', '/user-chat/view');
AbstactBot.define('createPrivateChat', 'POST', '/user-chat/create');
AbstactBot.define('deletePrivateChat', 'POST', '/user-chat/delete');

AbstactBot.define('getDirectMessageList', 'GET', '/direct-message/list');
AbstactBot.define('createDirectMessage', 'POST', '/direct-message/create');
AbstactBot.define('getDirectMessageView', 'GET', '/direct-message/view');
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
AbstactBot.define('online', 'POST', '/user/online');
AbstactBot.define('getOnlineStatus', 'GET', '/user/get-online-status');

AbstactBot.define('joinVoice', 'POST', '/voice/join');
AbstactBot.define('listJoinedVoice', 'GET', '/voice/list');
AbstactBot.define('leaveVoice', 'POST', '/voice/leave');
AbstactBot.define('keepVoiceAlive', 'POST', '/voice/keep-alive');

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
  /**
   * 获取当前用户加入的服务器列表
   * @doc https://developer.kookapp.cn/doc/http/guild#%E8%8E%B7%E5%8F%96%E5%BD%93%E5%89%8D%E7%94%A8%E6%88%B7%E5%8A%A0%E5%85%A5%E7%9A%84%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%88%97%E8%A1%A8
   */
  getGuildList(param?: Kook.Pagination): Promise<Kook.GuildList>;

  /**
   * 获取服务器详情
   * @doc https://developer.kookapp.cn/doc/http/guild#%E8%8E%B7%E5%8F%96%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%AF%A6%E6%83%85
   */
  getGuildView(param: { guild_id: string }): Promise<Kook.Guild>;

  /**
   * 获取服务器中的用户列表
   * @doc https://developer.kookapp.cn/doc/http/guild#%E8%8E%B7%E5%8F%96%E6%9C%8D%E5%8A%A1%E5%99%A8%E4%B8%AD%E7%9A%84%E7%94%A8%E6%88%B7%E5%88%97%E8%A1%A8
   */
  getGuildUserList(
    param: { guild_id: string } & Partial<{
      channel_id: string;
      /** 搜索关键字，在用户名或昵称中搜索 **/
      search: string;
      /** 角色 ID，获取特定角色的用户列表 **/
      role_id: number;
      /** 只能为 `0` 或 `1`，`0` 是未认证，`1` 是已认证 **/
      mobile_verified: 0 | 1;
      /** 根据活跃时间排序，`0` 是顺序排列，`1` 是倒序排列 **/
      active_time: 0 | 1;
      /** 根据加入时间排序，`0` 是顺序排列，`1` 是倒序排列 **/
      joined_at: 0 | 1;
      /** 获取指定 id 所属用户的信息 **/
      filter_user_id: string;
    }> &
      Kook.Pagination,
  ): Promise<Kook.GuildUserList>;

  /**
   * 修改服务器中用户的昵称
   * @doc https://developer.kookapp.cn/doc/http/guild#%E4%BF%AE%E6%94%B9%E6%9C%8D%E5%8A%A1%E5%99%A8%E4%B8%AD%E7%94%A8%E6%88%B7%E7%9A%84%E6%98%B5%E7%A7%B0
   */
  setGuildUserNickname(param: {
    guild_id: string;
    /** 要修改昵称的目标用户 ID，不传则修改当前登陆用户的昵称 **/
    user_id: string;
    /** 昵称，2 - 64 长度，不传则清空昵称 **/
    nickname: string;
  }): Promise<void>;

  /**
   * 离开服务器
   * @doc https://developer.kookapp.cn/doc/http/guild#%E7%A6%BB%E5%BC%80%E6%9C%8D%E5%8A%A1%E5%99%A8
   */
  leaveGuild(param: { guild_id: string }): Promise<void>;

  /**
   * 踢出服务器
   * @doc https://developer.kookapp.cn/doc/http/guild#%E8%B8%A2%E5%87%BA%E6%9C%8D%E5%8A%A1%E5%99%A8
   */
  kickoutGuildUser(param: { guild_id: string; target_id: string }): Promise<void>;

  /**
   * 服务器静音闭麦列表
   * @doc https://developer.kookapp.cn/doc/http/guild#%E6%9C%8D%E5%8A%A1%E5%99%A8%E9%9D%99%E9%9F%B3%E9%97%AD%E9%BA%A6%E5%88%97%E8%A1%A8
   */
  getGuildMuteList(param: { guild_id: string }): Promise<Kook.GuildMuteList>;

  /**
   * 添加服务器静音或闭麦
   * @doc https://developer.kookapp.cn/doc/http/guild#%E6%B7%BB%E5%8A%A0%E6%9C%8D%E5%8A%A1%E5%99%A8%E9%9D%99%E9%9F%B3%E6%88%96%E9%97%AD%E9%BA%A6
   */
  createGuildMute(param: {
    guild_id: string;
    user_id: string;
    /** 静音类型，`1` 代表麦克风闭麦，`2` 代表耳机静音 **/
    type: Kook.GuildMute.Type;
  }): Promise<void>;

  /**
   * 删除服务器静音或闭麦
   * @doc https://developer.kookapp.cn/doc/http/guild#%E5%88%A0%E9%99%A4%E6%9C%8D%E5%8A%A1%E5%99%A8%E9%9D%99%E9%9F%B3%E6%88%96%E9%97%AD%E9%BA%A6
   */
  deleteGuildMute(param: {
    guild_id: string;
    user_id: string;
    /** 静音类型，`1` 代表麦克风闭麦，`2` 代表耳机静音 **/
    type: Kook.GuildMute.Type;
  }): Promise<void>;

  /**
   * 服务器助力历史
   * @doc https://developer.kookapp.cn/doc/http/guild#%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%8A%A9%E5%8A%9B%E5%8E%86%E5%8F%B2
   */
  getGuildBoostHistory(param: {
    guild_id: string;
    /** unix 时间戳，时间范围的开始时间 **/
    start_time: number;
    /** unix 时间戳，时间范围的结束时间 **/
    end_time: number;
  }): Promise<Kook.List<Kook.GuildBoost>>;

  /**
   * 获取频道列表
   * @doc https://developer.kookapp.cn/doc/http/channel#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E5%88%97%E8%A1%A8
   */
  getChannelList(
    param: {
      guild_id: string;
      /** 频道类型, `1` 为文字，`2` 为语音, 默认为 `1` **/
      type?: 1 | 2;
      /** 父分组频道 id **/
      parent_id?: string;
    } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Channel>>;

  /**
   * 获取频道详情
   * @doc https://developer.kookapp.cn/doc/http/channel#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E8%AF%A6%E6%83%85
   */
  getChannelView(param: { target_id: string }): Promise<Kook.Channel>;

  /**
   * 创建频道
   * @doc https://developer.kookapp.cn/doc/http/channel#%E5%88%9B%E5%BB%BA%E9%A2%91%E9%81%93
   */
  createChannel(param: {
    guild_id: string;
    name: string;
    parent_id?: string;
    /** 频道类型，`1` 文字，`2` 语音，默认为 `1` **/
    type?: number;
    /** 语音频道人数限制，最大 `99` **/
    limit_amount?: number;
    /** 语音音质，默认为 `2`。
     * `1` 流畅-18Kbps，
     * `2` 正常-32Kbps，
     * `3` 高质量-64Kbps，
     * `4` 高质量-128Kbps，
     * `5` 高质量-192Kbps，
     * `6` 高质量-256Kbps，
     * `7` 高质量-320Kbps，
     */
    voice_quality?: string;
    /** 是否是分组，默认为 `0`。`1` 是，`0` 否。
     * 当该值传 `1` 时，只接收 `guild_id`、`name`、`is_category` 三个字段！ *
     */
    is_category?: 0 | 1;
  }): Promise<Kook.Channel>;

  /**
   * 编辑频道
   * @doc https://developer.kookapp.cn/doc/http/channel#%E7%BC%96%E8%BE%91%E9%A2%91%E9%81%93
   */
  updateChannel(param: {
    channel_id: string;
    name?: string;
    /** 频道排序 **/
    level?: number;
    /** 分组频道 ID，设置为 `0` 为移出分组 **/
    parent_id?: string;
    /** 频道简介，文字频道有效 **/
    topic?: string;
    /** 慢速模式，单位 ms。只支持预设值，文字频道有效 **/
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
    /** 此频道最大能容纳的用户数量，最大值 `99`，语音频道有效 **/
    limit_amount?: number;
    /** 声音质量，内容详见 `createChannel`，语音频道有效 **/
    voice_quality?: string;
    /** 密码，语音频道有效 **/
    password?: string;
  }): Promise<Kook.Channel>;

  /**
   * 删除频道
   * @doc https://developer.kookapp.cn/doc/http/channel#%E5%88%A0%E9%99%A4%E9%A2%91%E9%81%93
   */
  deleteChannel(param: { channel_id: string }): Promise<void>;

  /**
   * 语音频道用户列表
   * @doc https://developer.kookapp.cn/doc/http/channel#%E8%AF%AD%E9%9F%B3%E9%A2%91%E9%81%93%E7%94%A8%E6%88%B7%E5%88%97%E8%A1%A8
   */
  getChannelUserList(param: { channel_id: string }): Promise<Kook.User[]>;

  /**
   * 语音频道之间移动用户
   * @doc https://developer.kookapp.cn/doc/http/channel#%E8%AF%AD%E9%9F%B3%E9%A2%91%E9%81%93%E4%B9%8B%E9%97%B4%E7%A7%BB%E5%8A%A8%E7%94%A8%E6%88%B7
   */
  moveChannelUser(param: {
    target_id: string;
    /** 用户 id 的数组 **/
    user_ids: string[];
  }): Promise<{ user_ids: string[] }>;

  /**
   * 踢出语音频道中的用户
   * @doc https://developer.kookapp.cn/doc/http/channel#%E8%B8%A2%E5%87%BA%E8%AF%AD%E9%9F%B3%E9%A2%91%E9%81%93%E4%B8%AD%E7%9A%84%E7%94%A8%E6%88%B7
   */
  kickChannelUser(param: { channel_id: string; user_id: string }): Promise<void>;

  /**
   * 频道角色权限详情
   * @doc https://developer.kookapp.cn/doc/http/channel#%E9%A2%91%E9%81%93%E8%A7%92%E8%89%B2%E6%9D%83%E9%99%90%E8%AF%A6%E6%83%85
   */
  getChannelRoleIndex(param: { channel_id: string }): Promise<Kook.ChannelRoleIndex>;

  /**
   * 创建频道角色权限
   * @doc https://developer.kookapp.cn/doc/http/channel#%E5%88%9B%E5%BB%BA%E9%A2%91%E9%81%93%E8%A7%92%E8%89%B2%E6%9D%83%E9%99%90
   */
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

  /**
   * 更新频道角色权限
   * @doc https://developer.kookapp.cn/doc/http/channel#%E6%9B%B4%E6%96%B0%E9%A2%91%E9%81%93%E8%A7%92%E8%89%B2%E6%9D%83%E9%99%90
   */
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

  /**
   * 同步频道角色权限
   * @doc https://developer.kookapp.cn/doc/http/channel#%E5%90%8C%E6%AD%A5%E9%A2%91%E9%81%93%E8%A7%92%E8%89%B2%E6%9D%83%E9%99%90
   */
  syncChannelRole(param: { channel_id: string }): Promise<Kook.ChannelRoleIndex>;

  /**
   * 删除频道角色权限
   * @doc https://developer.kookapp.cn/doc/http/channel#%E5%88%A0%E9%99%A4%E9%A2%91%E9%81%93%E8%A7%92%E8%89%B2%E6%9D%83%E9%99%90
   */
  deleteChannelRole(param: {
    channel_id: string;
    /** value 的类型，不传则默认为 `user_id` **/
    type?: 'user_id' | 'role_id';
    /** 根据 type，为用户 id 或角色 id **/
    value?: string;
  }): Promise<void>;

  /**
   * 获取频道聊天消息列表
   * @note 此接口非标准分页，需要根据参考消息来查询相邻分页的消息
   * @doc https://developer.kookapp.cn/doc/http/message#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF%E5%88%97%E8%A1%A8
   */
  getMessageList(
    param: {
      target_id: string;
      /** 参考消息 id，不传则查询最新消息 **/
      msg_id?: string;
      /** 只能为 0 或者 1，是否查询置顶消息。 置顶消息只支持查询最新的消息 **/
      pin?: 0 | 1;
      /** 查询模式，有三种模式可以选择。不传则默认查询最新的消息 **/
      flag?: 'before' | 'around' | 'after';
    } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Message>>;

  /**
   * 获取频道聊天消息详情
   * @doc https://developer.kookapp.cn/doc/http/message#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF%E8%AF%A6%E6%83%85
   */
  getMessageView(param: { msg_id: string }): Promise<Kook.Message>;

  // createMessage(param: { type?: Type; target_id: string; content: string; quote?: string; nonce?: string; temp_target_id?: string }): Promise<MessageReturn>
  // updateMessage(param: { msg_id: string; content: string; quote?: string; temp_target_id?: string }): Promise<void>
  // deleteMessage(param: { msg_id: string }): Promise<void>

  /**
   * 获取频道消息某回应的用户列表
   * @doc https://developer.kookapp.cn/doc/http/message#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E6%B6%88%E6%81%AF%E6%9F%90%E5%9B%9E%E5%BA%94%E7%9A%84%E7%94%A8%E6%88%B7%E5%88%97%E8%A1%A8
   */
  getMessageReactionList(param: {
    msg_id: string;
    /** emoji 的 id, 可以为 GuilEmoji 或者 Emoji **/
    emoji: string;
  }): Promise<Kook.User[]>;

  /**
   * 给某个消息添加回应
   * @doc https://developer.kookapp.cn/doc/http/message#%E7%BB%99%E6%9F%90%E4%B8%AA%E6%B6%88%E6%81%AF%E6%B7%BB%E5%8A%A0%E5%9B%9E%E5%BA%94
   */
  addMessageReaction(param: { msg_id: string; emoji: string }): Promise<void>;

  /**
   * 删除消息的某个回应
   * @doc https://developer.kookapp.cn/doc/http/message#%E5%88%A0%E9%99%A4%E6%B6%88%E6%81%AF%E7%9A%84%E6%9F%90%E4%B8%AA%E5%9B%9E%E5%BA%94
   */
  deleteMessageReaction(param: {
    msg_id: string;
    emoji: string;
    /** 用户的 id, 如果不填则为自己的 id。删除别人的 reaction 需要有管理频道消息的权限 **/
    user_id?: string;
  }): Promise<void>;

  /**
   * 发送管道消息
   * @doc https://developer.kookapp.cn/doc/http/message#%E5%8F%91%E9%80%81%E7%AE%A1%E9%81%93%E6%B6%88%E6%81%AF
   */
  sendPipeMessage(
    param: {
      access_token: string;
      /** 消息发送的类型。如果不填，如果有模板以模板为准，无模板则为 kmd **/
      type?: Kook.MessageType;
      /** 频道id。如果不填，则以消息管道的设置为准，如果填了，只允许填与消息管道所填频道相同服务器的文字频道 **/
      target_id?: string;
    } & Record<string, any>,
  ): Promise<void>;

  /**
   * 根据用户 id 和服务器 id 获取用户所在语音频道
   * @doc https://developer.kookapp.cn/doc/http/channel-user#%E6%A0%B9%E6%8D%AE%E7%94%A8%E6%88%B7%20id%20%E5%92%8C%E6%9C%8D%E5%8A%A1%E5%99%A8%20id%20%E8%8E%B7%E5%8F%96%E7%94%A8%E6%88%B7%E6%89%80%E5%9C%A8%E8%AF%AD%E9%9F%B3%E9%A2%91%E9%81%93
   */
  getUserJoinedChannelList(
    param: { guild_id: string; user_id: string } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Channel>>;

  /**
   * 获取私信聊天会话列表
   * @doc https://developer.kookapp.cn/doc/http/user-chat#%E8%8E%B7%E5%8F%96%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E4%BC%9A%E8%AF%9D%E5%88%97%E8%A1%A8
   */
  getPrivateChatList(
    param?: Kook.Pagination,
  ): Promise<Kook.List<Omit<Kook.PrivateChat, 'is_friend' | 'is_blocked' | 'is_target_blocked'>>>;

  /**
   * 获取私信聊天会话详情
   * @doc https://developer.kookapp.cn/doc/http/user-chat#%E8%8E%B7%E5%8F%96%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E4%BC%9A%E8%AF%9D%E8%AF%A6%E6%83%85
   */
  getPrivateChatView(param: { chat_code: string }): Promise<Kook.PrivateChat>;

  /**
   * 创建私信聊天会话
   * @doc https://developer.kookapp.cn/doc/http/user-chat#%E5%88%9B%E5%BB%BA%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E4%BC%9A%E8%AF%9D
   */
  createPrivateChat(param: { target_id: string }): Promise<Kook.PrivateChat>;

  /**
   * 删除私信聊天会话
   * @doc https://developer.kookapp.cn/doc/http/user-chat#%E5%88%A0%E9%99%A4%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E4%BC%9A%E8%AF%9D
   */
  deletePrivateChat(param: { chat_code: string }): Promise<void>;

  /**
   * 获取私信聊天消息列表
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E8%8E%B7%E5%8F%96%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF%E5%88%97%E8%A1%A8
   */
  getDirectMessageList(
    param: {
      msg_id?: string;
      flag?: 'before' | 'around' | 'after';
    } & DirectMessageGetType &
      Kook.Pagination,
  ): Promise<{ items: Kook.Message[] }>;
  /**
   * 获取私信聊天消息详情
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E8%8E%B7%E5%8F%96%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF%E8%AF%A6%E6%83%85
   */
  getDirectMessageView(
    param: {
      /** 私信会话 Code。 **/
      chat_code: string;
      msg_id: string;
    } & Kook.Pagination,
  ): Promise<{ items: Kook.Message[] }>;

  /**
   * 发送私信聊天消息
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E5%8F%91%E9%80%81%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF
   */
  createDirectMessage(
    param: {
      type?: Kook.MessageType;
      content: string;
      quote?: string;
      nonce?: string;
      template_id?: string;
    } & DirectMessageGetType,
  ): Promise<Kook.MessageReturn>;

  /**
   * 更新私信聊天消息
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E6%9B%B4%E6%96%B0%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF
   */
  updateDirectMessage(param: {
    msg_id: string;
    content: string;
    quote?: string;
    template_id?: string;
  }): Promise<void>;

  /**
   * 删除私信聊天消息
   * @note 只能删除自己的消息
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E5%88%A0%E9%99%A4%E7%A7%81%E4%BF%A1%E8%81%8A%E5%A4%A9%E6%B6%88%E6%81%AF
   */
  deleteDirectMessage(param: { msg_id: string }): Promise<void>;

  /**
   * 获取消息某回应的用户列表
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E6%B6%88%E6%81%AF%E6%9F%90%E5%9B%9E%E5%BA%94%E7%9A%84%E7%94%A8%E6%88%B7%E5%88%97%E8%A1%A8
   */
  getDirectMessageReactionList(param: { msg_id: string; emoji?: string }): Promise<Kook.User[]>;

  /**
   * 给某个消息添加回应
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E7%BB%99%E6%9F%90%E4%B8%AA%E6%B6%88%E6%81%AF%E6%B7%BB%E5%8A%A0%E5%9B%9E%E5%BA%94
   */
  addDirectMessageReaction(param: { msg_id: string; emoji: string }): Promise<void>;

  /**
   * 删除消息的某个回应
   * @doc https://developer.kookapp.cn/doc/http/direct-message#%E5%88%A0%E9%99%A4%E6%B6%88%E6%81%AF%E7%9A%84%E6%9F%90%E4%B8%AA%E5%9B%9E%E5%BA%94
   */
  deleteDirectMessageReaction(param: {
    msg_id: string;
    emoji: string;
    user_id?: string;
  }): Promise<void>;

  /**
   * 获取网关连接地址
   * @doc https://developer.kookapp.cn/doc/http/gateway#%E8%8E%B7%E5%8F%96%E7%BD%91%E5%85%B3%E8%BF%9E%E6%8E%A5%E5%9C%B0%E5%9D%80
   */
  getGateway(param: {
    /** 下发数据是否压缩，默认为 `1`,代表压缩 **/
    compress?: 0 | 1;
  }): Promise<{ url: string }>;

  /**
   * 获取当前用户信息
   * @doc https://developer.kookapp.cn/doc/http/user#%E8%8E%B7%E5%8F%96%E5%BD%93%E5%89%8D%E7%94%A8%E6%88%B7%E4%BF%A1%E6%81%AF
   */
  getUserMe(): Promise<Kook.User>;

  /**
   * 获取目标用户信息
   * @doc https://developer.kookapp.cn/doc/http/user#%E8%8E%B7%E5%8F%96%E7%9B%AE%E6%A0%87%E7%94%A8%E6%88%B7%E4%BF%A1%E6%81%AF
   */
  getUserView(param: { user_id: string; guild_id?: string }): Promise<Kook.User>;

  /**
   * 下线机器人
   * @doc https://developer.kookapp.cn/doc/http/user#%E4%B8%8B%E7%BA%BF%E6%9C%BA%E5%99%A8%E4%BA%BA
   */
  offline(): Promise<void>;

  /**
   * 上线机器人
   * @note 上线机器人, 仅限webhook使用。websocket直接连上信令服务器即视为上线。
   * @warning 该接口的允许调用频率较低,仅用于允许开发者不经过界面上线机器人。当出现过多错误下线时，请尽量先排查问题再上线，而不是直接调用该接口。
   * @doc https://developer.kookapp.cn/doc/http/user#%E4%B8%8A%E7%BA%BF%E6%9C%BA%E5%99%A8%E4%BA%BA
   */
  online(): Promise<void>;

  /**
   * 获取在线状态
   * @doc https://developer.kookapp.cn/doc/http/user#%E8%8E%B7%E5%8F%96%E5%9C%A8%E7%BA%BF%E7%8A%B6%E6%80%81
   */
  getOnlineStatus(): Promise<BotOnlineStatus>;

  /**
   * 加入语音频道
   * @doc https://developer.kookapp.cn/doc/http/voice#%E5%8A%A0%E5%85%A5%E8%AF%AD%E9%9F%B3%E9%A2%91%E9%81%93
   */
  joinVoice(param: {
    channel_id: string;
    audio_ssrc?: string;
    audio_pt?: string;
    rtcp_mux?: boolean;
    password?: string;
  }): Promise<IVoiceInfo>;

  /**
   * 获取机器人加入的语音频道列表
   * @doc https://developer.kookapp.cn/doc/http/voice#%E8%8E%B7%E5%8F%96%E9%A2%91%E9%81%93%E5%88%97%E8%A1%A8
   */
  listJoinedVoice(
    param?: Kook.Pagination,
  ): Promise<Kook.List<{ id: string; guild_id: string; parent_id: string; name: string }>>;

  /**
   * 离开语音频道
   * @doc https://developer.kookapp.cn/doc/http/voice#%E7%A6%BB%E5%BC%80%E8%AF%AD%E9%9F%B3%E9%A2%91%E9%81%93
   */
  leaveVoice(param: { channel_id: string }): Promise<void>;

  /**
   * 保持语音连接活跃
   * @description 正常如果长时间断流，系统会回收端口等资源，如果不希望系统回收，可以每隔45s，调用该接口，保持端口活跃，这样系统不会回收该端口资源
   * @doc https://developer.kookapp.cn/doc/http/voice#%E4%BF%9D%E6%8C%81%E8%AF%AD%E9%9F%B3%E8%BF%9E%E6%8E%A5%E6%B4%BB%E8%B7%83
   */
  keepVoiceAlive(param: { channel_id: string }): Promise<void>;

  // createAsset(param: { file: FormData }): Promise<{ url: string }>

  /**
   * 获取服务器角色列表
   * @doc https://developer.kookapp.cn/doc/http/guild-role#%E8%8E%B7%E5%8F%96%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A7%92%E8%89%B2%E5%88%97%E8%A1%A8
   */
  getGuildRoleList(
    param: { guild_id: string } & Kook.Pagination,
  ): Promise<Kook.List<Kook.GuildRole>>;

  /**
   * 创建服务器角色
   * @doc https://developer.kookapp.cn/doc/http/guild-role#%E5%88%9B%E5%BB%BA%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A7%92%E8%89%B2
   */
  createGuildRole(param: { name?: string; guild_id: string }): Promise<Kook.GuildRole>;

  /**
   * 更新服务器角色
   * @doc https://developer.kookapp.cn/doc/http/guild-role#%E6%9B%B4%E6%96%B0%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A7%92%E8%89%B2
   */
  updateGuildRole(
    param: { guild_id: string; role_id: number } & Partial<Omit<Kook.GuildRole, 'role_id'>>,
  ): Promise<Kook.GuildRole>;

  /**
   * 删除服务器角色
   * @doc https://developer.kookapp.cn/doc/http/guild-role#%E5%88%A0%E9%99%A4%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A7%92%E8%89%B2
   */
  deleteGuildRole(param: { guild_id: string; role_id: number }): Promise<void>;

  /**
   * 赋予用户角色
   * @doc https://developer.kookapp.cn/doc/http/guild-role#%E8%B5%8B%E4%BA%88%E7%94%A8%E6%88%B7%E8%A7%92%E8%89%B2
   */
  grantGuildRole(param: {
    guild_id: string;
    user_id?: string;
    role_id: number;
  }): Promise<Kook.GuildRoleReturn>;

  /**
   * 删除用户角色
   * @doc https://developer.kookapp.cn/doc/http/guild-role#%E5%88%A0%E9%99%A4%E7%94%A8%E6%88%B7%E8%A7%92%E8%89%B2
   */
  revokeGuildRole(param: {
    guild_id: string;
    user_id?: string;
    role_id: number;
  }): Promise<Kook.GuildRoleReturn>;

  /**
   * 获取用户亲密度
   * @doc https://developer.kookapp.cn/doc/http/intimacy#%E8%8E%B7%E5%8F%96%E7%94%A8%E6%88%B7%E4%BA%B2%E5%AF%86%E5%BA%A6
   * @deprecated 此功能已被官方下线，新 Bot 不可用
   */
  getIntimacy(param: { user_id: string }): Promise<Kook.Intimacy>;

  /**
   * 更新用户亲密度
   * @doc https://developer.kookapp.cn/doc/http/intimacy#%E6%9B%B4%E6%96%B0%E7%94%A8%E6%88%B7%E4%BA%B2%E5%AF%86%E5%BA%A6
   * @deprecated 此功能已被官方下线，新 Bot 不可用
   */
  updateIntimacy(param: {
    user_id: string;
    score?: number;
    social_info?: string;
    img_id?: string;
  }): Promise<void>;

  /**
   * 获取服务器表情列表
   * @doc https://developer.kookapp.cn/doc/http/guild-emoji#%E8%8E%B7%E5%8F%96%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A1%A8%E6%83%85%E5%88%97%E8%A1%A8
   */
  getGuildEmojiList(param?: Kook.Pagination): Promise<Kook.List<Kook.Emoji>>;

  // createGuildEmoji(param: { name?: string; guild_id: string; emoji: FormData }): Promise<Emoji>

  /**
   * 更新服务器表情
   * @doc https://developer.kookapp.cn/doc/http/guild-emoji#%E6%9B%B4%E6%96%B0%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A1%A8%E6%83%85
   */
  updateGuildEmoji(param: { name: string; id: string }): Promise<void>;

  /**
   * 删除服务器表情
   * @doc https://developer.kookapp.cn/doc/http/guild-emoji#%E5%88%A0%E9%99%A4%E6%9C%8D%E5%8A%A1%E5%99%A8%E8%A1%A8%E6%83%85
   */
  deleteGuildEmoji(param: { id: string }): Promise<void>;

  /**
   * 获取邀请列表
   * @doc https://developer.kookapp.cn/doc/http/invite#%E8%8E%B7%E5%8F%96%E9%82%80%E8%AF%B7%E5%88%97%E8%A1%A8
   */
  getInviteList(
    param: { guild_id?: string; channel_id?: string } & Kook.Pagination,
  ): Promise<Kook.List<Kook.Invite>>;

  /**
   * 创建邀请链接
   * @doc https://developer.kookapp.cn/doc/http/invite#%E5%88%9B%E5%BB%BA%E9%82%80%E8%AF%B7%E9%93%BE%E6%8E%A5
   */
  createInvite(param: {
    guild_id?: string;
    channel_id?: string;
    duration?: number;
    setting_times?: number;
  }): Promise<{ url: string }>;

  /**
   * 删除邀请链接
   * @doc https://developer.kookapp.cn/doc/http/invite#%E5%88%A0%E9%99%A4%E9%82%80%E8%AF%B7%E9%93%BE%E6%8E%A5
   */
  deleteInvite(param: { url_code: string; guild_id?: string; channel_id?: string }): Promise<void>;

  /**
   * 获取黑名单列表
   * @doc https://developer.kookapp.cn/doc/http/blacklist#%E8%8E%B7%E5%8F%96%E9%BB%91%E5%90%8D%E5%8D%95%E5%88%97%E8%A1%A8
   */
  getBlacklist(param: { guild_id: string } & Kook.Pagination): Promise<Kook.List<Kook.BlackList>>;

  /**
   * 加入黑名单
   * @doc https://developer.kookapp.cn/doc/http/blacklist#%E5%8A%A0%E5%85%A5%E9%BB%91%E5%90%8D%E5%8D%95
   */
  createBlacklist(param: {
    guild_id: string;
    target_id: string;
    remark?: string;
    del_msg_days?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }): Promise<void>;

  /**
   * 移除黑名单
   * @doc https://developer.kookapp.cn/doc/http/blacklist#%E7%A7%BB%E9%99%A4%E9%BB%91%E5%90%8D%E5%8D%95
   */
  deleteBlacklist(param: { guild_id: string; target_id: string }): Promise<void>;

  /**
   * 获取服务器 Badge
   * @doc https://developer.kookapp.cn/doc/http/badge#%E8%8E%B7%E5%8F%96%E6%9C%8D%E5%8A%A1%E5%99%A8%20Badge
   */
  getGuildBadge(param: { guild_id: string; style?: 0 | 1 | 2 }): Promise<void>;

  /**
   * 游戏列表
   * @doc https://developer.kookapp.cn/doc/http/game#%E6%B8%B8%E6%88%8F%E5%88%97%E8%A1%A8
   */
  getGameList(param?: { type?: 0 | 1 | 2 }): Promise<Kook.List<Kook.Game>>;

  /**
   * 添加游戏
   * @doc https://developer.kookapp.cn/doc/http/game#%E6%B7%BB%E5%8A%A0%E6%B8%B8%E6%88%8F
   */
  createGame(param: { name: string; icon?: string }): Promise<Kook.List<Kook.Game>>;

  /**
   * 更新游戏
   * @doc https://developer.kookapp.cn/doc/http/game#%E6%9B%B4%E6%96%B0%E6%B8%B8%E6%88%8F
   */
  updateGame(param: { id: number; name?: string; icon?: string }): Promise<Kook.List<Kook.Game>>;

  /**
   * 删除游戏
   * @doc https://developer.kookapp.cn/doc/http/game#%E5%88%A0%E9%99%A4%E6%B8%B8%E6%88%8F
   */
  deleteGame(param: { id: number }): Promise<void>;

  /**
   * 添加游戏/音乐记录-开始玩/听
   * @doc https://developer.kookapp.cn/doc/http/game#%E6%B7%BB%E5%8A%A0%E6%B8%B8%E6%88%8F/%E9%9F%B3%E4%B9%90%E8%AE%B0%E5%BD%95-%E5%BC%80%E5%A7%8B%E7%8E%A9/%E5%90%AC
   */
  createGameActivity(param: {
    /** 请求数据类型 `1` 游戏 `2` 音乐 **/
    data_type: 1;
    id: number;
  }): Promise<void>;
  createGameActivity(param: {
    /** 请求数据类型 `1` 游戏 `2` 音乐 **/
    data_type: 2;
    id: number;
    software: 'cloudmusic' | 'qqmusic' | 'kugou';
    singer: string;
    music_name: string;
  }): Promise<void>;

  /**
   * 删除游戏/音乐记录-结束玩/听
   * @doc https://developer.kookapp.cn/doc/http/game#%E5%88%A0%E9%99%A4%E6%B8%B8%E6%88%8F/%E9%9F%B3%E4%B9%90%E8%AE%B0%E5%BD%95-%E7%BB%93%E6%9D%9F%E7%8E%A9/%E5%90%AC
   */
  deleteGameActivity(param: { data_type: 1 | 2 }): Promise<void>;

  /**
   * 获取AccessToken
   * @doc https://developer.kookapp.cn/doc/http/oauth#%E8%8E%B7%E5%8F%96AccessToken
   */
  getToken(param: {
    grant_type: 'authorization_code';
    client_id: string;
    client_secret: string;
    code: string;
    redirect_uri: string;
  }): Promise<Kook.AccessToken>;
}
