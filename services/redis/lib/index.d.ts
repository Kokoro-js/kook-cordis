import { Context, Schema, Service } from 'kook-cordis';
import { commandOptions, RedisClientType } from 'redis';
import BeeQueue from 'bee-queue';
export { commandOptions, BeeQueue };
export declare const name = "redis";
declare module 'kook-cordis' {
    interface Context {
        redis: Redis;
    }
    interface Events {
    }
}
export declare class Redis extends Service {
    config: Redis.Config;
    client: RedisClientType;
    createdClients: [Context, RedisClientType][];
    constructor(ctx: Context, config: Redis.Config);
    createRedisClient(): Promise<RedisClientType>;
    createQueueProducer(name: string, options?: BeeQueue.QueueSettings): BeeQueue<any>;
    createQueueWorker(name: string, options?: BeeQueue.QueueSettings): BeeQueue<any>;
    protected start(): Promise<void>;
    protected stop(): void;
}
export default Redis;
export declare namespace Redis {
    interface Config {
        url?: string;
    }
    const Config: Schema<Config>;
}
