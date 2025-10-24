import { type Context } from '@pluxel/hmr'
import type { Events } from '@pluxel/hmr/services'
import type { Bot } from './bot'
import { eventMap } from './events'
import type { Session } from './types'
import { BUTTON, KK } from './events/events.symbols';

function processEvent(ctx: Context, eventType: keyof Events, bot: Bot, session: Session<any>) {
	ctx.emit(eventType, bot, session)
}

export function internalWebhook(ctx: Context, bot: Bot, data: any) {
	// 大多数情况下都为信息
	const session: Session<any> = {
		userId: data.author_id === '1' ? data?.extra?.body?.user_id : data?.author_id,
		channelId: '',
		guildId: '',
		selfId: bot?.selfInfo?.id,
		data: data,
	}

	// session[symbols.FILTER] = (ctx: any) => ctx.filter(session)

	// 不是特定类型，当作普通信息
	if (data.type !== 255) {
		if (session.selfId === session.userId) return // 只忽略关于自身的普通消息

		session.guildId = data?.extra?.guild_id
		session.channelId = data?.target_id

		const { value } = ctx.events.waterfall(KK.MESSAGE, bot, session)
		if (value) {
			bot
				.sendMessage(session.channelId, value)
				.catch((e) => ctx.logger.error(e, 'message 监听器返回的信息发送失败。'))
		}
		if (data.channel_type === 'GROUP') {
			processEvent(ctx, KK.MESSAGE_CREATED, bot, session)
		}
		if (data.channel_type === 'PERSON') {
			session.guildId = data?.target_id
			processEvent(ctx, KK.PRIVATE_MESSAGE_CREATED, bot, session)
		}
		return
	}
	// Handle webhook and button clicks
	handleSpecialTypes(ctx, data, bot, session)
}

async function handleSpecialTypes(ctx: Context, data: any, bot: Bot, session: Session<any>) {
	session.guildId = data?.extra?.body?.guild_id || data?.target_id
	session.channelId = data?.extra?.body?.channel_id || data?.target_id

	switch (data.extra.type) {
		case 'message_btn_click': {
			session.channelId = data.extra.body.target_id
			ctx.events.waterfall(KK.BUTTON, bot, session)
			processEvent(ctx, KK.BUTTON_CLICK, bot, session)
			break
		}
		default: {
			const eventType = (eventMap as any)[data?.extra?.type] || data?.extra?.type || 'webhook'
			processEvent(ctx, eventType, bot, session)
		}
	}
}
