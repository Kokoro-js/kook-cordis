import type { BodyInit } from 'bun'
import type { KyInstance, Options } from 'ky'
import type * as Kook from '../types'
import type { BotOnlineStatus, DirectMessageGetType, IBaseAPIResponse, IVoiceInfo } from '../types'

/**
 * Unified API envelope error.
 */
export class ResponseError extends Error {
	code: number
	constructor(message: string, code: number) {
		super(message)
		this.name = 'ResponseError'
		this.code = code
	}
}

/** Supported HTTP methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

type JsonLike = Record<string, any> | undefined

type RequestPayload = {
	/** For GET/DELETE */
	searchParams?: Record<string, any>
	/** For POST/PATCH/PUT */
	json?: JsonLike
	/** For uploads */
	body?: BodyInit
}

/**
 * axios → ky 重写版
 * - 使用 ky 实例注入
 * - 自动处理 { code, message, data } 响应包
 * - GET/DELETE 走 searchParams；其他走 json
 * - 抛出 ResponseError（业务非 0）或 ky 自带 HTTPError（非 2xx）
 */
export abstract class AbstactBot {
	abstract http: KyInstance

	/**
	 * Low-level request wrapper.
	 */
	protected async request<T>(
		method: HttpMethod,
		path: string,
		payload?: RequestPayload,
	): Promise<T> {
		const opts: Options = { method }
		if (payload?.searchParams) {
			opts.searchParams = cleanParams(payload.searchParams)
		}
		if (payload?.json !== undefined) {
			opts.json = payload.json
		}
		if (payload?.body !== undefined) {
			opts.body = payload.body
		}

		const res = await this.http(`api/v3${path}`, opts).json<IBaseAPIResponse<T>>()
		if (res.code !== 0) throw new ResponseError(res.message || 'Unexpected Error', res.code)
		return res.data
	}

	/**
	 * Define a thin API method on prototype (keeps declaration-merging style).
	 */
	static define(name: string, method: HttpMethod, path: string) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(AbstactBot.prototype as any)[name] = async function (this: AbstactBot, ...args: any[]) {
			const isQuery = method === 'GET' || method === 'DELETE'
			return await this.request<any>(
				method,
				path,
				isQuery ? { searchParams: args[0] } : { json: args[0] },
			)
		}
	}

	/**
	 * Hand-written endpoints that need custom behavior or composition
	 */
	async sendMessage(
		target_id: string,
		content: string,
		options?: {
			type?: Kook.MessageType
			temp_target_id?: string
			quote?: string
			template_id?: string
		},
	) {
		return await this.request<Kook.MessageReturn>('POST', '/message/create', {
			json: { target_id, content, ...options },
		})
	}

	createTempMessageBuilder(
		target_id: string,
		user_id: string,
		builderOptions?: {
			type?: Kook.MessageType
			quote?: string
			template_id?: string
		},
	) {
		return async (content: string, options?: { type?: Kook.MessageType; quote?: string }) =>
			await this.sendMessage(target_id, content, {
				...builderOptions,
				...options,
				temp_target_id: user_id,
			})
	}

	createMessageBuilder(
		target_id: string,
		builderOptions?: {
			type?: Kook.MessageType
			quote?: string
			template_id?: string
		},
	) {
		return async (content: string, options?: { type?: Kook.MessageType; quote?: string }) =>
			await this.sendMessage(target_id, content, {
				...builderOptions,
				...options,
			})
	}

	async updateMessage(
		msg_id: string,
		content: string,
		options?: {
			type?: Kook.MessageType.kmarkdown | Kook.MessageType.card
			temp_target_id?: string
			quote?: string
			template_id?: string
		},
	) {
		return await this.request<void>('POST', '/message/update', {
			json: { msg_id, content, ...options },
		})
	}

	async deleteMessage(msg_id: string) {
		return await this.request<void>('POST', '/message/delete', {
			json: { msg_id },
		})
	}

	/**
	 * Asset upload helper. Accepts Buffer | Blob | base64 string | FormData
	 */
	async createAsset(file: Buffer | Blob | string | FormData, name = 'asset'): Promise<string> {
		const form = await toFormData(file, name)
		const data = await this.request<{ url: string }>('POST', '/asset/create', {
			body: form,
		})
		return data.url
	}

	/**
	 * Back-compat for old typo method name.
	 */
	async createAssest(file: Buffer | Blob | string | FormData, name = 'asset') {
		return this.createAsset(file, name)
	}
}

/**
 * ========== AUTO-WIRED ENDPOINTS (declaration-merging for strong typing) ==========
 */
