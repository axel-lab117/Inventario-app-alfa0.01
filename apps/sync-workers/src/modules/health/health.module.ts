import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import { RabbitMQService } from '../../config/rabbitmq.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaService, RedisService, RabbitMQService],
})
export class HealthModule {}