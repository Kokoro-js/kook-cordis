import pino from 'pino';

export const logger = pino({
  name: 'Kook',
  level: process.env.LEVEL || 'info',
});