AbstactBot.define('getGuildList', 'GET', '/guild/list')
AbstactBot.define('getGuildView', 'GET', '/guild/view')
AbstactBot.define('getGuildUserList', 'GET', '/guild/user-list')
AbstactBot.define('setGuildUserNickname', 'POST', '/guild/nickname')
AbstactBot.define('leaveGuild', 'POST', '/guild/leave')
AbstactBot.define('kickoutGuildUser', 'POST', '/guild/kickout')
AbstactBot.define('getGuildMuteList', 'GET', '/guild-mute/list')
AbstactBot.define('createGuildMute', 'POST', '/guild-mute/create')
AbstactBot.define('deleteGuildMute', 'POST', '/guild-mute/delete')
AbstactBot.define('getGuildBoostHistory', 'GET', '/guild-boost/history')

AbstactBot.define('getChannelList', 'GET', '/channel/list')
AbstactBot.define('getChannelView', 'GET', '/channel/view')
AbstactBot.define('createChannel', 'POST', '/channel/create')
AbstactBot.define('updateChannel', 'POST', '/channel/update')
AbstactBot.define('deleteChannel', 'POST', '/channel/delete')
AbstactBot.define('getChannelUserList', 'GET', '/channel/user-list')
AbstactBot.define('kickChannelUser', 'POST', '/channel/kickout')
AbstactBot.define('moveChannelUser', 'POST', '/channel/move-user')
AbstactBot.define('getChannelRoleIndex', 'GET', '/channel-role/index')
AbstactBot.define('syncChannelRole', 'POST', '/channel-role/sync')
AbstactBot.define('createChannelRole', 'POST', '/channel-role/create')
AbstactBot.define('updateChannelRole', 'POST', '/channel-role/update')
AbstactBot.define('deleteChannelRole', 'POST', '/channel-role/delete')

AbstactBot.define('getMessageList', 'GET', '/message/list')
AbstactBot.define('getMessageView', 'GET', '/message/view')
AbstactBot.define('getMessageReactionList', 'GET', '/message/reaction-list')
AbstactBot.define('addMessageReaction', 'POST', '/message/add-reaction')
AbstactBot.define('deleteMessageReaction', 'POST', '/message/delete-reaction')
AbstactBot.define('sendPipeMessage', 'POST', '/message/send-pipemsg')

AbstactBot.define('getUserJoinedChannelList', 'GET', '/channel-user/get-joined-channel')

AbstactBot.define('getPrivateChatList', 'GET', '/user-chat/list')
AbstactBot.define('getPrivateChatView', 'GET', '/user-chat/view')
AbstactBot.define('createPrivateChat', 'POST', '/user-chat/create')
AbstactBot.define('deletePrivateChat', 'POST', '/user-chat/delete')

AbstactBot.define('getDirectMessageList', 'GET', '/direct-message/list')
AbstactBot.define('createDirectMessage', 'POST', '/direct-message/create')
AbstactBot.define('getDirectMessageView', 'GET', '/direct-message/view')
AbstactBot.define('updateDirectMessage', 'POST', '/direct-message/update')
AbstactBot.define('deleteDirectMessage', 'POST', '/direct-message/delete')
AbstactBot.define('getDirectMessageReactionList', 'GET', '/direct-message/reaction-list')
AbstactBot.define('addDirectMessageReaction', 'POST', '/direct-message/add-reaction')
AbstactBot.define('deleteDirectMessageReaction', 'POST', '/direct-message/delete-reaction')

AbstactBot.define('getGateway', 'GET', '/gateway/index')
AbstactBot.define('getToken', 'POST', '/oauth2/token')

AbstactBot.define('getUserMe', 'GET', '/user/me')
AbstactBot.define('getUserView', 'GET', '/user/view')
AbstactBot.define('offline', 'POST', '/user/offline')
AbstactBot.define('online', 'POST', '/user/online')
AbstactBot.define('getOnlineStatus', 'GET', '/user/get-online-status')

AbstactBot.define('joinVoice', 'POST', '/voice/join')
AbstactBot.define('listJoinedVoice', 'GET', '/voice/list')
AbstactBot.define('leaveVoice', 'POST', '/voice/leave')
AbstactBot.define('keepVoiceAlive', 'POST', '/voice/keep-alive')

AbstactBot.define('getGuildRoleList', 'GET', '/guild-role/list')
AbstactBot.define('createGuildRole', 'POST', '/guild-role/create')
AbstactBot.define('updateGuildRole', 'POST', '/guild-role/update')
AbstactBot.define('deleteGuildRole', 'POST', '/guild-role/delete')
AbstactBot.define('grantGuildRole', 'POST', '/guild-role/grant')
AbstactBot.define('revokeGuildRole', 'POST', '/guild-role/revoke')

