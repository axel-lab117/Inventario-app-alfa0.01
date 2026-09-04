import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import { RabbitMQService } from '../../config/rabbitmq.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private redis: RedisService,
    private rabbitmq: RabbitMQService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
      () => this.checkRabbitMQ(),
    ]);
  }

  @Get('live')
  @HealthCheck()
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (error) {
      return { database: { status: 'down', error: error.message } };
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const client = this.redis.getClient();
      await client.ping();
      return { redis: { status: 'up' } };
    } catch (error) {
      return { redis: { status: 'down', error: error.message } };
    }
  }

  private async checkRabbitMQ(): Promise<HealthIndicatorResult> {
    try {
      const connected = this.rabbitmq.isConnected();
      return { rabbitmq: { status: connected ? 'up' : 'down' } };
    } catch (error) {
      return { rabbitmq: { status: 'down', error: error.message } };
    }
  }
}