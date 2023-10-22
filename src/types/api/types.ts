import { Overwrite, User } from '../base';

export interface ChannelRoleIndex {
  permission_overwrites: Overwrite;
  permission_users: List<User>;
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
  invite_enabled: number;
  notify_type: number;
  region: string;
  enable_open: number;
  openId: string;
  default_channel_id: string;
  welcome_channel_id: string;
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
    mic = 1,
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
  page?: number;
  page_size?: number;
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