AbstactBot.define('getIntimacy', 'GET', '/intimacy/index')
AbstactBot.define('updateIntimacy', 'POST', '/intimacy/update')

AbstactBot.define('getGuildEmojiList', 'GET', '/guild-emoji/list')
AbstactBot.define('updateGuildEmoji', 'POST', '/guild-emoji/update')
AbstactBot.define('deleteGuildEmoji', 'POST', '/guild-emoji/delete')

AbstactBot.define('getInviteList', 'GET', '/invite/list')
AbstactBot.define('createInvite', 'POST', '/invite/create')
AbstactBot.define('deleteInvite', 'POST', '/invite/delete')

AbstactBot.define('getBlacklist', 'GET', '/blacklist/list')
AbstactBot.define('createBlacklist', 'POST', '/blacklist/create')
AbstactBot.define('deleteBlacklist', 'POST', '/blacklist/delete')

AbstactBot.define('getGuildBadge', 'GET', '/badge/guild')
AbstactBot.define('getGameList', 'GET', '/game')
AbstactBot.define('createGame', 'POST', '/game/create')
AbstactBot.define('updateGame', 'POST', '/game/update')
AbstactBot.define('deleteGame', 'POST', '/game/delete')
AbstactBot.define('createGameActivity', 'POST', '/game/activity')
AbstactBot.define('deleteGameActivity', 'POST', '/game/delete-activity')

AbstactBot.define('getTemplateList', 'GET', '/template/list')
AbstactBot.define('createTemplate', 'POST', '/template/create')
AbstactBot.define('updateTemplate', 'POST', '/template/update')
AbstactBot.define('deleteTemplate', 'POST', '/template/delete')

/**
 * ====== Declaration merging for strong typing ======
 */
export interface AbstactBot {
	// guild
	getGuildList(param?: Kook.Pagination): Promise<Kook.GuildList>
	getGuildView(param: { guild_id: string }): Promise<Kook.Guild>
	getGuildUserList(
		param: { guild_id: string } & Partial<{
			channel_id: string
			search: string
			role_id: number
			mobile_verified: 0 | 1
			active_time: 0 | 1
			joined_at: 0 | 1
			filter_user_id: string
		}> &
			Kook.Pagination,
	): Promise<Kook.GuildUserList>
	setGuildUserNickname(param: {
		guild_id: string
		user_id: string
		nickname: string
	}): Promise<void>
	leaveGuild(param: { guild_id: string }): Promise<void>
	kickoutGuildUser(param: { guild_id: string; target_id: string }): Promise<void>
	getGuildMuteList(param: { guild_id: string }): Promise<Kook.GuildMuteList>
	createGuildMute(param: {
		guild_id: string
		user_id: string
		type: Kook.GuildMute.Type
	}): Promise<void>
	deleteGuildMute(param: {
		guild_id: string
		user_id: string
		type: Kook.GuildMute.Type
	}): Promise<void>
	getGuildBoostHistory(param: {
		guild_id: string
		start_time: number
		end_time: number
	}): Promise<Kook.List<Kook.GuildBoost>>

	// channel
	getChannelList(
		param: {
			guild_id: string
			type?: 1 | 2
			parent_id?: string
		} & Kook.Pagination,
	): Promise<Kook.List<Kook.Channel>>
	getChannelView(param: { target_id: string }): Promise<Kook.Channel>
	createChannel(param: {
		guild_id: string
		name: string
		parent_id?: string
		type?: number
		limit_amount?: number
		voice_quality?: string
		is_category?: 0 | 1
	}): Promise<Kook.Channel>
	updateChannel(param: {
		channel_id: string
		name?: string
		level?: number
		parent_id?: string
		topic?: string
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
			| 21600000
		limit_amount?: number
		voice_quality?: string
		password?: string
	}): Promise<Kook.Channel>
	deleteChannel(param: { channel_id: string }): Promise<void>
	getChannelUserList(param: { channel_id: string }): Promise<Kook.User[]>
	moveChannelUser(param: { target_id: string; user_ids: string[] }): Promise<{
		user_ids: string[]
	}>
	kickChannelUser(param: { channel_id: string; user_id: string }): Promise<void>
	getChannelRoleIndex(param: { channel_id: string }): Promise<Kook.ChannelRoleIndex>
	createChannelRole(param: {
		channel_id: string
		type?: 'user_id'
		value?: string
	}): Promise<Omit<Kook.ChannelRole, 'role_id'>>
	createChannelRole(param: {
		channel_id: string
		type: 'role_id'
		value?: string
	}): Promise<Omit<Kook.ChannelRole, 'user_id'>>
	updateChannelRole(param: {
		channel_id: string
		type?: 'user_id'
		value?: string
		allow?: number
		deny?: number
	}): Promise<Omit<Kook.ChannelRole, 'role_id'>>
	updateChannelRole(param: {
		channel_id: string
		type: 'role_id'
		value?: string
		allow?: number
		deny?: number
	}): Promise<Omit<Kook.ChannelRole, 'user_id'>>
	syncChannelRole(param: { channel_id: string }): Promise<Kook.ChannelRoleIndex>
	deleteChannelRole(param: {
		channel_id: string
		type?: 'user_id' | 'role_id'
		value?: string
	}): Promise<void>

