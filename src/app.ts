import { Context } from './context';
import { Bot } from './bot';

const ctx = new Context({ webhook: '/kook', port: 1000, compressed: false });
ctx.plugin(Bot, { verifyToken: 'ZJ2N-emqiqnVDAOh', token: '1/MjI5Nzk=/0hYA2S204qaaFNMXNiiXwQ==' });
