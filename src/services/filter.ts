import { defineProperty } from 'cosmokit';
import { Context } from '../context';
import { Session } from '../types';

export type Filter = (session: Session<any>) => boolean;
// 移除 Session 中的 data，并将所有 string 属性转为 string[]

function property<K extends keyof Session<any>>(
  ctx: Context,
  key: K,
  ...values: Session<any>[K][]
) {
  return ctx.intersect((session: Session<any>) => {
    return values.length ? values.includes(session[key]) : !!session[key];
  });
}

export class FilterService {
  constructor(private app: Context) {
    defineProperty(this, Context.current, app);

    app.filter = () => true;
    app.on('internal/runtime', (runtime) => {
      if (!runtime.uid) return;
      runtime.ctx.filter = (session) => {
        return runtime.children.some((p) => p.ctx.filter(session));
      };
    });
  }

  protected get caller() {
    return this[Context.current] as Context;
  }

  any() {
    return this.caller.extend({ filter: () => true });
  }

  never() {
    return this.caller.extend({ filter: () => false });
  }

  union(arg: Filter | Context) {
    const caller = this.caller;
    const filter = typeof arg === 'function' ? arg : arg.filter;
    return this.caller.extend({ filter: (s) => caller.filter(s) || filter(s) });
  }

  intersect(arg: Filter | Context) {
    const caller = this.caller;
    const filter = typeof arg === 'function' ? arg : arg.filter;
    return this.caller.extend({ filter: (s) => caller.filter(s) && filter(s) });
  }

  exclude(arg: Filter | Context) {
    const caller = this.caller;
    const filter = typeof arg === 'function' ? arg : arg.filter;
    return this.caller.extend({ filter: (s) => caller.filter(s) && !filter(s) });
  }

  user(...values: string[]) {
    return property(this.caller, 'userId', ...values);
  }

  self(...values: string[]) {
    return property(this.caller, 'selfId', ...values);
  }

  guild(...values: string[]) {
    return property(this.caller, 'guildId', ...values);
  }

  channel(...values: string[]) {
    return property(this.caller, 'channelId', ...values);
  }

  private(...values: string[]) {
    return property(
      this.caller.exclude((session) => {
        return session.guildId === undefined;
      }),
      'userId',
      ...values,
    );
  }
}