	// message
	getMessageList(
		param: {
			target_id: string
			msg_id?: string
			pin?: 0 | 1
			flag?: 'before' | 'around' | 'after'
		} & Kook.Pagination,
	): Promise<Kook.List<Kook.Message>>
	getMessageView(param: { msg_id: string }): Promise<Kook.Message>
	getMessageReactionList(param: { msg_id: string; emoji: string }): Promise<Kook.User[]>
	addMessageReaction(param: { msg_id: string; emoji: string }): Promise<void>
	deleteMessageReaction(param: { msg_id: string; emoji: string; user_id?: string }): Promise<void>
	sendPipeMessage(
		param: {
			access_token: string
			type?: Kook.MessageType
			target_id?: string
		} & Record<string, any>,
	): Promise<void>

	// channel-user
	getUserJoinedChannelList(
		param: { guild_id: string; user_id: string } & Kook.Pagination,
	): Promise<Kook.List<Kook.Channel>>

	// private chat
	getPrivateChatList(
		param?: Kook.Pagination,
	): Promise<Kook.List<Omit<Kook.PrivateChat, 'is_friend' | 'is_blocked' | 'is_target_blocked'>>>
	getPrivateChatView(param: { chat_code: string }): Promise<Kook.PrivateChat>
	createPrivateChat(param: { target_id: string }): Promise<Kook.PrivateChat>
	deletePrivateChat(param: { chat_code: string }): Promise<void>

	// direct message
	getDirectMessageList(
		param: {
			msg_id?: string
			flag?: 'before' | 'around' | 'after'
		} & DirectMessageGetType &
			Kook.Pagination,
	): Promise<{ items: Kook.Message[] }>
	getDirectMessageView(
		param: { chat_code: string; msg_id: string } & Kook.Pagination,
	): Promise<{ items: Kook.Message[] }>
	createDirectMessage(
		param: {
			type?: Kook.MessageType
			content: string
			quote?: string
			nonce?: string
			template_id?: string
		} & DirectMessageGetType,
	): Promise<Kook.MessageReturn>
	updateDirectMessage(param: {
		msg_id: string
		content: string
		quote?: string
		template_id?: string
	}): Promise<void>
	deleteDirectMessage(param: { msg_id: string }): Promise<void>
	getDirectMessageReactionList(param: { msg_id: string; emoji?: string }): Promise<Kook.User[]>
	addDirectMessageReaction(param: { msg_id: string; emoji: string }): Promise<void>
	deleteDirectMessageReaction(param: {
		msg_id: string
		emoji: string
		user_id?: string
	}): Promise<void>

	// gateway & user
	getGateway(param: { compress?: 0 | 1 }): Promise<{ url: string }>
	getUserMe(): Promise<Kook.User>
	getUserView(param: { user_id: string; guild_id?: string }): Promise<Kook.User>
	offline(): Promise<void>
	online(): Promise<void>
	getOnlineStatus(): Promise<BotOnlineStatus>

	// voice
	joinVoice(param: {
		channel_id: string
		audio_ssrc?: string
		audio_pt?: string
		rtcp_mux?: boolean
		password?: string
	}): Promise<IVoiceInfo>
	listJoinedVoice(
		param?: Kook.Pagination,
	): Promise<Kook.List<{ id: string; guild_id: string; parent_id: string; name: string }>>
	leaveVoice(param: { channel_id: string }): Promise<void>
	keepVoiceAlive(param: { channel_id: string }): Promise<void>

