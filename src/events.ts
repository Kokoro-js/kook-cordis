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
  IRemovedEmojiBody,
  ISelfExitedGuildBody,
  ISelfJoinedGuildBody,
  IUnPinnedMessageBody,
  IUpdatedEmojiBody,
  IUpdatedGuildBody,
  IUpdatedGuildMemberBody,
  IUpdatedMessageBody,
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
  // 群组
  'message'(session: Data<MessageExtra>): void;
  'message-created'(session: Data<MessageExtra>): void;
  'message-deleted'(session: Data<SystemExtra<IDeletedMessageBody>>): void;
  'message-updated'(session: Data<SystemExtra<IUpdatedMessageBody>>): void;
  'message-pinned'(session: Data<SystemExtra<IPinnedMessageBody>>): void;
  'message-unpinned'(session: Data<SystemExtra<IUnPinnedMessageBody>>): void;
  'reaction-added'(session: Data<SystemExtra<IAddedReactionBody>>): void;
  'reaction-removed'(session: Data<SystemExtra<IDeletedReactionBody>>): void;
  'channel-added'(session: Data<SystemExtra<IAddedChannelBody>>): void;
  'channel-deleted'(session: Data<SystemExtra<IDeletedChannelBody>>): void;

  // 服务器成员
  'member-joined'(session: Data<SystemExtra<IJoinedGuildBody>>): void;
  'member-exited'(session: Data<SystemExtra<IExitedGuildBody>>): void;
  'member-updated'(session: Data<SystemExtra<IUpdatedGuildMemberBody>>): void;
  'member-online'(session: Data<SystemExtra<IGuildMemberOnlineBody>>): void;
  'member-offline'(session: Data<SystemExtra<IGuildMemberOfflineBody>>): void;

  // 服务器角色
  'roles-added'(session: Data<SystemExtra<IAddedRoleBody>>): void;
  'roles-removed'(session: Data<SystemExtra<IDeletedRoleBody>>): void;
  'roles-updated'(session: Data<SystemExtra<IUpdatedRoleBody>>): void;

  // 服务器操作
  'guild-updated'(session: Data<SystemExtra<IUpdatedGuildBody>>): void;
  'guild-deleted'(session: Data<SystemExtra<IDeletedGuildBody>>): void;
  'block-added'(session: Data<SystemExtra<IAddedBlockListBody>>): void;
  'block-removed'(session: Data<SystemExtra<IDeletedBlockListBody>>): void;
  'emoji-added'(session: Data<SystemExtra<IAddedEmojiBody>>): void;
  'emoji-removed'(session: Data<SystemExtra<IRemovedEmojiBody>>): void;
  'emoji-updated'(session: Data<SystemExtra<IUpdatedEmojiBody>>): void;

  // 用户操作相关
  'voice-joined'(session: Data<SystemExtra<IJoinedChannelBody>>): void;
  'voice-exited'(session: Data<SystemExtra<IExitedChannelBody>>): void;
  'user-updated'(session: Data<SystemExtra<IUserUpdatedBody>>): void;
  'self-guild-joined'(session: Data<SystemExtra<ISelfJoinedGuildBody>>): void;
  'self-guild-leave'(session: Data<SystemExtra<ISelfExitedGuildBody>>): void;
  'button-click'(session: Data<SystemExtra<IMessageButtonClickBody>>): void;
}
