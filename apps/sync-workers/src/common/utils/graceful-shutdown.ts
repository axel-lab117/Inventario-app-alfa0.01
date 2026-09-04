import { INestApplication } from '@nestjs/common';

export function setupGracefulShutdown(app: INestApplication) {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
      try {
        await app.close();
        console.log('✅ Application closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
}