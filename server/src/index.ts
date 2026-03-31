import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { setupSocketIO } from './socket/index.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp(prisma);
  const httpServer = createServer(app);
  const io = setupSocketIO(httpServer, prisma);

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
