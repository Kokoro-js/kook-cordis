import { Context } from './context';
import { NoticeType, Session } from './types';
import { KookEvent } from './events';
import { createLogger } from './Logger';

const logger = createLogger('Kook-Events');
export function internalWebhook(ctx: Context, bot, data) {
  // 大多数情况下都为信息
  const session: Session<any> = {
    userId: data.author_id === '1' ? data.extra.body.user_id : data.author_id,
    channelId: undefined,
    guildId: undefined,
    selfId: bot?.userME?.id,
    data: data,
  };
  session[Context.filter] = (ctx) => ctx.filter(session);

  // 不是特定类型，当作普通信息
  if (data.type !== 255) {
    session.guildId = data.extra?.guild_id;
    session.channelId = data.target_id;

    processEvent(ctx, session, 'message', bot);
    if (data.channel_type === 'GROUP') {
      processEvent(ctx, session, 'message-created', bot);
    }
    if (data.channel_type === 'PERSON') {
      session.guildId = data.target_id;
      processEvent(ctx, session, 'private-message-created', bot);
    }
    return;
  }
  // Handle webhook and button clicks
  handleSpecialTypes(data, session, ctx, bot);
}

function handleSpecialTypes(data, session, ctx, bot) {
  session.guildId = data.extra.body?.guild_id || data.target_id;
  session.channelId = data.extra.body?.channel_id || data.target_id;

  switch (data.extra.type) {
    case 'message_btn_click':
      session.channelId = data.extra.body.target_id;
      const result = ctx.bail('internal/button', bot, session);
      if (result !== undefined) {
        if (typeof result == 'string') session.data.extra.body.value = result;
        else if (!result) return;
      }

      ctx
        .serial(session, 'serial-button-click', bot, session)
        .catch((e) => logger.error(e, 'Error processing event "serial-button-click"'));
      processEvent(ctx, session, 'button-click', bot);
      break;
    default:
      processEvent(ctx, session, eventMap[data.extra.type] || 'webhook', bot);
  }
}

function processEvent(ctx, session, eventType, bot) {
  ctx.parallel(session, eventType, bot, session).catch((e) => {
    logger.error(e, `Error processing event ${eventType}:`);
  });
}

const eventMap: { [K in NoticeType]: keyof KookEvent } = {
  user_updated: 'user-updated',
  message_btn_click: 'button-click',
  added_reaction: 'reaction-added',
  deleted_reaction: 'reaction-removed',
  updated_message: 'message-updated',
  deleted_message: 'message-deleted',
  pinned_message: 'message-pinned',
  unpinned_message: 'message-unpinned',
  joined_guild: 'member-joined',
  exited_guild: 'member-exited',
  updated_guild_member: 'member-updated',
  updated_guild: 'guild-updated',
  deleted_guild: 'guild-deleted',
  self_joined_guild: 'self-guild-joined',
  self_exited_guild: 'self-guild-leave',
  added_role: 'roles-added',
  deleted_role: 'roles-removed',
  updated_role: 'roles-updated',
  added_block_list: 'block-added',
  deleted_block_list: 'block-removed',
  added_emoji: 'emoji-added',
  updated_emoji: 'emoji-updated',
  added_channel: 'channel-added',
  updated_channel: 'channel-updated',
  deleted_channel: 'channel-deleted',
  updated_private_message: 'private-message-updated',
  deleted_private_message: 'private-message-deleted',
  private_added_reaction: 'private-reaction-added',
  private_deleted_reaction: 'private-reaction-removed',
  joined_channel: 'voice-joined',
  exited_channel: 'voice-exited',
  guild_member_online: 'member-online',
  guild_member_offline: 'member-offline',
};

/*export const name = 'event-tiggger';
export function apply(ctx: Context) {
  ctx.on(
    'internal/webhook',
    (bot, data) => {
      const uuid = randomUUID();
      console.time(uuid);
      logger.info('触发内部 webhook 筛选器');
      const session: Session = {
        userId: data.author_id == '1' ? data.extra.body.user_id : data.author_id,
        channelId: data.target_id,
        guildId: data.extra.guild_id || data.target_id,
        selfId: bot.userME.id,
      };
      session[Context.filter] = (ctx) => {
        return ctx.filter(session);
      };

      if (data.type != 255) {
        ctx.parallel(session, 'message', bot, data);
        if (data.channel_type == 'GROUP') ctx.parallel(session, 'message-created', bot, data);
        if (data.channel_type == 'PERSON')
          ctx.parallel(session, 'private-message-created', bot, data);
        return;
      }
      ctx.parallel(session, 'webhook', bot, data);
      ctx.parallel(session, eventMap[data.extra.type], bot, data);
      console.timeEnd(uuid);
    },
    true,
  );
}*/
