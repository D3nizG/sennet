import pino from 'pino';
import { config } from '../config.js';

export const logger = pino(
  config.nodeEnv === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }, level: 'debug' }
    : { level: 'info' },
);
