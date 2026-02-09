import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { setupSocketIO } from './socket/index.js';
import { config } from './config.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  console.log('Database connected');

  const app = createApp(prisma);
  const httpServer = createServer(app);
  const io = setupSocketIO(httpServer, prisma);

  httpServer.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Socket.IO ready`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    io.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
