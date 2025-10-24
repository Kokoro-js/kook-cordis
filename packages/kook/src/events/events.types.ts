// events.types.ts
import type { Bot } from '../bot'
import type {
  EventSession, MessageSession, MessageExtra,
  IMessageButtonClickBody, IUpdatedMessageBody, IDeletedMessageBody,
  IPinnedMessageBody, IUnPinnedMessageBody,
  IAddedReactionBody, IDeletedReactionBody,
  IAddedChannelBody, IUpdatedChannelBody, IDeletedChannelBody,
  IPrivateAddedReactionBody, IPrivateDeletedReactionBody,
  IUpdatedPrivateMessageBody, IDeletedPrivateMessageBody,
  IJoinedGuildBody, IExitedGuildBody, IUpdatedGuildMemberBody,
  IGuildMemberOnlineBody, IGuildMemberOfflineBody,
  IAddedRoleBody, IDeletedRoleBody, IUpdatedRoleBody,
  IUpdatedGuildBody, IDeletedGuildBody,
  IAddedBlockListBody, IDeletedBlockListBody,
  IAddedEmojiBody, IRemovedEmojiBody, IUpdatedEmojiBody,
  IJoinedChannelBody, IExitedChannelBody,
  IUserUpdatedBody, ISelfJoinedGuildBody, ISelfExitedGuildBody,
} from '../types'
import { KK } from './events.symbols'

export interface KookEvent {
  // —— 快路径 ——（保留原有签名）
  [KK.BUTTON](
    bot: Bot,
    session: EventSession<IMessageButtonClickBody>,
    next: (bot: Bot, session: EventSession<IMessageButtonClickBody>) => void,
  ): void

  [KK.MESSAGE](
    bot: Bot,
    session: MessageSession<MessageExtra>,
    next: (bot: Bot, session: MessageSession<MessageExtra>) => string | void,
  ): string | void

  // —— 群组 —— 
  [KK.BUTTON_CLICK](bot: Bot, session: EventSession<IMessageButtonClickBody>): void
  [KK.MESSAGE_CREATED](bot: Bot, session: MessageSession<MessageExtra>): void
  [KK.MESSAGE_DELETED](bot: Bot, session: EventSession<IDeletedMessageBody>): void
  [KK.MESSAGE_UPDATED](bot: Bot, session: EventSession<IUpdatedMessageBody>): void
  [KK.MESSAGE_PINNED](bot: Bot, session: EventSession<IPinnedMessageBody>): void
  [KK.MESSAGE_UNPINNED](bot: Bot, session: EventSession<IUnPinnedMessageBody>): void
  [KK.REACTION_ADDED](bot: Bot, session: EventSession<IAddedReactionBody>): void
  [KK.REACTION_REMOVED](bot: Bot, session: EventSession<IDeletedReactionBody>): void
  [KK.CHANNEL_ADDED](bot: Bot, session: EventSession<IAddedChannelBody>): void
  [KK.CHANNEL_UPDATED](bot: Bot, session: EventSession<IUpdatedChannelBody>): void
  [KK.CHANNEL_DELETED](bot: Bot, session: EventSession<IDeletedChannelBody>): void

  // —— 私聊 —— 
  [KK.PRIVATE_MESSAGE_CREATED](bot: Bot, session: MessageSession<MessageExtra>): void
  [KK.PRIVATE_MESSAGE_DELETED](bot: Bot, session: EventSession<IDeletedPrivateMessageBody>): void
  [KK.PRIVATE_MESSAGE_UPDATED](bot: Bot, session: EventSession<IUpdatedPrivateMessageBody>): void
  [KK.PRIVATE_REACTION_ADDED](bot: Bot, session: EventSession<IPrivateAddedReactionBody>): void
  [KK.PRIVATE_REACTION_REMOVED](bot: Bot, session: EventSession<IPrivateDeletedReactionBody>): void

  // —— 成员 —— 
  [KK.MEMBER_JOINED](bot: Bot, session: EventSession<IJoinedGuildBody>): void
  [KK.MEMBER_EXITED](bot: Bot, session: EventSession<IExitedGuildBody>): void
  [KK.MEMBER_UPDATED](bot: Bot, session: EventSession<IUpdatedGuildMemberBody>): void
  [KK.MEMBER_ONLINE](bot: Bot, session: EventSession<IGuildMemberOnlineBody>): void
  [KK.MEMBER_OFFLINE](bot: Bot, session: EventSession<IGuildMemberOfflineBody>): void

  // —— 角色 —— 
  [KK.ROLES_ADDED](bot: Bot, session: EventSession<IAddedRoleBody>): void
  [KK.ROLES_REMOVED](bot: Bot, session: EventSession<IDeletedRoleBody>): void
  [KK.ROLES_UPDATED](bot: Bot, session: EventSession<IUpdatedRoleBody>): void

  // —— 服务器 —— 
  [KK.GUILD_UPDATED](bot: Bot, session: EventSession<IUpdatedGuildBody>): void
  [KK.GUILD_DELETED](bot: Bot, session: EventSession<IDeletedGuildBody>): void
  [KK.BLOCK_ADDED](bot: Bot, session: EventSession<IAddedBlockListBody>): void
  [KK.BLOCK_REMOVED](bot: Bot, session: EventSession<IDeletedBlockListBody>): void
  [KK.EMOJI_ADDED](bot: Bot, session: EventSession<IAddedEmojiBody>): void
  [KK.EMOJI_REMOVED](bot: Bot, session: EventSession<IRemovedEmojiBody>): void
  [KK.EMOJI_UPDATED](bot: Bot, session: EventSession<IUpdatedEmojiBody>): void

  // —— 用户/语音 —— 
  [KK.VOICE_JOINED](bot: Bot, session: EventSession<IJoinedChannelBody>): void
  [KK.VOICE_EXITED](bot: Bot, session: EventSession<IExitedChannelBody>): void
  [KK.USER_UPDATED](bot: Bot, session: EventSession<IUserUpdatedBody>): void
  [KK.SELF_GUILD_JOINED](bot: Bot, session: EventSession<ISelfJoinedGuildBody>): void
  [KK.SELF_GUILD_LEAVE](bot: Bot, session: EventSession<ISelfExitedGuildBody>): void
}
