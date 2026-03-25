import type { KmarkdownRoleMeta, KmarkdownUserMeta } from './message';

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
  channel_type: 'GROUP' | 'PERSON' | 'WEBHOOK_CHALLENGE';
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
  online: boolean;
  os: string;
  status: UserStatus;
  avatar: string;
  vip_avatar?: string;
  banner: string;
  nickname: string;
  roles: number[];
  is_vip: boolean;
  vip_amp: boolean;
  bot: boolean;
  nameplate: {
    name: string;
    type: number;
    icon: string;
    tips?: string;
  }[];
  decorations_id_map?: Partial<{
    join_voice: number;
    avatar_border: number;
    background: number;
  }>;
  mobile_verified?: boolean;
  is_sys: boolean;
  joined_at?: number;
  active_time?: number;
}

export type UserMeta = Pick<
  User,
  'id' | 'identify_num' | 'username' | 'avatar' | 'is_vip' | 'vip_avatar' | 'nickname' | 'roles'
>;

export enum UserStatus {
  normal = 0,
  normal_1 = 1,
  banned = 10,
}

export interface GuildRole {
  role_id: number;
  name: string;
  color: number;
  color_type: number;
  color_map: number[];
  position: number;
  hoist: 0 | 1;
  mentionable: 0 | 1;
  permissions: number;
  type: number;
}

export enum Permissions {
  /** 管理员 */
  GUILD_ADMIN = 0,
  /** 管理服务器 */
  GUILD_MANAGE = 1,
  /** 查看管理日志 */
  GUILD_LOG = 2,
  /** 创建服务器邀请 */
  GUILD_INVITE_CREATE = 3,
  /** 管理邀请 */
  GUILD_INVITE_MANAGE = 4,
  /** 频道管理 */
  CHANNEL_MANAGE = 5,
  /** 踢出用户 */
  GUILD_USER_KICK = 6,
  /** 封禁用户 */
  GUILD_USER_BAN = 7,
  /** 管理自定义表情 */
  GUILD_EMOJI_MANAGE = 8,
  /** 修改服务器昵称 */
  GUILD_USER_NAME_CHANGE = 9,
  /** 管理角色权限 */
  GUILD_ROLE_MANAGE = 10,
  /** 查看文字、语音频道 */
  CHANNEL_VIEW = 11,
  /** 发布消息 */
  CHANNEL_MESSAGE = 12,
  /** 管理消息 */
  CHANNEL_MANAGE_MESSAGE = 13,
  /** 上传文件 */
  CHANNEL_UPLOAD = 14,
  /** 语音链接 */
  CHANNEL_VOICE_CONNECT = 15,
  /** 语音管理 */
  CHANNEL_VOICE_MANAGE = 16,
  /** 提及@全体成员 */
  CHANNEL_MESSAGE_AT_ALL = 17,
  /** 添加反应 */
  CHANNEL_MESSAGE_REACTION_CREATE = 18,
  /** 跟随添加反应 */
  CHANNEL_MESSAGE_REACTION_FOLLOW = 19,
  /** 被动连接语音频道 */
  CHANNEL_VOICE_CONNECT_PASSIVE = 20,
  /** 仅使用按键说话 */
  CHANNEL_VOICE_SPEAK_KEY_ONLY = 21,
  /** 使用自由麦 */
  CHANNEL_VOICR_SPEAK_FREE = 22,
  /** 说话 */
  CHANNEL_VOICE_SPEAK = 23,
  /** 服务器静音 */
  GUILD_USER_DEAFEN = 24,
  /** 服务器闭麦 */
  GUILD_USER_MUTE = 25,
  /** 修改他人昵称 */
  GUILD_USER_NAME_CHANGE_OTHER = 26,
  /** 播放伴奏 */
  CHANNEL_VOICE_BGM = 27,
}

export interface Channel {
  id: string;
  guild_id: string;
  master_id: string;
  parent_id: string;
  user_id: string;
  name: string;
  topic: string;
  type: 0 | 1 | 2;
  level: number;
  slow_mode:
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
  last_msg_content: string;
  last_mag_id: string;
  has_password: boolean;
  limit_amount: number;
  is_category: boolean;
  is_readonly?: boolean;
  is_private?: boolean;
  permission_sync: 0 | 1;
  permission_overwrites: Overwrite[];
  permission_users: any[];
  voice_quality?: string;
  server_type?: number;
  server_url?: string;
  children?: string[];
  region?: string;
  sync_guild_region?: number;
}

export interface Overwrite {
  role_id: number;
  allow: number;
  deny: number;
}

export interface ThreadCategoryPermissionRole {
  type: 'role';
  role_id: number;
  user_id: '';
  allow: number;
}

export interface ThreadCategoryPermissionUser {
  type: 'user';
  role_id: 0;
  user_id: string;
  allow: number;
}

export type ThreadCategoryPermission = ThreadCategoryPermissionRole | ThreadCategoryPermissionUser;

export interface Thread {
  id: string;
  /** 帖子状态, `1` 代表审核中，`2` 代表审核通过, `3` 代表编辑审核中 **/
  status: number;
  title: string;
  cover: string;
  /** 主楼id **/
  post_id: string;
  medias: ThreadMedia[];
  preview_content: string;
  user: UserMeta;
  category: Omit<ThreadCategory, 'roles'> | null;
  tags: any[];
  latest_active_time: number;
  create_time: number;
  is_updated: boolean;
  content_deleted: boolean;
  /** 删除类型：`1` 作者自己删除 `2` 管理员删除 `3` 审核删除 **/
  content_deleted_type: number;
  /** 收藏数量 **/
  collect_num: number;
  post_count: number;
}

export type ThreadDetail = Thread & ThreadContentBase;

export interface ThreadCategory {
  id: string;
  name: string;
  allow: number;
  deny: number;
  roles: ThreadCategoryPermission[];
}

export type ThreadPost = {
  /** 评论/回复 id **/
  id: string;
  /** 分区id **/
  category_id: string;
  /** 所属帖子id **/
  thread_id: string;
  /** 回复对象的id（回复主贴为0） **/
  reply_id: string;
  /** 所属的评论的post_id **/
  belong_to_post_id: string;
  is_updated: boolean;
  user: UserMeta;
} & ThreadContentBase;

export interface ThreadContentBase {
  /** 卡片消息 **/
  content: string;
  /** 回复状态, `1` 代表审核中，`2` 代表审核通过, `3` 代表编辑审核中 **/
  status: number;
  /** `@特定用户` 的用户 ID 数组 **/
  mention: string[];
  /** 是否含有 `@全体人员` **/
  mention_all: boolean;
  /** 是否含有 `@在线成员` **/
  mention_here: boolean;
  /** `@特定用户` 详情 **/
  mention_part: KmarkdownUserMeta[];
  /** `@特定角色` 详情 **/
  mention_role_part: KmarkdownRoleMeta[];
  channel_part: any[];
  item_part: any[];
}

export interface ThreadMedia {
  type: number;
  src: string;
  title: string;
}
