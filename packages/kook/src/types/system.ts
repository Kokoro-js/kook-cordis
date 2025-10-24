import type { Channel, GuildRole, MessageType, User } from './base'
import type { Emoji, IKMarkdownParts, MessageMeta } from './message'

export interface IBaseSystemExtra {
	type: NoticeType
	body: IAddedRoleBody | { a: string }
}

export interface SystemExtra<T> {
	type: NoticeType
	body: T
}

export interface Notice {
	type: NoticeType
	body: NoticeBody
}

export interface NoticeBody extends Omit<Channel, 'type'>, MessageMeta, GuildRole {
	value: string
	msg_id: string
	target_id: string
	channel_id: string
	operator_id: string
	emoji: Emoji
	content: string
	icon: string
	notify_type: number
	region: string
	enable_open: number
	openId: number
	default_channel_id: string
	welcome_channel_id: string
	updated_at: number
	joined_at: number
	exited_at: number
	deleted_at: number
	nickname: string
	chat_code: string
	event_time: number
	guilds: string[]
}

export type NoticeType =
	| 'user_updated'
	| 'message_btn_click'
	| 'added_reaction'
	| 'deleted_reaction'
	| 'updated_message'
	| 'deleted_message'
	| 'pinned_message'
	| 'unpinned_message'
	| 'joined_guild'
	| 'exited_guild'
	| 'updated_guild_member'
	| 'updated_guild'
	| 'deleted_guild'
	| 'self_joined_guild'
	| 'self_exited_guild'
	| 'added_role'
	| 'deleted_role'
	| 'updated_role'
	| 'added_block_list'
	| 'deleted_block_list'
	| 'added_emoji'
	| 'updated_emoji'
	| 'added_channel'
	| 'updated_channel'
	| 'deleted_channel'
	| 'updated_private_message'
	| 'deleted_private_message'
	| 'private_added_reaction'
	| 'private_deleted_reaction'
	| 'joined_channel'
	| 'exited_channel'
	| 'guild_member_online'
	| 'guild_member_offline'

export interface IMentions {
	mention: number[]
	mention_all: boolean
	mention_here: boolean
	mention_roles: number[]
}

export interface IAddedReactionBody {
	msg_id: string
	user_id: string
	channel_id: string
	emoji: Emoji
	channel_type: 1 | 2
}

export interface IDeletedReactionBody extends IAddedReactionBody {}

export type IUpdatedMessageBody = {
	version_id: string
	channel_id: string
	content: string
	updated_at: number
	kmarkdown?: Omit<IKMarkdownParts, 'raw_content' | 'spl'>
	last_msg_content: string
	embeds: any[]
	msg_id: string
	channel_type: 1 | 2
} & IMentions

export type IDeletedMessageBody = {
	channel_id: string
	content: string
	pin: number | null
	pined_time: number | null
	type: MessageType
	msg_id: string
	created_at: number
	channel_type: 1 | 2
} & IMentions

export interface IAddedChannelBody extends Channel {}

export interface IUpdatedChannelBody extends Channel {}

export interface IDeletedChannelBody {
	id: string
	deleted_at: number
	type: 1 | 2
}

export interface IPinnedMessageBody {
	channel_id: string
	operator_id: string
	msg_id: string
	channel_type: 1 | 2
}

export interface IUnPinnedMessageBody extends IPinnedMessageBody {}

export interface IUpdatedPrivateMessageBody {
	author_id: string
	target_id: string
	msg_id: string
	content: string
	updated_at: number
	chat_code: string
}

export interface IDeletedPrivateMessageBody {
	chat_code: string
	msg_id: string
	author_id: string
	target_id: string
	deleted_at: number
}

export interface IPrivateAddedReactionBody {
	emoji: Emoji
	user_id: string
	chat_code: string
	msg_id: string
}

export interface IPrivateDeletedReactionBody extends IPrivateAddedReactionBody {}

export interface IJoinedGuildBody {
	user_id: string
	joined_at: number
}

export interface IExitedGuildBody {
	user_id: string
	exited_at: number
}

export interface IUpdatedGuildMemberBody {
	user_id: string
	nickname: string
}

export interface IGuildMemberOnlineBody {
	user_id: string
	event_time: number
	guilds: string[]
}

export interface IGuildMemberOfflineBody extends IGuildMemberOnlineBody {}

export interface IAddedRoleBody extends GuildRole {}

export interface IDeletedRoleBody extends GuildRole {}

export interface IUpdatedRoleBody extends GuildRole {}

export interface IUpdatedGuildBody {
	id: string
	name: string
	user_id: string
	icon: string
	notify_type: 1 | 2 | 3
	region: string
	enable_open: 1 | 0
	open_id: number
	default_channel_id: string
	welcome_channel_id: string
}

export interface IDeletedGuildBody extends IUpdatedGuildBody {}

export interface IAddedBlockListBody extends IDeletedBlockListBody {
	remark: string
}

export interface IDeletedBlockListBody {
	operator_id: string
	user_id: string[]
}

export interface IAddedEmojiBody {
	id: string
	name: string
}

export interface IRemovedEmojiBody extends IAddedEmojiBody {}

export interface IUpdatedEmojiBody extends IAddedEmojiBody {}

export interface IJoinedChannelBody {
	user_id: string
	channel_id: string
	joined_at: number
}

export interface IExitedChannelBody {
	user_id: string
	channel_id: string
	exited_at: number
}

export interface IUserUpdatedBody {
	user_id: string
	username: string
	avatar: string
}

export interface ISelfJoinedGuildBody {
	guild_id: string
}

export interface ISelfExitedGuildBody {
	guild_id: string
}

export interface IMessageButtonClickBody {
	value: string
	msg_id: string
	user_id: string
	target_id: string
	channel_type: 'GROUP' | 'PERSON'
	user_info: User
	guild_id?: string
}
