[![downloads](https://img.shields.io/npm/dm/kook-cordis?style=flat-square)](https://www.npmjs.com/package/kook-cordis)
[![npm](https://img.shields.io/npm/v/kook-cordis?style=flat-square)](https://www.npmjs.com/package/kook-cordis)

加入我们的 [Kook频道](https://kook.top/UzctXt) 来与开发者取得联系。
```typescript
// 目前只支持 Webhook 
const ctx = new Context({ webhook: '/kook', port: 1000, compressed: false });

const botFork1 = ctx.plugin(Bot, {
  verifyToken: '你的 verifyToken',
  token: '你的 Token',
});

const bot1: Bot = ctx.bots['你的 verifyToken'];
bot1.sendMessage('any channel id', 'hello').then((r) => logger.info(r));

// 过滤器演示
ctx.channel('any channel id').on('message', (bot, payload) => {
  bot.sendMessage(
    'any channel id',
    '嘿，这是一个仅仅接收该频道 Webhook 的回复' + payload.data.content,
  );
});

// 指令演示
ctx.command('main <test1> <test3> [test2]', '显示当前环境下的信息', {}).action((argv) => {
  return `必填参数: ${argv.test1} ${argv.test3}, 选填参数 ${argv.test2}`;
});

// 路由插件演示(默认前缀 /api，比如下边的要访问 IP:port/api/abab/a)
ctx.router('get', '/abab/a', (res, req) => {
  res.end('ni hao');
});

// 期望顺序 2 - 3 - 1，输入 /unregister 后不再生效
ctx.command('unregister', '取消注册中间件', {}).action((argv) => {
  plugin1.dispose()
});

const plugin1 = ctx.plugin((ctx) => {
  ctx.middleware(async (bot, session, next) => {
    await bot.sendMessage(session.channelId, '一号中间件');
    await next();
    return '让我们在这里结束';
  });

  
  ctx.middleware(async (bot, session, next) => {
    await bot.sendMessage(session.channelId, '二号中间件');
    await next();
  }, true); // 这里的 true 代表注册前置中间件

  ctx.middleware((bot, session, next) => {
    bot.sendMessage(session.channelId, '三号中间件');
  });
})
```