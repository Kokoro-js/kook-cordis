import { Context } from './context';
import { Bot } from './bot';
import { logger } from './Logger';

const ctx = new Context({ webhook: '/kook', port: 1000, compressed: false });
const botFork1 = ctx.plugin(Bot, {
  verifyToken: 'ZJ2N-emqiqnVDAOh',
  token: '1/MjI5Nzk=/0hYA2S204qaaFNMXNiiXwQ==',
});
// const botFork2 = ctx.plugin(Bot, {
//   verifyToken: 'jXKDK-OapX7G3NPi',
//   token: 'token2',
// });
const bot1: Bot = ctx.bots['ZJ2N-emqiqnVDAOh'];
const bot2: Bot = ctx.bots['jXKDK-OapX7G3NPi'];

bot1.sendMessage('8385444041238345', 'hello').then((r) => logger.info(r));
// bot2.sendMessage('8385444041238345', 'hellot').then((r) => logger.info(r));

ctx.channel('8385444041238345').on('message', (bot, payload) => {
  bot.sendMessage(
    '8385444041238345',
    '嘿，这是一个仅仅接收该频道 Webhook 的回复' + payload.data.content,
  );
});

ctx.on('message', (bot, payload) => {
  if (payload.data.content == 'unregister') {
    plugin1.dispose();
  } else if (payload.data.content == 'inspect') {
    return payload.channelId;
  }
});
const plugin1 = ctx.channel('8385444041238345').plugin((ctx) => {
  ctx.middleware(async (bot, session) => {
    await bot.sendMessage(session.channelId, '请输入一些内容我之后会给你复读');
    const reply = await ctx.prompt(session);
    await bot.sendMessage(session.channelId, reply);
  });

  // 期望顺序 2 - 3 - 1，输入 unregister 后不再生效
  // ctx.middleware(async (bot, session, next) => {
  //   await bot.sendMessage(session.channelId, '一号中间件');
  //   await next();
  //   return '让我们在这里结束';
  // });
  //
  // ctx.middleware(async (bot, session, next) => {
  //   await bot.sendMessage(session.channelId, '二号中间件');
  //   await next();
  // });
  //
  // ctx.middleware((bot, session, next) => {
  //   bot.sendMessage(session.channelId, '三号中间件');
  // });
});
