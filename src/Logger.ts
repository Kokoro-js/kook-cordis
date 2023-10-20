import pino from 'pino';

export const logger = pino({
  name: 'Kook',
  level: process.env.LEVEL || 'info',
});

function newLogger(name: string) {
  return logger.child({ name: name });
}

export { pino };
