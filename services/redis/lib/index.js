"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redis = exports.name = exports.BeeQueue = exports.commandOptions = void 0;
const kook_cordis_1 = require("kook-cordis");
const redis_1 = require("redis");
Object.defineProperty(exports, "commandOptions", { enumerable: true, get: function () { return redis_1.commandOptions; } });
const bee_queue_1 = __importDefault(require("bee-queue"));
exports.BeeQueue = bee_queue_1.default;
exports.name = 'redis';
const logger = (0, kook_cordis_1.createLogger)(exports.name);
class Redis extends kook_cordis_1.Service {
    config;
    client;
    createdClients = [];
    //protected beeRedis: RedisClientType;
    constructor(ctx, config) {
        super(ctx, 'redis', false);
        this.config = config;
        this.client = (0, redis_1.createClient)({ url: config.url });
        //this.beeRedis = createClient({ url: config.url });
    }
    async createRedisClient() {
        const client = (0, redis_1.createClient)({ url: this.config.url });
        await client
            .on('error', (err) => {
            logger.error(err, '子 Redis 出错');
        })
            .connect();
        this.createdClients.push([this[kook_cordis_1.Context.current], client]);
        return client;
    }
    createQueueProducer(name, options = {
        getEvents: false,
        isWorker: false,
        redis: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
        }, // this.beeRedis,
        activateDelayedJobs: true,
    }) {
        return new bee_queue_1.default(name, options);
    }
    createQueueWorker(name, options = {
        redis: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
        }, //this.beeRedis,
        activateDelayedJobs: true,
    }) {
        return new bee_queue_1.default(name, options);
    }
    async start() {
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
    stop() {
        this.client.disconnect();
    }
}
exports.Redis = Redis;
exports.default = Redis;
(function (Redis) {
    Redis.Config = kook_cordis_1.Schema.object({
        url: kook_cordis_1.Schema.string().description('Redis').default('redis://127.0.0.1:6379'),
    });
})(Redis || (exports.Redis = Redis = {}));
