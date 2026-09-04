import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { setupGracefulShutdown } from './common/utils/graceful-shutdown';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
    new ZodValidationPipe(),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('WMS Sync Workers API')
    .setDescription('API para sincronización de marketplaces, inventario y órdenes')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación y autorización')
    .addTag('tenants', 'Gestión de tenants')
    .addTag('products', 'Productos y variantes')
    .addTag('inventory', 'Inventario y movimientos')
    .addTag('warehouse', 'Mapa de galpón y ubicaciones')
    .addTag('orders', 'Órdenes y picking')
    .addTag('returns', 'Devoluciones y RMA')
    .addTag('marketplaces', 'Conexiones y sincronización')
    .addTag('webhooks', 'Recepción de webhooks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Sync Workers running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/docs`);

  setupGracefulShutdown(app);
}

bootstrap();