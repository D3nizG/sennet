import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { setupSocketIO } from './socket/index.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const prisma = new PrismaClient();

// Resilience: a single stray rejection or exception in a handler should not
// crash-loop the entire game server. Log it and keep serving connected players.
// (Fatal startup/listen errors still exit — see httpServer.on('error') below.)
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '[process] Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, '[process] Uncaught exception');
});

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp(prisma);
  const httpServer = createServer(app);
  const io = setupSocketIO(httpServer, prisma);

  // Fail fast on startup/listen errors (e.g. port in use) — these are fatal and
  // must not be swallowed by the uncaughtException handler above.
  httpServer.on('error', (err) => {
    logger.error({ err }, 'HTTP server error — exiting');
    process.exit(1);
  });

  httpServer.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info('Socket.IO ready');
    logger.info({ env: config.nodeEnv }, 'Environment');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    io.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
