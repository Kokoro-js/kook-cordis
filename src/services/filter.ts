import { defineProperty } from 'cosmokit';
import { Context } from '../context';
import { Session } from '../types';

export type Filter = (session: Session<any>) => boolean;
// 移除 Session 中的 data，并将所有 string 属性转为 string[]
interface FilterData {
  userId?: string[];
  channelId?: string[];
  selfId?: string[];
  guildId?: string[];
}

declare module '../context' {
  interface Context {
    $filter: FilterService;
    filter: Filter;
    filterData: FilterData;
    any(): this;
    never(): this;
    union(arg: Filter | this): this;
    intersect(arg: Filter | this): this;
    exclude(arg: Filter | this): this;
    user(...values: string[]): this;
    self(...values: string[]): this;
    guild(...values: string[]): this;
    channel(...values: string[]): this;
    private(...values: string[]): this;
  }
}

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
  static readonly methods = [
    'any',
    'never',
    'union',
    'intersect',
    'exclude',
    'user',
    'self',
    'guild',
    'channel',
    'private',
  ];

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

  // 不返回新的 Context，直接更改当前对象的 Filter，影响所有已注册在当前 Context 的 lifecycle
  addThisFilter(newFilter: Partial<FilterData>) {
    const { caller } = this;

    // 检查并合并过滤器数据
    const mergeFilterData = (source: FilterData, addition: Partial<FilterData>) => {
      for (const key in addition) {
        if (addition[key]) {
          if (source[key]) {
            source[key] = source[key].concat(addition[key]);
          } else {
            source[key] = addition[key];
          }
        }
      }
    };

    if (!caller.filterData) {
      caller.filterData = newFilter;

      const dynamicFilter: Filter = (session) => {
        for (const key in caller.filterData) {
          const checker: string[] = caller.filterData[key];
          if (!checker.includes(session[key])) return false;
        }
        return true;
      };

      const originalFilter = caller.filter || ((s) => true); // 如果 originalFilter 不存在，则默认为始终返回 true 的函数
      caller.filter = (s) => originalFilter(s) && dynamicFilter(s);
    } else {
      mergeFilterData(caller.filterData, newFilter);
    }

    return caller.filterData;
  }

  removeThisFilter(filterToRemove: Partial<FilterData>) {
    const { caller } = this;

    // 检查并从过滤器数据中移除指定的条件
    const removeFilterData = (source: FilterData, target: Partial<FilterData>) => {
      for (const key in target) {
        if (target[key] && source[key]) {
          source[key] = source[key].filter((item) => !target[key].includes(item));
          if (source[key].length === 0) {
            delete source[key];
          }
        }
      }
    };

    if (!caller.filterData) {
      // 如果没有过滤数据，则没有什么可以删除的
      return;
    }

    removeFilterData(caller.filterData, filterToRemove);

    // 如果 after removing, filterData 为空，重置过滤器
    if (Object.keys(caller.filterData).length === 0) {
      delete caller.filterData;
      caller.filter = null;
    }

    return caller.filterData;
  }

  private(...values: string[]) {
    return property(this.caller.exclude(property(this.caller, 'guildId')), 'userId', ...values);
  }
}
