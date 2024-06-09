import { Context, createLogger, Dict, Schema, Service } from 'kook-cordis';
import { InfluxDB, Point, WriteApi, WriteOptions } from '@influxdata/influxdb-client';
import { PrometheusDriver } from './query/driver';

export * from '@influxdata/influxdb-client';
export { default as TimeRangeParser } from 'time-range-parser';

export const name = 'stats';
const logger = createLogger(name);

declare module 'kook-cordis' {
  interface Context {
    stats: Stats;
  }

  interface Events {}
}

export class Stats extends Service {
  influxDB: InfluxDB;
  defaultWriter: WriteApi;
  queryClient: PrometheusDriver;

  constructor(
    ctx: Context,
    public config: Stats.Config,
  ) {
    super(ctx, 'stats', false);

    const influxDB = new InfluxDB({
      url: config.INFLUX_URL,
    });
    const queryClient = new PrometheusDriver({
      endpoint: config.INFLUX_URL,
    });

    this.defaultWriter = influxDB.getWriteApi(undefined, undefined, 'ms', {
      batchSize: this.config.DEFAULT_BATCH_LENGTH,
      flushInterval: this.config.DEFAULT_FLUSH_INTERVAL,
    });

    this.influxDB = influxDB;
    this.queryClient = queryClient;

    /*
    ctx.on('command/execute', (command, bot, session) => {
      const point = new Point('command')
        .tag('guild', session.guildId)
        .tag('name', command.name)
        .stringField('runner', session.userId);
      this.defaultWriter.writePoint(point);
    });

    ctx.on('message', (bot, session) => {
      const point = new Point('message')
        .tag('guild', session.guildId)
        .stringField('sender', session.userId);
      this.defaultWriter.writePoint(point);
    });*/
  }

  protected async start() {
    const point = new Point('service').booleanField('stats', true);
    this.defaultWriter.writePoint(point);
    await this.defaultWriter.flush();
  }

  createWriter(
    org: string = this.config.INFLUX_ORG,
    bucket: string = this.config.INFLUX_BUCKET,
    writeOption?: Partial<WriteOptions>,
    tags?: Dict<string>,
  ) {
    const writeApi = this.influxDB.getWriteApi(
      org,
      bucket,
      'ms',
      writeOption ?? {
        batchSize: this.config.DEFAULT_BATCH_LENGTH,
        flushInterval: this.config.DEFAULT_FLUSH_INTERVAL,
      },
    );
    writeApi.useDefaultTags(tags);
    return writeApi;
  }
}

export default Stats;

export namespace Stats {
  export interface Config {
    INFLUX_URL?: string;
    INFLUX_TOKEN?: string;
    INFLUX_ORG?: string;
    INFLUX_BUCKET?: string;
    DEFAULT_BATCH_LENGTH?: number;
    DEFAULT_FLUSH_INTERVAL: number;
  }

  export const Config: Schema<Config> = Schema.object({
    INFLUX_URL: Schema.string().default('http://localhost:8428'),
    INFLUX_TOKEN: Schema.string().default(undefined),
    INFLUX_ORG: Schema.string().default(undefined),
    INFLUX_BUCKET: Schema.string().default(undefined),
    DEFAULT_BATCH_LENGTH: Schema.natural().default(1000),
    DEFAULT_FLUSH_INTERVAL: Schema.natural().default(60000),
  });
}
