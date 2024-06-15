import { Context, createLogger, Schema, Service } from 'kook-cordis';
import PB, { RecordService } from 'pocketbase';
import { BaseSystemFields, TypedPocketBase } from './pocketbase-types';

export type * from './pocketbase-types';
export * from 'pocketbase';

export const name = 'pocketbase';
const logger = createLogger(name);

declare module 'kook-cordis' {
  interface Context {
    pocketbase: PocketBase;
  }
  interface Events {}
}

export class PocketBase extends Service {
  PB: TypedPocketBase;

  constructor(
    ctx: Context,
    public config: PocketBase.Config,
  ) {
    super(ctx, 'pocketbase', false);

    this.PB = new PB(config.url);
  }

  protected async start() {
    this.PB.admins.authWithPassword(this.config.email, this.config.password).then();
  }

  protected stop() {}

  async upsertRecord<T, TExpend = unknown>(
    collection: RecordService<T>,
    recordId: string,
    dataToUpdate: Partial<T>,
    dataToCreate?: T & Partial<BaseSystemFields>,
  ): Promise<Required<T> & BaseSystemFields<TExpend>> {
    try {
      // 尝试获取 record, if not exist will throw 404
      let record = await collection.getOne(recordId);
      // 更新记录
      return await collection.update(recordId, dataToUpdate);
    } catch (error) {
      if (error.status === 404) {
        // 记录不存在，创建它
        logger.info(
          `Record ${recordId} not found in ${collection.collectionIdOrName}, creating...`,
        );
        return await collection.create(dataToCreate || dataToUpdate);
      } else {
        // 处理其他错误
        logger.error('Error retrieving or creating record:', error);
        throw error;
      }
    }
  }

  async getOrCreateRecord<T, TExpend = unknown>(
    collection: RecordService<T>,
    search: string,
    dataToCreate: T & Partial<BaseSystemFields>,
  ): Promise<Required<T> & BaseSystemFields<TExpend>> {
    try {
      return await collection.getFirstListItem(search);
    } catch (error) {
      if (error.status === 404) {
        // 记录不存在，创建它
        logger.info(`Record ${search} not found in ${collection.collectionIdOrName}, creating...`);
        return await collection.create(dataToCreate);
      } else {
        // 处理其他错误
        logger.error('Error retrieving or creating record:', error);
        throw error;
      }
    }
  }

  padTo15Characters(key: string) {
    const maxLength = 15;
    if (key.length > maxLength) {
      return key.slice(0, maxLength); // Truncate if longer than 15
    }
    return key.padEnd(maxLength, '_'); // Pad with '0' if shorter than 15
  }
}

export default PocketBase;

export namespace PocketBase {
  export interface Config {
    url?: string;
    email: string;
    password: string;
  }

  export const Config: Schema<Config> = Schema.object({
    url: Schema.string().description('PocketBase').default('http://127.0.0.1:8090'),
    email: Schema.string().description('PocketBase email').required(),
    password: Schema.string().description('PocketBase password').required(),
  });
}
