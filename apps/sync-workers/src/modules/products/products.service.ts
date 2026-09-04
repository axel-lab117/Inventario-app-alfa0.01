import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductSchema, ProductVariantSchema } from '@repo/shared-types';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; status?: string; condition?: string; categoryId?: string }) {
    const { page = 1, limit = 20, search, status, condition, categoryId } = params;
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { gtin: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          variants: { where: condition ? { condition: condition as any } : undefined },
          _count: { select: { variants: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        variants: { include: { stockLevels: { include: { location: true } } } },
        bundleItems: { include: { childProduct: true } },
        bundleParents: { include: { parentProduct: true } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(tenantId: string, data: any, userId: string) {
    const parsed = ProductSchema.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true }).safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.message);

    return this.prisma.product.create({
      data: { ...parsed.data, tenantId },
    });
  }

  async update(tenantId: string, id: string, data: any, userRole: string) {
    if (userRole !== 'OWNER' && userRole !== 'SUPERVISOR') throw new ForbiddenException('Sin permisos');

    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string, userRole: string) {
    if (userRole !== 'OWNER') throw new ForbiddenException('Solo owner puede eliminar');

    await this.prisma.product.delete({ where: { id, tenantId } });
  }

  async createVariant(tenantId: string, productId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const parsed = ProductVariantSchema.omit({ id: true, tenantId: true, productId: true, createdAt: true, updatedAt: true }).safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.message);

    return this.prisma.productVariant.create({ data: { ...parsed.data, tenantId, productId } });
  }

  async updateVariant(tenantId: string, variantId: string, data: any) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException('Variante no encontrada');

    return this.prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async deleteVariant(tenantId: string, variantId: string) {
    await this.prisma.productVariant.delete({ where: { id: variantId, tenantId } });
  }

  async getBarcodes(tenantId: string) {
    return this.prisma.productVariant.findMany({
      where: { tenantId, barcode: { not: null } },
      select: { id: true, sku: true, barcode: true, product: { select: { name: true } } },
    });
  }

  async importFromMarketplace(tenantId: string, connectionId: string, marketplaceProducts: any[]) {
    const results = { created: 0, updated: 0, linked: 0, errors: [] as string[] };

    for (const mp of marketplaceProducts) {
      try {
        let variant = await this.prisma.productVariant.findFirst({
          where: { tenantId, sku: mp.marketplaceSku },
        });

        if (!variant) {
          let product = await this.prisma.product.findFirst({
            where: { tenantId, sku: mp.marketplaceSku },
          });

          if (!product) {
            product = await this.prisma.product.create({
              data: {
                tenantId,
                sku: mp.marketplaceSku,
                name: mp.title,
                basePrice: mp.price,
                images: mp.images,
                attributes: mp.attributes,
              },
            });
            results.created++;
          }

          variant = await this.prisma.productVariant.create({
            data: {
              tenantId,
              productId: product.id,
              sku: mp.marketplaceSku,
              priceOverride: mp.price,
              listingStatus: 'LISTED',
            },
          });
          results.created++;
        } else {
          await this.prisma.productVariant.update({
            where: { id: variant.id },
            data: { priceOverride: mp.price, listingStatus: 'LISTED', images: mp.images },
          });
          results.updated++;
        }

        await this.prisma.marketplaceProduct.upsert({
          where: { connectionId_marketplaceProductId: { connectionId, marketplaceProductId: mp.id } },
          update: { localVariantId: variant.id, title: mp.title, price: mp.price, stock: mp.stock, status: mp.status, lastSyncedAt: new Date() },
          create: {
            tenantId,
            connectionId,
            marketplaceProductId: mp.id,
            marketplaceSku: mp.marketplaceSku,
            localVariantId: variant.id,
            title: mp.title,
            price: mp.price,
            stock: mp.stock,
            status: mp.status,
            images: mp.images,
            attributes: mp.attributes,
            lastSyncedAt: new Date(),
          },
        });
        results.linked++;
      } catch (error) {
        results.errors.push(`${mp.marketplaceSku}: ${error.message}`);
      }
    }

    return results;
  }
}