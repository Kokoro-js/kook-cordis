const logger = require('pino')({
  name: 'Kook',
  level: process.env.LEVEL || 'info',
});

function createLogger(name: string, level?: number) {
  return logger.child({ name: name, level });
}

export { logger, createLogger };
