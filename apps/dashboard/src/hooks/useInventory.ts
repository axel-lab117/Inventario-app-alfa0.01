'use client';

import { z } from 'zod';
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ProductWithStockSchema,
  ProductVariantSchema,
  StockLevelSchema,
  StockMovementSchema,
  BatchTraceItemSchema,
  InventoryFiltersSchema,
  AdjustStockDtoSchema,
  TransferStockDtoSchema,
  PaginatedResponseSchema,
  type ProductWithStock,
  type ProductVariant,
  type StockLevel,
  type StockMovement,
  type BatchTraceItem,
  type InventoryFilters,
  type AdjustStockDto,
  type TransferStockDto,
  type PaginatedResponse,
} from '@repo/shared-types/inventory';

const productListResponseSchema = PaginatedResponseSchema(ProductWithStockSchema);
const variantResponseSchema = ProductVariantSchema;
const stockLevelsResponseSchema = z.array(StockLevelSchema);
const movementsResponseSchema = PaginatedResponseSchema(StockMovementSchema);
const batchTraceResponseSchema = z.array(BatchTraceItemSchema);

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.set(key, String(value));
      }
    }
  });
  return searchParams.toString();
}

export function useProducts(
  filters: InventoryFilters = {},
  options?: UseQueryOptions<PaginatedResponse<ProductWithStock>, Error>
) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters as Record<string, any>);
      const response = await api.get(`/products?${queryString}`);
      return productListResponseSchema.parse(response.data);
    },
    ...options,
  });
}

export function useProduct(id: string, options?: UseQueryOptions<ProductWithStock, Error>) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}`);
      return ProductWithStockSchema.parse(response.data);
    },
    enabled: !!id,
    ...options,
  });
}

export function useProductVariants(productId: string, options?: UseQueryOptions<ProductVariant[], Error>) {
  return useQuery({
    queryKey: ['product', productId, 'variants'],
    queryFn: async () => {
      const response = await api.get(`/products/${productId}/variants`);
      return z.array(variantResponseSchema).parse(response.data);
    },
    enabled: !!productId,
    ...options,
  });
}

export function useStockLevels(variantId: string, options?: UseQueryOptions<StockLevel[], Error>) {
  return useQuery({
    queryKey: ['stock-levels', variantId],
    queryFn: async () => {
      const response = await api.get(`/products/variants/${variantId}/stock-levels`);
      return stockLevelsResponseSchema.parse(response.data);
    },
    enabled: !!variantId,
    ...options,
  });
}

export function useProductStockLevels(productId: string, options?: UseQueryOptions<StockLevel[], Error>) {
  return useQuery({
    queryKey: ['product', productId, 'stock-levels'],
    queryFn: async () => {
      const response = await api.get(`/products/${productId}/stock-levels`);
      return stockLevelsResponseSchema.parse(response.data);
    },
    enabled: !!productId,
    ...options,
  });
}

export function useStockMovements(
  params: { variantId?: string; locationId?: string; type?: string; page?: number; limit?: number } = {},
  options?: UseQueryOptions<PaginatedResponse<StockMovement>, Error>
) {
  return useQuery({
    queryKey: ['stock-movements', params],
    queryFn: async () => {
      const queryString = buildQueryString(params);
      const response = await api.get(`/inventory/movements?${queryString}`);
      return movementsResponseSchema.parse(response.data);
    },
    ...options,
  });
}

export function useBatchTrace(variantId: string, options?: UseQueryOptions<BatchTraceItem[], Error>) {
  return useQuery({
    queryKey: ['batch-trace', variantId],
    queryFn: async () => {
      const response = await api.get(`/inventory/batch-trace?variantId=${variantId}`);
      return batchTraceResponseSchema.parse(response.data);
    },
    enabled: !!variantId,
    ...options,
  });
}

export function useAdjustStock(
  options?: UseMutationOptions<void, Error, AdjustStockDto>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto) => {
      const parsed = AdjustStockDtoSchema.parse(dto);
      await api.post('/inventory/adjust', parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
    ...options,
  });
}

export function useTransferStock(
  options?: UseMutationOptions<void, Error, TransferStockDto>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto) => {
      const parsed = TransferStockDtoSchema.parse(dto);
      await api.post('/inventory/transfer', parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
    ...options,
  });
}

export function useCreateProduct(
  options?: UseMutationOptions<ProductWithStock, Error, Partial<ProductWithStock>>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/products', data);
      return ProductWithStockSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    ...options,
  });
}

export function useUpdateProduct(
  options?: UseMutationOptions<ProductWithStock, Error, { id: string; data: Partial<ProductWithStock> }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/products/${id}`, data);
      return ProductWithStockSchema.parse(response.data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
    },
    ...options,
  });
}

export function useDeleteProduct(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    ...options,
  });
}