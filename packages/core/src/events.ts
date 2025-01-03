import {
  EventSession,
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
  MessageSession,
  PayLoad,
} from './types';
import { Bot } from './bot';
import {
  AllowedMethod,
  Commander,
  CommandInstance,
  Filter,
  FilterService,
  IHelpMessage,
  Middleware,
  Processor,
  RouteHandler,
  Routers,
} from './services';
import { Flags } from 'type-flag';
import { Awaitable } from 'cosmokit';
import { GetEvents } from 'cordis';
import { Context } from './context';

export interface KookEvent {
  'internal/webhook'(bot: Bot, payload: PayLoad): void;
  'internal/button'(bot: Bot, session: EventSession<IMessageButtonClickBody>): any;

  'message'(bot: Bot, session: MessageSession<MessageExtra>): void;
  // 群组
  'message-created'(bot: Bot, session: MessageSession<MessageExtra>): void;
  'message-deleted'(bot: Bot, session: EventSession<IDeletedMessageBody>): void;
  'message-updated'(bot: Bot, session: EventSession<IUpdatedMessageBody>): void;
  'message-pinned'(bot: Bot, session: EventSession<IPinnedMessageBody>): void;
  'message-unpinned'(bot: Bot, session: EventSession<IUnPinnedMessageBody>): void;
  'reaction-added'(bot: Bot, session: EventSession<IAddedReactionBody>): void;
  'reaction-removed'(bot: Bot, session: EventSession<IDeletedReactionBody>): void;
  'channel-added'(bot: Bot, session: EventSession<IAddedChannelBody>): void;
  'channel-updated'(bot: Bot, session: EventSession<IUpdatedChannelBody>): void;
  'channel-deleted'(bot: Bot, session: EventSession<IDeletedChannelBody>): void;

  // 私聊
  'private-message-created'(bot: Bot, session: MessageSession<MessageExtra>): void;
  'private-message-deleted'(bot: Bot, session: EventSession<IDeletedPrivateMessageBody>): void;
  'private-message-updated'(bot: Bot, session: EventSession<IUpdatedPrivateMessageBody>): void;
  'private-reaction-added'(bot: Bot, session: EventSession<IPrivateAddedReactionBody>): void;
  'private-reaction-removed'(bot: Bot, session: EventSession<IPrivateDeletedReactionBody>): void;

  // 服务器成员
  'member-joined'(bot: Bot, session: EventSession<IJoinedGuildBody>): void;
  'member-exited'(bot: Bot, session: EventSession<IExitedGuildBody>): void;
  'member-updated'(bot: Bot, session: EventSession<IUpdatedGuildMemberBody>): void;
  'member-online'(bot: Bot, session: EventSession<IGuildMemberOnlineBody>): void;
  'member-offline'(bot: Bot, session: EventSession<IGuildMemberOfflineBody>): void;

  // 服务器角色
  'roles-added'(bot: Bot, session: EventSession<IAddedRoleBody>): void;
  'roles-removed'(bot: Bot, session: EventSession<IDeletedRoleBody>): void;
  'roles-updated'(bot: Bot, session: EventSession<IUpdatedRoleBody>): void;

  // 服务器操作
  'guild-updated'(bot: Bot, session: EventSession<IUpdatedGuildBody>): void;
  'guild-deleted'(bot: Bot, session: EventSession<IDeletedGuildBody>): void;
  'block-added'(bot: Bot, session: EventSession<IAddedBlockListBody>): void;
  'block-removed'(bot: Bot, session: EventSession<IDeletedBlockListBody>): void;
  'emoji-added'(bot: Bot, session: EventSession<IAddedEmojiBody>): void;
  'emoji-removed'(bot: Bot, session: EventSession<IRemovedEmojiBody>): void;
  'emoji-updated'(bot: Bot, session: EventSession<IUpdatedEmojiBody>): void;

  // 用户操作相关
  'voice-joined'(bot: Bot, session: EventSession<IJoinedChannelBody>): void;
  'voice-exited'(bot: Bot, session: EventSession<IExitedChannelBody>): void;
  'user-updated'(bot: Bot, session: EventSession<IUserUpdatedBody>): void;
  'self-guild-joined'(bot: Bot, session: EventSession<ISelfJoinedGuildBody>): void;
  'self-guild-leave'(bot: Bot, session: EventSession<ISelfExitedGuildBody>): void;

  // 按钮操作
  'button-click'(bot: Bot, session: EventSession<IMessageButtonClickBody>): void;
  'serial-button-click'(bot: Bot, session: EventSession<IMessageButtonClickBody>): void;
}

export interface ServiceEvent {
  'event/error'(session: any, eventType: keyof GetEvents<Context>, error: any): void;
  'middleware'(bot: Bot, data: MessageSession): void;

  'command/before-parse'(
    input: string,
    bot: Bot,
    session: MessageSession,
  ): Awaitable<void | string | boolean>;

  'command/before-execute'(
    command: CommandInstance,
    bot: Bot,
    session: MessageSession,
  ): Awaitable<void | string>;

  'command/not-found'(bot: Bot, session: MessageSession): Awaitable<void | string>;
  'command/execute'(command: CommandInstance, bot: Bot, session: MessageSession): void;
}

export interface ServiceContext {
  //
  $filter: FilterService;
  filter: Filter;
  any(): this;
  never(): this;
  union(arg: Filter | this): this;
  intersect(arg: Filter | this): this;
  exclude(arg: Filter | this): this;
  user(...values: string[]): this;
  self(...values: string[]): this;
  guild(...values: string[]): this;
  channel(...values: string[]): this;
  private(...values: string[]): this;

  // middleware
  $processor: Processor;
  middleware(middleware: Middleware, prepend?: boolean): () => boolean;

  // router
  $routers: Routers;
  router(method: AllowedMethod, path: string, handler: RouteHandler): void;

  // commander
  $commander: Commander;

  command<T extends Flags, P extends string>(
    commandName: P,
    description: string,
    options: T,
  ): CommandInstance<T, P>;

  get commands(): CommandInstance[];

  executeString(
    bot: Bot,
    session: MessageSession,
    input?: string,
  ): Promise<CommandInstance[] | undefined>;

  addCommandHelp(message: IHelpMessage): IHelpMessage;
}
