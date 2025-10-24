// events.symbols.ts
export const BUTTON = Symbol("button");
export const MESSAGE = Symbol("message");

export const BUTTON_CLICK = Symbol("button-click");
export const MESSAGE_CREATED = Symbol("message-created");
export const MESSAGE_DELETED = Symbol("message-deleted");
export const MESSAGE_UPDATED = Symbol("message-updated");
export const MESSAGE_PINNED = Symbol("message-pinned");
export const MESSAGE_UNPINNED = Symbol("message-unpinned");
export const REACTION_ADDED = Symbol("reaction-added");
export const REACTION_REMOVED = Symbol("reaction-removed");
export const CHANNEL_ADDED = Symbol("channel-added");
export const CHANNEL_UPDATED = Symbol("channel-updated");
export const CHANNEL_DELETED = Symbol("channel-deleted");

export const PRIVATE_MESSAGE_CREATED = Symbol("private-message-created");
export const PRIVATE_MESSAGE_DELETED = Symbol("private-message-deleted");
export const PRIVATE_MESSAGE_UPDATED = Symbol("private-message-updated");
export const PRIVATE_REACTION_ADDED = Symbol("private-reaction-added");
export const PRIVATE_REACTION_REMOVED = Symbol("private-reaction-removed");

export const MEMBER_JOINED = Symbol("member-joined");
export const MEMBER_EXITED = Symbol("member-exited");
export const MEMBER_UPDATED = Symbol("member-updated");
export const MEMBER_ONLINE = Symbol("member-online");
export const MEMBER_OFFLINE = Symbol("member-offline");

export const ROLES_ADDED = Symbol("roles-added");
export const ROLES_REMOVED = Symbol("roles-removed");
export const ROLES_UPDATED = Symbol("roles-updated");

export const GUILD_UPDATED = Symbol("guild-updated");
export const GUILD_DELETED = Symbol("guild-deleted");
export const BLOCK_ADDED = Symbol("block-added");
export const BLOCK_REMOVED = Symbol("block-removed");
export const EMOJI_ADDED = Symbol("emoji-added");
export const EMOJI_REMOVED = Symbol("emoji-removed");
export const EMOJI_UPDATED = Symbol("emoji-updated");

export const VOICE_JOINED = Symbol("voice-joined");
export const VOICE_EXITED = Symbol("voice-exited");
export const USER_UPDATED = Symbol("user-updated");
export const SELF_GUILD_JOINED = Symbol("self-guild-joined");
export const SELF_GUILD_LEAVE = Symbol("self-guild-leave");

// 聚合（可选，仅为方便引用分组）
export const KK = {
	BUTTON,
	MESSAGE,
	BUTTON_CLICK,
	MESSAGE_CREATED,
	MESSAGE_DELETED,
	MESSAGE_UPDATED,
	MESSAGE_PINNED,
	MESSAGE_UNPINNED,
	REACTION_ADDED,
	REACTION_REMOVED,
	CHANNEL_ADDED,
	CHANNEL_UPDATED,
	CHANNEL_DELETED,
	PRIVATE_MESSAGE_CREATED,
	PRIVATE_MESSAGE_DELETED,
	PRIVATE_MESSAGE_UPDATED,
	PRIVATE_REACTION_ADDED,
	PRIVATE_REACTION_REMOVED,
	MEMBER_JOINED,
	MEMBER_EXITED,
	MEMBER_UPDATED,
	MEMBER_ONLINE,
	MEMBER_OFFLINE,
	ROLES_ADDED,
	ROLES_REMOVED,
	ROLES_UPDATED,
	GUILD_UPDATED,
	GUILD_DELETED,
	BLOCK_ADDED,
	BLOCK_REMOVED,
	EMOJI_ADDED,
	EMOJI_REMOVED,
	EMOJI_UPDATED,
	VOICE_JOINED,
	VOICE_EXITED,
	USER_UPDATED,
	SELF_GUILD_JOINED,
	SELF_GUILD_LEAVE,
} as const;

export type EventKey = (typeof KK)[keyof typeof KK]; // union of unique symbol
