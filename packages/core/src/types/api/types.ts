import { Channel, GuildRole, Overwrite, User } from '../base';

export interface ChannelRoleIndex {
  permission_overwrites: Overwrite[];
  permission_users: Array<{ user: User } & Omit<Overwrite, 'role_id'>>;
  permission_sync: 0 | 1;
}

export interface ChannelRole {
  user_id?: string;
  role_id?: string;
  allow: number;
  deny: number;
}

export interface Guild {
  id: string;
  name: string;
  topic: string;
  master_id: string;
  is_master: boolean;
  icon: string;
  notify_type: number;
  region: string;
  enable_open: number;
  openId: string;
  default_channel_id: string;
  welcome_channel_id: string;
  features: any[];
  boost_num: number;
  buffer_boost_num: number;
  level: number;
  status: number;
  auto_delete_time: string;
  roles: GuildRole[];
  channels: Channel[];
  invite_enabled: number;
}

export interface GuildWithUser extends Guild {
  user_config: {
    notify_type: null | any;
    nickname: string;
    role_ids: number[];
    chat_setting: string;
    security_limit: null | any;
    close_mention_all_here: boolean;
    close_mention_role: boolean;
  };
  guest: boolean;
}

export interface GuildList extends List<Guild> {}

export interface GuildUser extends User {
  joined_at: number;
  active_time: number;
  is_master: boolean;
  abbr: string;
}

export interface GuildUserList extends List<GuildUser> {
  user_count: number;
  online_count: number;
  offline_count: number;
}

export namespace GuildMute {
  export enum Type {
    /** 麦克风闭麦 **/
    mic = 1,
    /** 耳机静音 **/
    headset = 2,
  }
}

interface GuildMute {
  type: GuildMute.Type;
  user_ids: string[];
}

export interface GuildMuteList {
  mic: GuildMute;
  headset: GuildMute;
}

export interface GuildBoost {
  user_id: string;
  guild_id: string;
  start_time: number;
  end_time: number;
  user: User;
}

export interface Pagination {
  /** 目标页数 **/
  page?: number;
  /** 每页数据数量 **/
  page_size?: number;
  /**
   * 	代表排序的字段, 比如-id 代表 id 按 DESC 排序，id 代表 id 按 ASC 排序。
   * 	不一定有, 如果有，接口中会声明支持的排序字段。
   */
  sort?: string[];
}

export interface PrivateChat {
  code: string;
  last_read_time: number;
  latest_msg_time: number;
  unread_count: number;
  is_friend: boolean;
  is_blocked: boolean;
  is_target_blocked: boolean;
  target_info: User;
}

export interface ListMeta {
  page: number;
  page_total: number;
  page_size: number;
  total: number;
}

export interface List<T> {
  items: T[];
  meta: ListMeta;
  sort: Partial<Record<keyof T, number>>;
}

export interface AccessToken {
  access_token: string;
  expires_in?: number;
  token_type: 'Bearer';
  scope: string;
}

export interface GuildRoleReturn {
  user_id: string;
  guild_id: string;
  roles: number[];
}

export interface Game {
  id: number;
  name: string;
  type: 0 | 1 | 2;
  options: string;
  kmhook_admin: boolean;
  process_name: string[];
  product_name: string[];
  icon: string;
}

export interface Intimacy {
  img_url: string;
  social_info: string;
  last_read: number;
  score: number;
  img_list: {
    id: string;
    url: string;
  }[];
}

export interface Invite {
  guild_id: string;
  channel_id: string;
  url_code: string;
  url: string;
  user: User;
}

export interface BlackList {
  user_id: string;
  created_time: number;
  remark: string;
  user: User;
}

export interface IVoiceInfo {
  ip: string;
  port: string;
  rtcp_mux: boolean;
  rtcp_port: number;
  bitrate: number;
  audio_ssrc: string;
  audio_pt: string;
}

/**
 * 私信参数：使用 chat_code 查询
 */
interface ByChatCode {
  /** 私信会话 Code。 **/
  chat_code: string;
  target_id?: never;
}

/**
 * 私信参数：使用 target_id 查询
 */
interface ByTargetId {
  /** 目标用户 id，后端会自动创建会话。 **/
  target_id: string;
  chat_code?: never;
}

export type DirectMessageGetType = ByChatCode | ByTargetId;

export interface BotOnlineStatus {
  /** 是否在线 **/
  online: boolean;
  /** 在线的平台 **/
  online_os: string[];
}
