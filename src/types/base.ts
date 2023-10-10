export interface PayLoad {
  s: number; // 信令类型
  d: Data<any>; // 数据
  sn?: number; // 当 s=0 存在，
}

export enum MessageType {
  text = 1,
  image = 2,
  video = 3,
  file = 4,
  unknown = 7,
  audio = 8,
  kmarkdown = 9,
  card = 10,
  system = 255,
}

export interface Data<T> {
  channel_type: "GROUP" | "PERSON" | "WEBHOOK_CHALLENGE";
  type: MessageType; // 消息类型
  challenge: string; // 仅在 WEBHOOK_CHALLENGE 存在
  verify_token: string;
  target_id: string; // 频道消息类时, 代表的是频道 channel_id，系统时 guild_id
  author_id: string; // 发送者 id, 1 代表系统
  content: string;
  msg_id: string;
  msg_timestamp: number;
  nonce: string; // 随机串，与用户消息发送 api 中传的 nonce 保持一致
  extra: T;
}

export interface User {
  id: string;
  username: string;
  identify_num: string;
  avatar: string;
  online: boolean;
  bot?: boolean;
  roles: number[];
  vip_avatar?: string;
  is_vip?: boolean;
  mobile_verified: boolean;
  joined_at?: number;
  active_time?: number;
  status: UserStatus;
}

export enum UserStatus {
  normal = 0,
  normal_1 = 1,
  banned = 10,
}

export interface GuildRole {
  role_id: number;
  name: string;
  color: number;
  position: number;
  hoist: 0 | 1;
  mentionable: 0 | 1;
  permissions: number;
}

export enum Permissions {
  GUILD_ADMIN = 0,
  GUILD_MANAGE = 1,
  GUILD_LOG = 2,
  GUILD_INVITE_CREATE = 3,
  GUILD_INVITE_MANAGE = 4,
  CHANNEL_MANAGE = 5,
  GUILD_USER_KICK = 6,
  GUILD_USER_BAN = 7,
  GUILD_EMOJI_MANAGE = 8,
  GUILD_USER_NAME_CHANGE = 9,
  GUILD_ROLE_MANAGE = 10,
  CHANNEL_VIEW = 11,
  CHANNEL_MESSAGE = 12,
  CHANNEL_MANAGE_MESSAGE = 13,
  CHANNEL_UPLOAD = 14,
  CHANNEL_VOICE_CONNECT = 15,
  CHANNEL_VOICE_MANAGE = 16,
  CHANNEL_MESSAGE_AT_ALL = 17,
  CHANNEL_MESSAGE_REACTION_CREATE = 18,
  CHANNEL_MESSAGE_REACTION_FOLLOW = 19,
  CHANNEL_VOICE_CONNECT_PASSIVE = 20,
  CHANNEL_VOICE_SPEAK_KEY_ONLY = 21,
  CHANNEL_VOICR_SPEAK_FREE = 22,
  CHANNEL_VOICE_SPEAK = 23,
  GUILD_USER_DEAFEN = 24,
  GUILD_USER_MUTEGUILD_USER_NAME_CHANGE_OTHER = 25,
  GUILD_USER_NAME_CHANGE_OTHER = 26,
  CHANNEL_VOICE_BGM = 27,
}

export function hasPermission(permissions: number, permission: Permissions) {
  return (permissions & (1 << permission)) === 1 << permission;
}

export interface Channel {
  id: string;
  name: string;
  user_id: string;
  guild_id: string;
  is_category: boolean;
  parent_id: string;
  topic: string;
  type: 0 | 1 | 2;
  level: number;
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
  has_password?: boolean;
  limit_amount: number;
  permission_overwrites?: Overwrite[];
  permission_users?: any[];
  permission_sync?: 0 | 1;
  voice_quality?: "1" | "2" | "3";
  server_url?: string;
  children?: string[];
}

export interface Overwrite {
  role_id: number;
  allow: number;
  deny: number;
}
