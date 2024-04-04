import { Bot, CommandInstance, Context, Kook, Schema, Service } from 'kook-cordis';
export declare const name = "rates";
declare module 'kook-cordis' {
    interface Context {
        rates: Rates;
    }
    interface Events {
        'command/spam'(times: number, bot: Bot, session: Kook.MessageSession<Kook.MessageExtra>): void;
        'button/spam'(times: number, bot: Bot, session: Kook.EventSession<Kook.IMessageButtonClickBody>): void;
    }
}
export declare class Rates extends Service {
    config: Rates.Config;
    static inject: string[];
    static rateBucket: symbol;
    static rateInterval: symbol;
    protected parseLuaSha: string;
    periodExeLuaSha: string;
    constructor(ctx: Context, config: Rates.Config);
    /**
     * 一个用于给指令添加时段内使用次数的函数
     * @param command - 指令对象，你 ctx.command 的时候会获得
     * @param {number} period - 时段，以 s 计，比如每小时 3600s。
     * @param {number} times - 时段内使用次数
     */
    per(command: CommandInstance, period: number, times: number): void;
    /**
     * 一个用于给指令添加时段内使用次数的函数
     * @param command - 指令对象，你 ctx.command 的时候会获得
     * @param {number} interval - 冷却时长，以 s 计，比如每小时 3600s。
     */
    interval(command: CommandInstance, interval: number): void;
    protected start(): Promise<void>;
}
export default Rates;
export declare namespace Rates {
    interface Config {
        interval?: number;
        multi_steps: number;
        emit_times?: number;
    }
    const Config: Schema<Config>;
}
