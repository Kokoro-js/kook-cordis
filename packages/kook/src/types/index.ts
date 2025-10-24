import type { Data } from './base'
import type { MessageExtra } from './message'
import type { SystemExtra } from './system'

export * from './api'
export * from './base'
export * from './message'
export * from './system'

export type EventSession<T> = Session<Data<SystemExtra<T>>>
export type MessageSession<T = MessageExtra> = Session<Data<T>>

export interface Session<T> {
	userId: string
	selfId: string
	guildId: string
	channelId: string
	data: T
}
