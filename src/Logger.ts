import pino from 'pino';

const logger = pino({
  name: 'Kook',
  level: process.env.LEVEL || 'info',
});

function createLogger(name: string) {
  return logger.child({ name: name });
}

export { pino, logger, createLogger };
