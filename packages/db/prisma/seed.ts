import { PrismaClient, Role, ProductCondition, ListingStatus, LocationType, StockMovementType, OrderSource, OrderStatus, Marketplace } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Warehouse',
      slug: 'demo',
      primaryColor: '#0ea5e9',
      secondaryColor: '#64748b',
      settings: {
        boxCodePatterns: ['^BOX-(\\w+)-(\\d+)$', '^(\\w{8,12})-(\\d{3,6})$'],
        defaultCurrency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
        lowStockThreshold: 10,
        enableOpenBox: true,
        enableUnlistedProducts: true,
        pickingRouteOptimization: true,
        requirePhotoOnDamage: true,
        sessionTimeoutMinutes: 480,
      },
    },
  });

  console.log('✅ Tenant created:', tenant.name);

  // Create users
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@demo.com',
      passwordHash,
      name: 'Owner Demo',
      role: Role.OWNER,
      isActive: true,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'supervisor@demo.com',
      passwordHash,
      name: 'Supervisor Demo',
      role: Role.SUPERVISOR,
      isActive: true,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'employee@demo.com',
      passwordHash,
      name: 'Employee Demo',
      role: Role.EMPLOYEE,
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // Create warehouse locations hierarchy
  const zoneA = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ZONE-A' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'ZONE-A',
      name: 'Zona A - Electrónica',
      type: LocationType.ZONE,
      capacity: 10000,
      coordinates: { x: 0, y: 0, z: 0 },
    },
  });

  const aisleA1 = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'A1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'A1',
      name: 'Pasillo A1',
      type: LocationType.AISLE,
      parentId: zoneA.id,
      capacity: 2000,
      coordinates: { x: 10, y: 0, z: 0 },
    },
  });

  const rackA11 = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'A1-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'A1-1',
      name: 'Estante A1-1',
      type: LocationType.RACK,
      parentId: aisleA1.id,
      capacity: 500,
      coordinates: { x: 10, y: 5, z: 0 },
    },
  });

  const shelfA111 = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'A1-1-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'A1-1-1',
      name: 'Estante A1-1 Nivel 1',
      type: LocationType.SHELF,
      parentId: rackA11.id,
      capacity: 100,
      coordinates: { x: 10, y: 5, z: 1 },
    },
  });

  const binA1111 = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'A1-1-1-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'A1-1-1-1',
      name: 'Bin A1-1-1-1',
      type: LocationType.BIN,
      parentId: shelfA111.id,
      capacity: 50,
      coordinates: { x: 10, y: 5, z: 1 },
    },
  });

  const binA1112 = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'A1-1-1-2' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'A1-1-1-2',
      name: 'Bin A1-1-1-2',
      type: LocationType.BIN,
      parentId: shelfA111.id,
      capacity: 50,
      coordinates: { x: 11, y: 5, z: 1 },
    },
  });

  const zoneB = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ZONE-B' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'ZONE-B',
      name: 'Zona B - Hogar',
      type: LocationType.ZONE,
      capacity: 8000,
      coordinates: { x: 50, y: 0, z: 0 },
    },
  });

  const virtualReturns = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'RETURNS' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'RETURNS',
      name: 'Área Devoluciones',
      type: LocationType.VIRTUAL,
      capacity: 1000,
    },
  });

  console.log('✅ Warehouse locations created');

  // Create products
  const iphone15 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH15-128-BLK' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'IPH15-128-BLK',
      name: 'iPhone 15 128GB Negro',
      description: 'iPhone 15 128GB color negro',
      brand: 'Apple',
      model: 'iPhone 15',
      categoryId: null,
      basePrice: 1299999,
      costPrice: 950000,
      weightGrams: 171,
      dimensions: { l: 14.76, w: 7.16, h: 0.78 },
      barcode: '0194252700123',
      gtin: '0194252700123',
      images: ['https://example.com/iphone15-black.jpg'],
      attributes: { color: 'Negro', storage: '128GB' },
      isActive: true,
    },
  });

  const iphone15Blue = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH15-128-BLU' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'IPH15-128-BLU',
      name: 'iPhone 15 128GB Azul',
      description: 'iPhone 15 128GB color azul',
      brand: 'Apple',
      model: 'iPhone 15',
      categoryId: null,
      basePrice: 1299999,
      costPrice: 950000,
      weightGrams: 171,
      dimensions: { l: 14.76, w: 7.16, h: 0.78 },
      barcode: '0194252700124',
      gtin: '0194252700124',
      images: ['https://example.com/iphone15-blue.jpg'],
      attributes: { color: 'Azul', storage: '128GB' },
      isActive: true,
    },
  });

  const samsungS24 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'SAM-S24-256' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'SAM-S24-256',
      name: 'Samsung Galaxy S24 256GB',
      description: 'Galaxy S24 256GB Negro Onyx',
      brand: 'Samsung',
      model: 'Galaxy S24',
      categoryId: null,
      basePrice: 999999,
      costPrice: 720000,
      weightGrams: 167,
      dimensions: { l: 14.7, w: 7.06, h: 0.76 },
      barcode: '8806092987654',
      gtin: '8806092987654',
      images: ['https://example.com/s24.jpg'],
      attributes: { color: 'Negro Onyx', storage: '256GB' },
      isActive: true,
    },
  });

  const macbookAir = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'MBA-M3-13-256' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'MBA-M3-13-256',
      name: 'MacBook Air 13" M3 256GB',
      description: 'MacBook Air 13 pulgadas chip M3 256GB',
      brand: 'Apple',
      model: 'MacBook Air M3',
      categoryId: null,
      basePrice: 1599999,
      costPrice: 1150000,
      weightGrams: 1240,
      dimensions: { l: 30.41, w: 21.5, h: 1.13 },
      barcode: '0194252700125',
      gtin: '0194252700125',
      images: ['https://example.com/mba-m3.jpg'],
      attributes: { color: 'Gris Espacial', storage: '256GB', chip: 'M3' },
      isActive: true,
    },
  });

  console.log('✅ Products created');

  // Create variants
  const variants = await Promise.all([
    prisma.productVariant.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH15-128-BLK' } },
      update: {},
      create: {
        tenantId: tenant.id,
        productId: iphone15.id,
        sku: 'IPH15-128-BLK',
        barcode: '0194252700123',
        condition: ProductCondition.NEW,
        listingStatus: ListingStatus.LISTED,
        priceOverride: 1299999,
        costOverride: 950000,
        isActive: true,
      },
    }),
    prisma.productVariant.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH15-128-BLU' } },
      update: {},
      create: {
        tenantId: tenant.id,
        productId: iphone15Blue.id,
        sku: 'IPH15-128-BLU',
        barcode: '0194252700124',
        condition: ProductCondition.NEW,
        listingStatus: ListingStatus.LISTED,
        priceOverride: 1299999,
        costOverride: 950000,
        isActive: true,
      },
    }),
    prisma.productVariant.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'SAM-S24-256' } },
      update: {},
      create: {
        tenantId: tenant.id,
        productId: samsungS24.id,
        sku: 'SAM-S24-256',
        barcode: '8806092987654',
        condition: ProductCondition.NEW,
        listingStatus: ListingStatus.LISTED,
        priceOverride: 999999,
        costOverride: 720000,
        isActive: true,
      },
    }),
    prisma.productVariant.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'MBA-M3-13-256' } },
      update: {},
      create: {
        tenantId: tenant.id,
        productId: macbookAir.id,
        sku: 'MBA-M3-13-256',
        barcode: '0194252700125',
        condition: ProductCondition.NEW,
        listingStatus: ListingStatus.LISTED,
        priceOverride: 1599999,
        costOverride: 1150000,
        isActive: true,
      },
    }),
    prisma.productVariant.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH15-128-BLK-OBA' } },
      update: {},
      create: {
        tenantId: tenant.id,
        productId: iphone15.id,
        sku: 'IPH15-128-BLK-OBA',
        barcode: null,
        condition: ProductCondition.OPEN_BOX_A,
        listingStatus: ListingStatus.LISTED,
        priceOverride: 1099999,
        costOverride: 950000,
        images: ['https://example.com/iphone15-openbox.jpg'],
        attributes: { color: 'Negro', storage: '128GB', openBoxGrade: 'A' },
        isActive: true,
      },
    }),
    prisma.productVariant.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'IPH15-128-BLK-DMG' } },
      update: {},
      create: {
        tenantId: tenant.id,
        productId: iphone15.id,
        sku: 'IPH15-128-BLK-DMG',
        barcode: null,
        condition: ProductCondition.DAMAGED,
        listingStatus: ListingStatus.UNLISTED,
        priceOverride: 699999,
        costOverride: 950000,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Variants created');

  // Create initial stock levels
  const stockData = [
    { variantId: variants[0].id, locationId: binA1111.id, quantity: 25 },
    { variantId: variants[0].id, locationId: binA1112.id, quantity: 15 },
    { variantId: variants[1].id, locationId: binA1111.id, quantity: 10 },
    { variantId: variants[2].id, locationId: binA1112.id, quantity: 30 },
    { variantId: variants[3].id, locationId: binA1111.id, quantity: 8 },
    { variantId: variants[4].id, locationId: virtualReturns.id, quantity: 3 },
    { variantId: variants[5].id, locationId: virtualReturns.id, quantity: 2 },
  ];

  for (const stock of stockData) {
    await prisma.stockLevel.upsert({
      where: { variantId_locationId: { variantId: stock.variantId, locationId: stock.locationId } },
      update: { quantity: stock.quantity, availableQuantity: stock.quantity },
      create: {
        tenantId: tenant.id,
        variantId: stock.variantId,
        locationId: stock.locationId,
        quantity: stock.quantity,
        reservedQuantity: 0,
        availableQuantity: stock.quantity,
        lastCountedAt: new Date(),
      },
    });

    await prisma.stockMovement.create({
      data: {
        tenantId: tenant.id,
        variantId: stock.variantId,
        locationId: stock.locationId,
        type: StockMovementType.INITIAL,
        quantity: stock.quantity,
        employeeId: owner.id,
        reason: 'Stock inicial seed',
        idempotencyKey: `seed-${stock.variantId}-${stock.locationId}`,
      },
    });
  }

  console.log('✅ Stock levels created');

  // Create warehouse map
  await prisma.warehouseMap.upsert({
    where: { id: 'default-map' },
    update: {},
    create: {
      id: 'default-map',
      tenantId: tenant.id,
      name: 'Plano Principal',
      svgContent: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#f8fafc"/>
        <rect x="5" y="5" width="40" height="80" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>
        <text x="25" y="45" text-anchor="middle" fill="#0ea5e9" font-size="8">ZONA A</text>
        <rect x="55" y="5" width="40" height="80" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/>
        <text x="75" y="45" text-anchor="middle" fill="#f59e0b" font-size="8">ZONA B</text>
        <circle cx="15" cy="20" r="5" fill="#22c55e"/>
        <text x="15" y="22" text-anchor="middle" fill="white" font-size="4">A1</text>
        <circle cx="65" cy="20" r="5" fill="#22c55e"/>
        <text x="65" y="22" text-anchor="middle" fill="white" font-size="4">B1</text>
      </svg>`,
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      scale: 1,
      zones: {
        create: [
          { name: 'Zona A', color: '#0ea5e9', path: 'M5,5 L45,5 L45,85 L5,85 Z', locationIds: [zoneA.id, aisleA1.id, rackA11.id, shelfA111.id, binA1111.id, binA1112.id] },
          { name: 'Zona B', color: '#f59e0b', path: 'M55,5 L95,5 L95,85 L55,85 Z', locationIds: [zoneB.id] },
        ],
      },
    },
  });

  console.log('✅ Warehouse map created');

  // Create sample orders
  const order1 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      source: OrderSource.MERCADOLIBRE,
      sourceOrderId: 'ML-1234567890',
      sourceOrderNumber: 'ML-1234567890',
      status: OrderStatus.CONFIRMED,
      customer: { email: 'cliente1@email.com', name: 'Juan Pérez', phone: '+5491112345678' },
      shippingAddress: { street: 'Av. Corrientes', number: '1234', city: 'CABA', state: 'CABA', postalCode: '1043', country: 'AR' },
      items: {
        create: [
          { variantId: variants[0].id, sku: variants[0].sku, name: iphone15.name, quantity: 1, unitPrice: 1299999, totalPrice: 1299999, condition: 'NEW' },
          { variantId: variants[1].id, sku: variants[1].sku, name: iphone15Blue.name, quantity: 1, unitPrice: 1299999, totalPrice: 1299999, condition: 'NEW' },
        ],
      },
      subtotal: 2599998,
      tax: 0,
      shipping: 0,
      discount: 0,
      total: 2599998,
      currency: 'ARS',
    },
  });

  const order2 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      source: OrderSource.MANUAL,
      sourceOrderId: 'MAN-001',
      sourceOrderNumber: 'MAN-001',
      status: OrderStatus.PENDING,
      customer: { email: 'cliente2@email.com', name: 'María González', phone: '+5491187654321' },
      shippingAddress: { street: 'Av. Santa Fe', number: '567', city: 'CABA', state: 'CABA', postalCode: '1123', country: 'AR' },
      items: {
        create: [
          { variantId: variants[2].id, sku: variants[2].sku, name: samsungS24.name, quantity: 2, unitPrice: 999999, totalPrice: 1999998, condition: 'NEW' },
        ],
      },
      subtotal: 1999998,
      tax: 379999.62,
      shipping: 15000,
      discount: 0,
      total: 2394997.62,
      currency: 'ARS',
    },
  });

  console.log('✅ Sample orders created');

  // Create marketplace connection placeholder
  await prisma.marketplaceConnection.upsert({
    where: { tenantId_marketplace_name: { tenantId: tenant.id, marketplace: Marketplace.MERCADOLIBRE, name: 'MercadoLibre Principal' } },
    update: {},
    create: {
      tenantId: tenant.id,
      marketplace: Marketplace.MERCADOLIBRE,
      name: 'MercadoLibre Principal',
      credentials: { client_id: 'demo', client_secret: 'demo' },
      settings: { autoImportOrders: true, autoSyncStock: true },
      status: 'INACTIVE',
      syncIntervalMinutes: 15,
    },
  });

  console.log('✅ Marketplace connection created');

  console.log('🎉 Seed completed successfully!');
  console.log(`
  Demo credentials:
  - Owner: owner@demo.com / password123
  - Supervisor: supervisor@demo.com / password123
  - Employee: employee@demo.com / password123
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });