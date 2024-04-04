import { Context, createLogger, Schema, Service } from 'kook-cordis';
import { commandOptions, createClient, RedisClientType } from 'redis';

export { commandOptions };
export const name = 'redis';
const logger = createLogger(name);

declare module 'kook-cordis' {
  interface Context {
    redis: Redis;
  }
  interface Events {}
}

export class Redis extends Service {
  client: RedisClientType;
  createdClients: [Context, RedisClientType][] = [];

  constructor(
    ctx: Context,
    public config: Redis.Config,
  ) {
    super(ctx, 'redis', false);

    this.client = createClient({ url: config.url });
  }

  async createRedisClient(): Promise<RedisClientType> {
    const client = createClient({ url: this.config.url });
    await client
      .on('error', (err) => {
        logger.error(err, '子 Redis 出错');
      })
      .connect();
    this.createdClients.push([this[Context.current], client as RedisClientType]);
    return client as RedisClientType;
  }

  protected async start() {
    await this.client
      .on('error', (err) => {
        logger.error(err, 'Redis Client Error');
      })
      .connect();
    // await this.beeRedis
    //   .on('error', (err) => {
    //     logger.error('Bee Queue Redis Connection Error', err);
    //   })
    //   .connect();
  }

  protected stop() {
    this.client.disconnect();
  }
}

export default Redis;

export namespace Redis {
  export interface Config {
    url?: string;
  }

  export const Config: Schema<Config> = Schema.object({
    url: Schema.string().description('Redis').default('redis://127.0.0.1:6379'),
  });
}
