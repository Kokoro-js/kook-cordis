import { Bot, Context, logger } from 'kook-cordis';

// 实例化一个情境
// 启用 webhook 需要 webhook 和 port 被同时设置。
const useWebHook = false;
const ctx = new Context({
  webhook: useWebHook ? '/kook' : undefined,
  port: 1000,
  compressed: false,
});

// 在情境下实例化一个机器人
ctx.plugin(Bot, {
  verifyToken: process.env.BOT_TOKEN,
  token: process.env.BOT_VERIFY,
});

// 一个可行的访问机器人的方式
const bot1: Bot = ctx.bots[process.env.BOT_TOKEN];
// bot1.sendMessage('8385444041238345', '你好').catch((e) => logger.error(e));

// 过滤器
ctx.channel('8385444041238345').on('message', (bot, payload) => {
  bot
    .sendMessage(
      '8385444041238345',
      '嘿，这是一个仅仅接收该频道 Webhook 的回复' + payload.data.content,
    )
    .catch((e) => logger.error(e));
});

// 实现一个仅在特定频道响应的复读
ctx.channel('8385444041238345').middleware(async (bot, session) => {
  await bot.sendMessage(session.channelId, '请输入一些内容我之后会给你复读');
  const reply = await ctx.prompt(session);
  logger.info(reply);
  await bot.sendMessage(session.channelId, reply);
});

ctx.command('main <test1> <test3> [test2]', '显示当前环境下的信息', {}).action((argv) => {
  return `必填参数: ${argv.test1} ${argv.test3}, 选填参数 ${argv.test2}`;
});

ctx.addCommandHelp({
  main: {
    description: '测试',
    required: { test1: '测试1', test2: '测试2' },
    optional: { test3: '测试3' },
    flags: { a: '什么都没有' },
  },
});

// 注册很多指令，然后输入 /inspec
ctx.command('inspectb', '显示当前环境下的信息', {}).action(async (argv, bot, session) => {
  return `用户ID: ${session.userId} \n 频道ID: ${session.channelId} \n 群组ID: ${session.guildId}`;
});

ctx.command('inspectc', '显示当前环境下的信息', {}).action((argv, bot, session) => {
  return `用户ID: ${session.userId} \n 频道ID: ${session.channelId} \n 群组ID: ${session.guildId}`;
});

ctx.command('inspectd', '显示当前环境下的信息', {}).action((argv, bot, session) => {
  return `用户ID: ${session.userId} \n 频道ID: ${session.channelId} \n 群组ID: ${session.guildId}`;
});

ctx.command('inspecte', '显示当前环境下的信息', {}).action((argv, bot, session) => {
  return `用户ID: ${session.userId} \n 频道ID: ${session.channelId} \n 群组ID: ${session.guildId}`;
});

ctx.command('inspectccc', '显示当前环境下的信息', {}).action((argv, bot, session) => {
  bot1.ctx.scope.dispose();
});

// 使用插件来管理
const plugin1 = ctx.plugin((ctx) => {
  ctx.middleware(async (bot, session) => {
    await bot.sendMessage(session.channelId, '请输入一些内容我之后会给你复读');
    const reply = await ctx.prompt(session);
    logger.info(reply);
    await bot.sendMessage(session.channelId, reply);
  });
  // 期望顺序 1 - 2 - 3，输入 unregister 后不再生效
  ctx.middleware(async (bot, session, next) => {
    await bot.sendMessage(session.channelId, '一号中间件');
    await next();
    return '让我们在这里结束';
  });

  ctx.middleware(async (bot, session, next) => {
    await bot.sendMessage(session.channelId, '二号中间件');
    await next();
  });

  ctx.middleware((bot, session, next) => {
    bot.sendMessage(session.channelId, '三号中间件');
  });
});
ctx.command('disable', '关闭插件', {}).action(() => {
  plugin1.dispose();
});
