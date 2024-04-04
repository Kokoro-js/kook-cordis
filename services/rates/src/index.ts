import {
  Bot,
  CommandInstance,
  Context,
  createLogger,
  Kook,
  Schema,
  Service,
  Time,
} from 'kook-cordis';
import {} from 'cordis-service-redis';

export const name = 'rates';
const logger = createLogger(name);

declare module 'kook-cordis' {
  interface Context {
    rates: Rates;
  }

  interface Events {
    'command/spam'(times: number, bot: Bot, session: Kook.MessageSession<Kook.MessageExtra>): void;
    'button/spam'(
      times: number,
      bot: Bot,
      session: Kook.EventSession<Kook.IMessageButtonClickBody>,
    ): void;
  }
}

export class Rates extends Service {
  // 声明依赖的服务
  static inject = ['redis'];
  static rateBucket = Symbol('Bucket');
  static rateInterval = Symbol('Interval');
  protected parseLuaSha: string;
  public periodExeLuaSha: string;

  constructor(
    ctx: Context,
    public config: Rates.Config,
  ) {
    super(ctx, 'rates', true);
    this.config.interval = this.config.interval * Time.second;

    // 默认设置一个防止用户高强度刷信息来骗相似指令匹配
    ctx.on('command/before-parse', async (input, bot, session) => {
      const cooldownKey = `cooldown:${session.userId}`;
      const multiplierKey = `multiplier:${session.userId}`;

      // 执行 Lua 脚本
      const newMultiplier = (await ctx.redis.client.evalSha(this.parseLuaSha, {
        keys: [cooldownKey, multiplierKey],
      })) as number;

      // 根据 newMultiplier 的值判断用户是否在冷却期
      // lua 脚本中指明了返回 0
      if (newMultiplier == 0) return true;

      // 如果 newMultiplier 不为0，表示用户在冷却期
      if (newMultiplier < config.multi_steps * 3) {
        bot
          .sendMessage(session.channelId, '请减速发送命令，您正在发送得太快了！')
          .catch(logger.error);
      }

      if (newMultiplier == config.emit_times) {
        ctx.parallel('command/spam', newMultiplier, bot, session).catch(logger.error);
      }

      return false;
    });

    ctx.on('internal/button', async (bot, session) => {
      const cooldownKey = `cooldown:${session.userId}`;
      const multiplierKey = `multiplier:${session.userId}`;

      // 执行 Lua 脚本
      const newMultiplier = (await ctx.redis.client.evalSha(this.parseLuaSha, {
        keys: [cooldownKey, multiplierKey],
      })) as number;

      // 根据 newMultiplier 的值判断用户是否在冷却期
      // lua 脚本中指明了返回 0
      if (newMultiplier == 0) return true;

      if (newMultiplier < config.multi_steps * 3) {
        bot
          .sendMessage(session.channelId, '请减速点击按钮，否则机器人将不再响应请求！', {
            temp_target_id: session.userId,
          })
          .catch((e) => logger.error(e, '按钮速率限制发生错误'));
      }

      if (newMultiplier == config.emit_times) {
        ctx.parallel('button/spam', newMultiplier, bot, session).catch(logger.error);
      }

      return false;
    });

    ctx.on('command/execute', async (command, bot, session) => {
      const symbols = Object.getOwnPropertySymbols(command);

      let interval, period, times;
      for (const symbol of symbols) {
        if (symbol == Rates.rateInterval) interval = command[Rates.rateInterval];
        if (symbol == Rates.rateBucket) [period, times] = command[Rates.rateBucket];
      }

      if (interval) {
        const key = `${name}_cooldown:${session.userId}:${command.name}`;
        // 使用位图尽可能节省内存
        ctx.redis.client
          .multi()
          .setBit(key, 0, 1)
          .expire(key, interval)
          .exec()
          .catch((e) => {
            logger.error(e, '添加冷却遇到错误');
          });
      }

      if (!period) return;

      const bucketKey = `${name}_bucket:${session.userId}:${command.name}`;

      const availableTimes = await ctx.redis.client.evalSha(this.periodExeLuaSha, {
        keys: [bucketKey],
        arguments: [String(times), String(period)],
      });

      bot
        .sendMessage(
          session.channelId,
          `指令限额 ${availableTimes}/${times + 1}，每 ${period} 秒刷新一次。`,
          { temp_target_id: session.userId },
        )
        .catch(logger.error);
    });
  }

