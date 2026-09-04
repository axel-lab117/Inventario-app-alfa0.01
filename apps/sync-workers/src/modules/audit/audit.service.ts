import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class AuditService implements OnModuleInit {
  private auditClient: PrismaClient;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get('AUDIT_DATABASE_URL') || this.config.get('DATABASE_URL');
    this.auditClient = new PrismaClient({
      datasources: { db: { url } },
      log: ['error'],
    });

    await this.auditClient.$connect();
    await this.enableTimescaleDB();
  }

  private async enableTimescaleDB() {
    try {
      await this.auditClient.$executeRawUnsafe(`
        CREATE EXTENSION IF NOT EXISTS timescaledb;
      `);
      console.log('✅ TimescaleDB extension enabled');
    } catch (error) {
      console.warn('⚠️ TimescaleDB not available, using regular PostgreSQL');
    }
  }

  async logStockMovement(data: {
    tenantId: string;
    variantId: string;
    locationId: string;
    type: string;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    employeeId?: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: Record<string, any>;
  }) {
    await this.auditClient.$executeRawUnsafe(
      `
      INSERT INTO stock_movement_audit 
      (tenant_id, variant_id, location_id, type, quantity, previous_quantity, new_quantity, employee_id, reference_id, reference_type, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `,
      data.tenantId,
      data.variantId,
      data.locationId,
      data.type,
      data.quantity,
      data.previousQuantity,
      data.newQuantity,
      data.employeeId || null,
      data.referenceId || null,
      data.referenceType || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    );
  }

  async logOrderEvent(data: {
    tenantId: string;
    orderId: string;
    event: string;
    previousStatus?: string;
    newStatus?: string;
    employeeId?: string;
    metadata?: Record<string, any>;
  }) {
    await this.auditClient.$executeRawUnsafe(
      `
      INSERT INTO order_event_audit 
      (tenant_id, order_id, event, previous_status, new_status, employee_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      data.tenantId,
      data.orderId,
      data.event,
      data.previousStatus || null,
      data.newStatus || null,
      data.employeeId || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    );
  }

  async logSyncEvent(data: {
    tenantId: string;
    connectionId: string;
    type: string;
    status: string;
    recordsProcessed: number;
    recordsSucceeded: number;
    recordsFailed: number;
    errors?: any[];
    durationMs: number;
  }) {
    await this.auditClient.$executeRawUnsafe(
      `
      INSERT INTO sync_event_audit 
      (tenant_id, connection_id, type, status, records_processed, records_succeeded, records_failed, errors, duration_ms, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
      data.tenantId,
      data.connectionId,
      data.type,
      data.status,
      data.recordsProcessed,
      data.recordsSucceeded,
      data.recordsFailed,
      data.errors ? JSON.stringify(data.errors) : null,
      data.durationMs,
    );
  }

  async getStockHistory(tenantId: string, variantId: string, locationId: string, from: Date, to: Date) {
    return this.auditClient.$queryRawUnsafe(
      `
      SELECT * FROM stock_movement_audit 
      WHERE tenant_id = $1 AND variant_id = $2 AND location_id = $3 
      AND created_at BETWEEN $4 AND $5
      ORDER BY created_at DESC
      LIMIT 1000
      `,
      tenantId,
      variantId,
      locationId,
      from,
      to,
    );
  }

  async getOrderHistory(tenantId: string, orderId: string) {
    return this.auditClient.$queryRawUnsafe(
      `
      SELECT * FROM order_event_audit 
      WHERE tenant_id = $1 AND order_id = $2
      ORDER BY created_at DESC
      `,
      tenantId,
      orderId,
    );
  }

  async getSyncHistory(tenantId: string, connectionId: string, limit = 100) {
    return this.auditClient.$queryRawUnsafe(
      `
      SELECT * FROM sync_event_audit 
      WHERE tenant_id = $1 AND connection_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      tenantId,
      connectionId,
      limit,
    );
  }
}