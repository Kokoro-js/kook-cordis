import pino from 'pino';

const logger = pino({
  name: 'Kook',
  level: process.env.LEVEL || 'info',
});

function createLogger(name: string, level?: number) {
  return logger.child({ name: name, level });
}

export { pino, logger, createLogger };