  /**
   * 一个用于给指令添加时段内使用次数的函数
   * @param command - 指令对象，你 ctx.command 的时候会获得
   * @param {number} period - 时段，以 s 计，比如每小时 3600s。
   * @param {number} times - 时段内使用次数
   */
  per(command: CommandInstance, period: number, times: number) {
    times = times - 1;
    command[Rates.rateBucket] = [period, times];

    command.checkers[`bucket`] = async (bot, session) => {
      const key = `${name}_bucket:${session.userId}:${command.name}`;
      const availableTimes = ((await this.ctx.redis.client.get(key)) as unknown as number) || times;

      if (availableTimes <= 0) {
        bot
          .sendMessage(
            session.channelId,
            `你已消耗完该指令该时段的使用次数，该指令被设定为每 ${period} 秒使用 ${times} 次。`,
          )
          .catch(logger.error);
        return false;
      }
    };

    // 在 rates-limit 被卸载时移除 checker，虽然我们并不建议运行时移除。
    this.ctx.runtime.disposables.push(() => {
      delete command.checkers['bucket'];
      delete command[Rates.rateBucket];
    });
  }

  /**
   * 一个用于给指令添加时段内使用次数的函数
   * @param command - 指令对象，你 ctx.command 的时候会获得
   * @param {number} interval - 冷却时长，以 s 计，比如每小时 3600s。
   */
  interval(command: CommandInstance, interval: number) {
    command[Rates.rateInterval] = interval;

    command.checkers['cooldown'] = async (bot, session) => {
      const key = `${name}_cooldown:${session.userId}:${command.name}`;
      const cooldownSecond = await this.ctx.redis.client.ttl(key);

      if (cooldownSecond > 0) {
        bot
          .sendMessage(session.channelId, `冷却中，请等待 ${cooldownSecond} 秒后重试。`)
          .catch(logger.error);
        return false;
      }
    };

    this.ctx.runtime.disposables.push(() => {
      delete command.checkers['cooldown'];
      delete command[Rates.rateInterval];
    });
  }

  protected async start() {
    // 使用 EXISTS 命令检查 cooldownKey 是否存在
    // 如果 cooldownKey 存在，表示用户当前处于冷却期
    // -- 递增 multiplierKey 的值
    // -- 根据新的倍数计算新的冷却时间
    // -- 更新 cooldownKey 的冷却时间
    // -- 设置 multiplierKey 的过期时间为新的冷却时间的两倍
    const beforeParseScript = `
        local isCooldownActive = redis.call("EXISTS", KEYS[1])
        
        if isCooldownActive == 1 then
            local newMultiplier = redis.call("INCRBY", KEYS[2], ${this.config.multi_steps})
            local newCooldown = newMultiplier * ${this.config.interval}
            redis.call("SET", KEYS[1], "1", "PX", newCooldown)
            redis.call("PEXPIRE", KEYS[2], newCooldown * ${this.config.multi_steps})
            return newMultiplier
        else
            redis.call("SET", KEYS[1], "1", "PX", ${this.config.interval})
            return 0
        end
    `;

    // ARGV[1] = maxTokens, ARGV[2] = Period
    const periodExeScript = `
    local tokens = tonumber(ARGV[1])
    local expire = tonumber(ARGV[2])
    
    if redis.call("SET", KEYS[1], tokens, "EX", expire, "NX") then 
      return ARGV[1]
    else
      return redis.call("DECR", KEYS[1])
    end`;

    this.parseLuaSha = await this.ctx.redis.client.scriptLoad(beforeParseScript);
    this.periodExeLuaSha = await this.ctx.redis.client.scriptLoad(periodExeScript);
  }
}

export default Rates;

export namespace Rates {
  export interface Config {
    interval?: number;
    multi_steps: number;
    emit_times?: number;
  }

  export const Config: Schema<Config> = Schema.object({
    interval: Schema.natural().default(1),
    multi_steps: Schema.natural().default(4),
    emit_times: Schema.number().default(10),
  });
}
