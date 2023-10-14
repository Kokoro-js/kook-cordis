import {
  Data,
  IAddedBlockListBody,
  IAddedChannelBody,
  IAddedEmojiBody,
  IAddedReactionBody,
  IAddedRoleBody,
  IDeletedBlockListBody,
  IDeletedChannelBody,
  IDeletedGuildBody,
  IDeletedMessageBody,
  IDeletedPrivateMessageBody,
  IDeletedReactionBody,
  IDeletedRoleBody,
  IExitedChannelBody,
  IExitedGuildBody,
  IGuildMemberOfflineBody,
  IGuildMemberOnlineBody,
  IJoinedChannelBody,
  IJoinedGuildBody,
  IMessageButtonClickBody,
  IPinnedMessageBody,
  IPrivateAddedReactionBody,
  IPrivateDeletedReactionBody,
  IRemovedEmojiBody,
  ISelfExitedGuildBody,
  ISelfJoinedGuildBody,
  IUnPinnedMessageBody,
  IUpdatedChannelBody,
  IUpdatedEmojiBody,
  IUpdatedGuildBody,
  IUpdatedGuildMemberBody,
  IUpdatedMessageBody,
  IUpdatedPrivateMessageBody,
  IUpdatedRoleBody,
  IUserUpdatedBody,
  MessageExtra,
  PayLoad,
  SystemExtra,
} from './types';
import { Bot } from './bot';

export interface KookEvent {
  'webhook'(bot: Bot, payload: PayLoad): void;
  //  "interaction/command"(session: Session): void;
  'message'(bot: Bot, data: Data<MessageExtra>): void;
  // 群组
  'message-created'(bot: Bot, data: Data<MessageExtra>): void;
  'message-deleted'(bot: Bot, data: Data<SystemExtra<IDeletedMessageBody>>): void;
  'message-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedMessageBody>>): void;
  'message-pinned'(bot: Bot, data: Data<SystemExtra<IPinnedMessageBody>>): void;
  'message-unpinned'(bot: Bot, data: Data<SystemExtra<IUnPinnedMessageBody>>): void;
  'reaction-added'(bot: Bot, data: Data<SystemExtra<IAddedReactionBody>>): void;
  'reaction-removed'(bot: Bot, data: Data<SystemExtra<IDeletedReactionBody>>): void;
  'channel-added'(bot: Bot, data: Data<SystemExtra<IAddedChannelBody>>): void;
  'channel-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedChannelBody>>): void;
  'channel-deleted'(bot: Bot, data: Data<SystemExtra<IDeletedChannelBody>>): void;

  // 私聊
  'private-message-created'(bot: Bot, data: Data<MessageExtra>): void;
  'private-message-deleted'(bot: Bot, data: Data<SystemExtra<IDeletedPrivateMessageBody>>): void;
  'private-message-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedPrivateMessageBody>>): void;
  'private-reaction-added'(bot: Bot, data: Data<SystemExtra<IPrivateAddedReactionBody>>): void;
  'private-reaction-removed'(bot: Bot, data: Data<SystemExtra<IPrivateDeletedReactionBody>>): void;

  // 服务器成员
  'member-joined'(bot: Bot, data: Data<SystemExtra<IJoinedGuildBody>>): void;
  'member-exited'(bot: Bot, data: Data<SystemExtra<IExitedGuildBody>>): void;
  'member-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedGuildMemberBody>>): void;
  'member-online'(bot: Bot, data: Data<SystemExtra<IGuildMemberOnlineBody>>): void;
  'member-offline'(bot: Bot, data: Data<SystemExtra<IGuildMemberOfflineBody>>): void;

  // 服务器角色
  'roles-added'(bot: Bot, data: Data<SystemExtra<IAddedRoleBody>>): void;
  'roles-removed'(bot: Bot, data: Data<SystemExtra<IDeletedRoleBody>>): void;
  'roles-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedRoleBody>>): void;

  // 服务器操作
  'guild-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedGuildBody>>): void;
  'guild-deleted'(bot: Bot, data: Data<SystemExtra<IDeletedGuildBody>>): void;
  'block-added'(bot: Bot, data: Data<SystemExtra<IAddedBlockListBody>>): void;
  'block-removed'(bot: Bot, data: Data<SystemExtra<IDeletedBlockListBody>>): void;
  'emoji-added'(bot: Bot, data: Data<SystemExtra<IAddedEmojiBody>>): void;
  'emoji-removed'(bot: Bot, data: Data<SystemExtra<IRemovedEmojiBody>>): void;
  'emoji-updated'(bot: Bot, data: Data<SystemExtra<IUpdatedEmojiBody>>): void;

  // 用户操作相关
  'voice-joined'(bot: Bot, data: Data<SystemExtra<IJoinedChannelBody>>): void;
  'voice-exited'(bot: Bot, data: Data<SystemExtra<IExitedChannelBody>>): void;
  'user-updated'(bot: Bot, data: Data<SystemExtra<IUserUpdatedBody>>): void;
  'self-guild-joined'(bot: Bot, data: Data<SystemExtra<ISelfJoinedGuildBody>>): void;
  'self-guild-leave'(bot: Bot, data: Data<SystemExtra<ISelfExitedGuildBody>>): void;
  'button-click'(bot: Bot, data: Data<SystemExtra<IMessageButtonClickBody>>): void;
}
