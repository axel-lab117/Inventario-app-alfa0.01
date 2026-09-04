import type { MarketplaceAdapter, AuthResult, FetchProductsParams, MarketplaceProductResult, FetchOrdersParams, MarketplaceOrderResult, UpdateResult, CreateProductInput, CreateProductResult, UpdateProductInput, UpdateResult as UpdateResultType } from '@repo/shared-types';

export abstract class BaseMarketplaceAdapter implements MarketplaceAdapter {
  abstract readonly marketplace: 'MERCADOLIBRE' | 'FRAVEGA' | 'GARBARINO' | 'MEGATONE' | 'SHOPIFY' | 'TIENDANUBE' | 'AMAZON';

  protected abstract baseUrl: string;
  protected accessToken: string | null = null;
  protected refreshToken: string | null = null;
  protected tokenExpiresAt: number = 0;

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    try {
      const result = await this.performAuth(credentials);
      if (result.success && result.accessToken) {
        this.accessToken = result.accessToken;
        this.refreshToken = result.refreshToken || null;
        this.tokenExpiresAt = result.expiresIn ? Date.now() + result.expiresIn * 1000 : 0;
      }
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Authentication failed' };
    }
  }

  protected abstract performAuth(credentials: Record<string, string>): Promise<AuthResult>;

  async testConnection(credentials: Record<string, string>): Promise<boolean> {
    const result = await this.authenticate(credentials);
    return result.success;
  }

  protected async ensureValidToken(): Promise<boolean> {
    if (!this.accessToken) return false;
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 60_000) {
      return await this.refreshAccessToken();
    }
    return true;
  }

  protected abstract refreshAccessToken(): Promise<boolean>;

  protected getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async fetchProducts(params: FetchProductsParams = {}): Promise<MarketplaceProductResult[]> {
    await this.ensureValidToken();
    return this.performFetchProducts(params);
  }

  protected abstract performFetchProducts(params: FetchProductsParams): Promise<MarketplaceProductResult[]>;

  async fetchOrders(params: FetchOrdersParams = {}): Promise<MarketplaceOrderResult[]> {
    await this.ensureValidToken();
    return this.performFetchOrders(params);
  }

  protected abstract performFetchOrders(params: FetchOrdersParams): Promise<MarketplaceOrderResult[]>;

  async fetchOrderDetails(orderId: string): Promise<MarketplaceOrderResult> {
    await this.ensureValidToken();
    return this.performFetchOrderDetails(orderId);
  }

  protected abstract performFetchOrderDetails(orderId: string): Promise<MarketplaceOrderResult>;

  async updateStock(productId: string, stock: number): Promise<UpdateResult> {
    await this.ensureValidToken();
    return this.performUpdateStock(productId, stock);
  }

  protected abstract performUpdateStock(productId: string, stock: number): Promise<UpdateResult>;

  async updatePrice(productId: string, price: number): Promise<UpdateResult> {
    await this.ensureValidToken();
    return this.performUpdatePrice(productId, price);
  }

  protected abstract performUpdatePrice(productId: string, price: number): Promise<UpdateResult>;

  async createProduct(product: CreateProductInput): Promise<CreateProductResult> {
    await this.ensureValidToken();
    return this.performCreateProduct(product);
  }

  protected abstract performCreateProduct(product: CreateProductInput): Promise<CreateProductResult>;

  async updateProduct(productId: string, product: UpdateProductInput): Promise<UpdateResult> {
    await this.ensureValidToken();
    return this.performUpdateProduct(productId, product);
  }

  protected abstract performUpdateProduct(productId: string, product: UpdateProductInput): Promise<UpdateResult>;

  getWebhookSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  verifyWebhook(payload: string, signature: string, secret: string): boolean {
    const expected = this.getWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  protected async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: { ...this.getHeaders(), ...customHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error: ${error.message || response.statusText}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }
}

export function createAdapter(marketplace: string): BaseMarketplaceAdapter | null {
  switch (marketplace.toUpperCase()) {
    case 'MERCADOLIBRE':
      return new MercadoLibreAdapter();
    case 'FRAVEGA':
      return new FravegaAdapter();
    case 'GARBARINO':
      return new GarbarinoAdapter();
    case 'MEGATONE':
      return new MegatoneAdapter();
    default:
      return null;
  }
}

class MercadoLibreAdapter extends BaseMarketplaceAdapter {
  readonly marketplace = 'MERCADOLIBRE';
  protected baseUrl = 'https://api.mercadolibre.com';

