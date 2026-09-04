import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, TenantId, CurrentUser } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { z } from 'zod';

const CreateProductDto = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  basePrice: z.number().nonnegative().default(0),
  costPrice: z.number().nonnegative().default(0),
  weightGrams: z.number().int().nonnegative().optional(),
  dimensions: z.object({ l: z.number(), w: z.number(), h: z.number() }).optional(),
  barcode: z.string().optional(),
  gtin: z.string().optional(),
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  isBundle: z.boolean().default(false),
  bundleItems: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).default([]),
});

const UpdateProductDto = CreateProductDto.partial();

const CreateVariantDto = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().optional(),
  condition: z.enum(['NEW', 'OPEN_BOX_A', 'OPEN_BOX_B', 'OPEN_BOX_C', 'DAMAGED', 'REFURBISHED']).default('NEW'),
  listingStatus: z.enum(['LISTED', 'UNLISTED', 'DRAFT', 'ARCHIVED']).default('UNLISTED'),
  priceOverride: z.number().nonnegative().optional(),
  costOverride: z.number().nonnegative().optional(),
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Listar productos' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('condition') condition?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.products.findAll(tenantId, { page: Number(page), limit: Number(limit), search, status, condition, categoryId });
  }

  @Get('barcodes')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE')
  @ApiOperation({ summary: 'Obtener códigos de barra para scanner' })
  async getBarcodes(@TenantId() tenantId: string) {
    return this.products.getBarcodes(tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.products.findOne(tenantId, id);
  }

  @Post()
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear producto' })
  async create(@TenantId() tenantId: string, @Body() body: z.infer<typeof CreateProductDto>, @CurrentUser('id') userId: string) {
    return this.products.create(tenantId, body, userId);
  }

  @Patch(':id')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Actualizar producto' })
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: z.infer<typeof UpdateProductDto>, @CurrentUser('role') role: string) {
    return this.products.update(tenantId, id, body, role);
  }

  @Delete(':id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Eliminar producto' })
  async delete(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser('role') role: string) {
    return this.products.delete(tenantId, id, role);
  }

  @Post(':id/variants')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Crear variante' })
  async createVariant(@TenantId() tenantId: string, @Param('id') productId: string, @Body() body: z.infer<typeof CreateVariantDto>) {
    return this.products.createVariant(tenantId, productId, body);
  }

  @Patch('variants/:variantId')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Actualizar variante' })
  async updateVariant(@TenantId() tenantId: string, @Param('variantId') variantId: string, @Body() body: z.infer<typeof CreateVariantDto>.partial()) {
    return this.products.updateVariant(tenantId, variantId, body);
  }

  @Delete('variants/:variantId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Eliminar variante' })
  async deleteVariant(@TenantId() tenantId: string, @Param('variantId') variantId: string) {
    return this.products.deleteVariant(tenantId, variantId);
  }

  @Post('import/:connectionId')
  @Roles('OWNER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Importar productos desde marketplace' })
  async importFromMarketplace(@TenantId() tenantId: string, @Param('connectionId') connectionId: string, @Body() body: { products: any[] }) {
    return this.products.importFromMarketplace(tenantId, connectionId, body.products);
  }
}