export interface IBaseAPIResponse<T = any> {
	code: number
	message: string
	data: T
}

export interface UserME {
	id: string
	username: string
	identify_num: string
	online: boolean
	os: string
	status: number
	avatar: string
	banner: string
	bot: boolean
	mobile_verified: boolean
	client_id: string
	mobile_prefix: string
	mobile: string
	invited_count: number
}

export * from './types'