  protected async performAuth(credentials: Record<string, string>): Promise<AuthResult> {
    const { client_id, client_secret, refresh_token } = credentials;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id,
      client_secret,
      refresh_token,
    });

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) return { success: false, error: 'Invalid credentials' };
    const data = await response.json();
    return { success: true, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  }

  protected async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    const result = await this.performAuth({ refresh_token: this.refreshToken } as any);
    return result.success;
  }

  protected async performFetchProducts(params: FetchProductsParams): Promise<MarketplaceProductResult[]> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    if (params.status) searchParams.set('status', params.status);

    const data = await this.request<{ results: any[] }>('GET', `/users/me/items/search?${searchParams}`);
    return data.results.map(item => ({
      id: item.id,
      sku: item.sku || item.id,
      title: item.title,
      price: item.price,
      stock: item.available_quantity,
      status: item.status,
      permalink: item.permalink,
      images: item.pictures?.map((p: any) => p.url) || [],
      attributes: item.attributes?.reduce((acc: any, a: any) => ({ ...acc, [a.id]: a.value_name }), {}) || {},
    }));
  }

  protected async performFetchOrders(params: FetchOrdersParams): Promise<MarketplaceOrderResult[]> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    if (params.status) searchParams.set('order.status', params.status);
    if (params.dateFrom) searchParams.set('order.date_created.from', params.dateFrom.toISOString());
    if (params.dateTo) searchParams.set('order.date_created.to', params.dateTo.toISOString());

    const data = await this.request<{ results: any[] }>('GET', `/orders/search?${searchParams}`);
    return data.results.map(order => ({
      id: order.id.toString(),
      orderNumber: order.id.toString(),
      status: order.status,
      buyer: { id: order.buyer.id, nickname: order.buyer.nickname, email: order.buyer.email },
      items: order.order_items.map((item: any) => ({
        id: item.item.id,
        sku: item.item.sku,
        title: item.item.title,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.unit_price * item.quantity,
      })),
      total: order.total_amount,
      currency: order.currency_id,
      shipping: order.shipping,
      payment: order.payments?.[0],
      dates: { created: order.date_created, updated: order.date_last_updated },
      rawData: order,
    }));
  }

  protected async performFetchOrderDetails(orderId: string): Promise<MarketplaceOrderResult> {
    const data = await this.request<any>('GET', `/orders/${orderId}`);
    return {
      id: data.id.toString(),
      orderNumber: data.id.toString(),
      status: data.status,
      buyer: { id: data.buyer.id, nickname: data.buyer.nickname, email: data.buyer.email },
      items: data.order_items.map((item: any) => ({
        id: item.item.id,
        sku: item.item.sku,
        title: item.item.title,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.unit_price * item.quantity,
      })),
      total: data.total_amount,
      currency: data.currency_id,
      shipping: data.shipping,
      payment: data.payments?.[0],
      dates: { created: data.date_created, updated: data.date_last_updated },
      rawData: data,
    };
  }

  protected async performUpdateStock(productId: string, stock: number): Promise<UpdateResult> {
    try {
      await this.request('PUT', `/items/${productId}`, { available_quantity: stock });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update stock' };
    }
  }

  protected async performUpdatePrice(productId: string, price: number): Promise<UpdateResult> {
    try {
      await this.request('PUT', `/items/${productId}`, { price });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update price' };
    }
  }

  protected async performCreateProduct(product: CreateProductInput): Promise<CreateProductResult> {
    try {
      const data = await this.request<any>('POST', '/items', product);
      return { success: true, productId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create product' };
    }
  }

  protected async performUpdateProduct(productId: string, product: UpdateProductInput): Promise<UpdateResult> {
    try {
      await this.request('PUT', `/items/${productId}`, product);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update product' };
    }
  }
}

class FravegaAdapter extends BaseMarketplaceAdapter {
  readonly marketplace = 'FRAVEGA';
  protected baseUrl = 'https://api.fravega.com/v1';

  protected async performAuth(credentials: Record<string, string>): Promise<AuthResult> {
    return { success: false, error: 'Fravega adapter not implemented' };
  }
  protected async refreshAccessToken(): Promise<boolean> { return false; }
  protected async performFetchProducts(): Promise<MarketplaceProductResult[]> { return []; }
  protected async performFetchOrders(): Promise<MarketplaceOrderResult[]> { return []; }
  protected async performFetchOrderDetails(): Promise<MarketplaceOrderResult> { throw new Error('Not implemented'); }
  protected async performUpdateStock(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
  protected async performUpdatePrice(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
  protected async performCreateProduct(): Promise<CreateProductResult> { return { success: false, error: 'Not implemented' }; }
  protected async performUpdateProduct(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
}

class GarbarinoAdapter extends BaseMarketplaceAdapter {
  readonly marketplace = 'GARBARINO';
  protected baseUrl = 'https://api.garbarino.com/v1';

  protected async performAuth(credentials: Record<string, string>): Promise<AuthResult> {
    return { success: false, error: 'Garbarino adapter not implemented' };
  }
  protected async refreshAccessToken(): Promise<boolean> { return false; }
  protected async performFetchProducts(): Promise<MarketplaceProductResult[]> { return []; }
  protected async performFetchOrders(): Promise<MarketplaceOrderResult[]> { return []; }
  protected async performFetchOrderDetails(): Promise<MarketplaceOrderResult> { throw new Error('Not implemented'); }
  protected async performUpdateStock(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
  protected async performUpdatePrice(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
  protected async performCreateProduct(): Promise<CreateProductResult> { return { success: false, error: 'Not implemented' }; }
  protected async performUpdateProduct(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
}

class MegatoneAdapter extends BaseMarketplaceAdapter {
  readonly marketplace = 'MEGATONE';
  protected baseUrl = 'https://api.megatone.com/v1';

  protected async performAuth(credentials: Record<string, string>): Promise<AuthResult> {
    return { success: false, error: 'Megatone adapter not implemented' };
  }
  protected async refreshAccessToken(): Promise<boolean> { return false; }
  protected async performFetchProducts(): Promise<MarketplaceProductResult[]> { return []; }
  protected async performFetchOrders(): Promise<MarketplaceOrderResult[]> { return []; }
  protected async performFetchOrderDetails(): Promise<MarketplaceOrderResult> { throw new Error('Not implemented'); }
  protected async performUpdateStock(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
  protected async performUpdatePrice(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
  protected async performCreateProduct(): Promise<CreateProductResult> { return { success: false, error: 'Not implemented' }; }
  protected async performUpdateProduct(): Promise<UpdateResult> { return { success: false, error: 'Not implemented' }; }
}