	// guild role
	getGuildRoleList(
		param: { guild_id: string } & Kook.Pagination,
	): Promise<Kook.List<Kook.GuildRole>>
	createGuildRole(param: { name?: string; guild_id: string }): Promise<Kook.GuildRole>
	updateGuildRole(
		param: { guild_id: string; role_id: number } & Partial<Omit<Kook.GuildRole, 'role_id'>>,
	): Promise<Kook.GuildRole>
	deleteGuildRole(param: { guild_id: string; role_id: number }): Promise<void>
	grantGuildRole(param: {
		guild_id: string
		user_id?: string
		role_id: number
	}): Promise<Kook.GuildRoleReturn>
	revokeGuildRole(param: {
		guild_id: string
		user_id?: string
		role_id: number
	}): Promise<Kook.GuildRoleReturn>

	// intimacy (deprecated by platform)
	getIntimacy(param: { user_id: string }): Promise<Kook.Intimacy>
	updateIntimacy(param: {
		user_id: string
		score?: number
		social_info?: string
		img_id?: string
	}): Promise<void>

	// emoji
	getGuildEmojiList(param?: Kook.Pagination): Promise<Kook.List<Kook.Emoji>>
	updateGuildEmoji(param: { name: string; id: string }): Promise<void>
	deleteGuildEmoji(param: { id: string }): Promise<void>

	// invite
	getInviteList(
		param: { guild_id?: string; channel_id?: string } & Kook.Pagination,
	): Promise<Kook.List<Kook.Invite>>
	createInvite(param: {
		guild_id?: string
		channel_id?: string
		duration?: number
		setting_times?: number
	}): Promise<{ url: string }>
	deleteInvite(param: { url_code: string; guild_id?: string; channel_id?: string }): Promise<void>

	// blacklist
	getBlacklist(param: { guild_id: string } & Kook.Pagination): Promise<Kook.List<Kook.BlackList>>
	createBlacklist(param: {
		guild_id: string
		target_id: string
		remark?: string
		del_msg_days?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
	}): Promise<void>
	deleteBlacklist(param: { guild_id: string; target_id: string }): Promise<void>

	// badge
	getGuildBadge(param: { guild_id: string; style?: 0 | 1 | 2 }): Promise<void>

	// game
	getGameList(param?: { type?: 0 | 1 | 2 }): Promise<Kook.List<Kook.Game>>
	createGame(param: { name: string; icon?: string }): Promise<Kook.List<Kook.Game>>
	updateGame(param: { id: number; name?: string; icon?: string }): Promise<Kook.List<Kook.Game>>
	deleteGame(param: { id: number }): Promise<void>
	createGameActivity(param: { data_type: 1; id: number }): Promise<void>
	createGameActivity(param: {
		data_type: 2
		id: number
		software: 'cloudmusic' | 'qqmusic' | 'kugou'
		singer: string
		music_name: string
	}): Promise<void>
	deleteGameActivity(param: { data_type: 1 | 2 }): Promise<void>

	// template
	getTemplateList(param?: Kook.Pagination): Promise<Kook.List<Kook.ITemplate>>
	createTemplate(
		param: Pick<Kook.ITemplate, 'title' | 'content'> &
			Partial<Pick<Kook.ITemplate, 'type' | 'msgtype' | 'test_data' | 'test_channel'>>,
	): Promise<Kook.ITemplateReturn>
	updateTemplate(
		param: Pick<Kook.ITemplate, 'id'> &
			Partial<
				Pick<
					Kook.ITemplate,
					'title' | 'content' | 'type' | 'msgtype' | 'test_data' | 'test_channel'
				>
			>,
	): Promise<Kook.ITemplateReturn>
	deleteTemplate(param: Pick<Kook.ITemplate, 'id'>): Promise<void>
}

/**
 * Helpers
 */
function cleanParams(obj: Record<string, any> | undefined) {
	if (!obj) return undefined
	const out: Record<string, any> = {}
	for (const [k, v] of Object.entries(obj)) {
		if (v === undefined) continue
		out[k] = v
	}
	return out
}

async function toFormData(file: Buffer | Blob | string | FormData, name: string) {
	if (typeof file === 'string') {
		// treat as base64
		const b = Buffer.from(file, 'base64')
		file = new Blob([b], { type: 'application/octet-stream' })
	}
	if (isNodeBuffer(file)) {
		file = new Blob([file], { type: 'application/octet-stream' })
	}
	if (file instanceof Blob) {
		const fd = new FormData()
		fd.append('file', file, name)
		return fd
	}
	// already FormData
	return file
}

function isNodeBuffer(x: any): x is Buffer {
	return typeof Buffer !== 'undefined' && x instanceof Buffer
}
