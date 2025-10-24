// event-bridge.ts
import type { KookEvent } from './events.types'
import { KK, type EventKey } from './events.symbols'
import type { NoticeType } from '~/types'

const defineBridge = <
  B extends Readonly<Record<NoticeType, EventKey>>
>(b: B) => b

// ✅ “保留”的桥梁：网络字符串 -> 内部 Symbol
export const eventMap = defineBridge({
  user_updated:             KK.USER_UPDATED,
  message_btn_click:        KK.BUTTON_CLICK,
  added_reaction:           KK.REACTION_ADDED,
  deleted_reaction:         KK.REACTION_REMOVED,
  updated_message:          KK.MESSAGE_UPDATED,
  deleted_message:          KK.MESSAGE_DELETED,
  pinned_message:           KK.MESSAGE_PINNED,
  unpinned_message:         KK.MESSAGE_UNPINNED,
  joined_guild:             KK.MEMBER_JOINED,
  exited_guild:             KK.MEMBER_EXITED,
  updated_guild_member:     KK.MEMBER_UPDATED,
  updated_guild:            KK.GUILD_UPDATED,
  deleted_guild:            KK.GUILD_DELETED,
  self_joined_guild:        KK.SELF_GUILD_JOINED,
  self_exited_guild:        KK.SELF_GUILD_LEAVE,
  added_role:               KK.ROLES_ADDED,
  deleted_role:             KK.ROLES_REMOVED,
  updated_role:             KK.ROLES_UPDATED,
  added_block_list:         KK.BLOCK_ADDED,
  deleted_block_list:       KK.BLOCK_REMOVED,
  added_emoji:              KK.EMOJI_ADDED,
  updated_emoji:            KK.EMOJI_UPDATED,
  added_channel:            KK.CHANNEL_ADDED,
  updated_channel:          KK.CHANNEL_UPDATED,
  deleted_channel:          KK.CHANNEL_DELETED,
  updated_private_message:  KK.PRIVATE_MESSAGE_UPDATED,
  deleted_private_message:  KK.PRIVATE_MESSAGE_DELETED,
  private_added_reaction:   KK.PRIVATE_REACTION_ADDED,
  private_deleted_reaction: KK.PRIVATE_REACTION_REMOVED,
  joined_channel:           KK.VOICE_JOINED,
  exited_channel:           KK.VOICE_EXITED,
  guild_member_online:      KK.MEMBER_ONLINE,
  guild_member_offline:     KK.MEMBER_OFFLINE,
} as const)

// 反向：内部 Symbol -> 外部字符串（可用于日志/调试）
export const eventNameByKey = new Map<EventKey, NoticeType>(
  Object.entries(eventMap).map(([k, v]) => [v, k as NoticeType])
)

// —— 帮助类型：从外部事件名得到目标 handler 的参数签名 ——
// 例：ParametersOf<'user_updated'> == Parameters<KookEvent[typeof EVT.USER_UPDATED]>
export type ParametersOf<N extends NoticeType> =
  KookEvent[(typeof eventMap)[N]] extends (...a: infer P) => any ? P : never
export type ReturnOf<N extends NoticeType> =
  KookEvent[(typeof eventMap)[N]] extends (...a: any) => infer R ? R : never
