import { defineProperty } from 'cosmokit';
import { Context, uWS } from '../context';
import { HttpResponse } from 'uWebSockets.js';
import zlib from 'zlib';

export type AllowedMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
export type RouteHandler = (res: uWS.HttpResponse, req: uWS.HttpRequest) => void;
export type Routes = {
  [method in AllowedMethod]: {
    [path: string]: RouteHandler;
  };
};

export class Routers {
  _routes: Routes = { delete: {}, get: {}, patch: {}, post: {}, put: {} };

  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx);

    this.router('get', '/', (res, req) => {
      res.writeStatus('200 OK').end('Kook-cordis Routers is working!');
    });
  }

  protected get caller() {
    return this[Context.current] as Context;
  }

  router(method: AllowedMethod, path: string, handler: RouteHandler) {
    if (this._routes[method][path]) {
      throw new Error('该路由方法的路径上已经有处理函数了');
    }

    this._routes[method][path] = handler;
    // 情境卸载移除路由
    this.caller.runtime.disposables.push(() => this.removeRoute(method, path));
  }

  private removeRoute(method: string, path: string): boolean {
    if (this._routes[method] && this._routes[method][path]) {
      delete this._routes[method][path];

      // 如果该方法下没有其他路由，可以选择删除该方法键，避免空对象
      if (Object.keys(this._routes[method]).length === 0) {
        delete this._routes[method];
      }

      return true; // 表示路由已成功移除
    }
    return false; // 表示没有找到要移除的路由
  }
}

export function readJson(
  res: HttpResponse,
  cb: { (obj: any): void },
  err: (message: string) => void,
  compressed: boolean = false,
) {
  let buffer: Buffer;

  // 注册
  res.onData((ab, isLast) => {
    const chunk = Buffer.from(ab);
    if (buffer) {
      buffer = Buffer.concat([buffer, chunk]);
    } else {
      buffer = Buffer.from(chunk);
    }

    if (isLast) {
      let jsonData;
      if (compressed) {
        zlib.inflate(buffer, (inflateErr, result) => {
          if (inflateErr) {
            // 发生解压缩错误时发送适当的错误响应给客户端
            err('解压遇到了错误' + inflateErr.message);
            res.close();
            return;
          }

          try {
            const decodedData = result.toString('utf8');
            jsonData = JSON.parse(decodedData);
          } catch (e) {
            // 发生JSON解析错误时发送适当的错误响应给客户端
            err('解析遇到了错误' + e.message);
            res.close();
            return;
          }
          cb(jsonData);
        });
      } else {
        try {
          const decodedData = buffer.toString('utf8');
          jsonData = JSON.parse(decodedData);
        } catch (e) {
          // 发生JSON解析错误时发送适当的错误响应给客户端
          err('解析遇到了错误' + e.message);
          res.close();
          return;
        }
        cb(jsonData);
      }
    }
  });

  // 处理客户端中止请求的情况

  res.onAborted(() => {});
}
