import { Context } from './context';
import { Bot } from './bot';
import { logger } from './Logger';

const ctx = new Context({ webhook: '/kook', port: 1000, compressed: false });
const botFork1 = ctx.plugin(Bot, {
  verifyToken: 'ZJ2N-emqiqnVDAOh',
  token: 'token1',
});
const botFork2 = ctx.plugin(Bot, {
  verifyToken: 'jXKDK-OapX7G3NPi',
  token: 'token2',
});

const bot1: Bot = ctx.bots['ZJ2N-emqiqnVDAOh'];
const bot2: Bot = ctx.bots['jXKDK-OapX7G3NPi'];

bot1.sendMessage('8385444041238345', 'hello').then((r) => logger.info(r));
// bot2.sendMessage('8385444041238345', 'hellot').then((r) => logger.info(r));

ctx.channel('8385444041238345').on('webhook', (bot, payload) => {
  bot.sendMessage(
    '8385444041238345',
    '嘿，这是一个仅仅接收该频道 Webhook 的回复' + payload.d.content,
  );
});

ctx.on('webhook', (bot, payload) => {
  bot.sendMessage('8385444041238345', '这是一个不过滤频道的 Webhook 回复' + payload.d.content);
});
