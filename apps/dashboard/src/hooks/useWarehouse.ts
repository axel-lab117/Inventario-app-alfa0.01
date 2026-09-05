'use client';

import { z } from 'zod';
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  WarehouseMapSchema,
  ZoneSchema,
  CreateWarehouseMapDtoSchema,
  UpdateWarehouseMapDtoSchema,
  CreateZoneDtoSchema,
  UpdateZoneDtoSchema,
  BinOccupancySchema,
  PickingRouteSchema,
  type WarehouseMap,
  type Zone,
  type BinOccupancy,
  type PickingRoute,
  type CreateWarehouseMapDto,
  type UpdateWarehouseMapDto,
  type CreateZoneDto,
  type UpdateZoneDto,
} from '@repo/shared-types/warehouse';

const warehouseMapListSchema = z.array(WarehouseMapSchema);
const warehouseMapResponseSchema = WarehouseMapSchema;
const zoneResponseSchema = ZoneSchema;
const zonesResponseSchema = z.array(ZoneSchema);
const binOccupancyResponseSchema = z.array(BinOccupancySchema);
const pickingRoutesResponseSchema = z.array(PickingRouteSchema);

export function useWarehouseMaps(
  options?: UseQueryOptions<WarehouseMap[], Error>
) {
  return useQuery({
    queryKey: ['warehouse-maps'],
    queryFn: async () => {
      const response = await api.get('/warehouse/maps');
      return warehouseMapListSchema.parse(response.data);
    },
    ...options,
  });
}

export function useWarehouseMap(
  id: string,
  options?: UseQueryOptions<WarehouseMap, Error>
) {
  return useQuery({
    queryKey: ['warehouse-map', id],
    queryFn: async () => {
      const response = await api.get(`/warehouse/maps/${id}`);
      return warehouseMapResponseSchema.parse(response.data);
    },
    enabled: !!id,
    ...options,
  });
}

export function useCreateWarehouseMap(
  options?: UseMutationOptions<WarehouseMap, Error, CreateWarehouseMapDto>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto) => {
      const parsed = CreateWarehouseMapDtoSchema.parse(dto);
      const response = await api.post('/warehouse/maps', parsed);
      return warehouseMapResponseSchema.parse(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-maps'] });
    },
    ...options,
  });
}

export function useUpdateWarehouseMap(
  options?: UseMutationOptions<WarehouseMap, Error, { id: string; data: UpdateWarehouseMapDto }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const parsed = UpdateWarehouseMapDtoSchema.parse(data);
      const response = await api.put(`/warehouse/maps/${id}`, parsed);
      return warehouseMapResponseSchema.parse(response.data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-maps'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-map', id] });
    },
    ...options,
  });
}

export function useDeleteWarehouseMap(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/warehouse/maps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-maps'] });
    },
    ...options,
  });
}

export function useZones(
  mapId: string,
  options?: UseQueryOptions<Zone[], Error>
) {
  return useQuery({
    queryKey: ['zones', mapId],
    queryFn: async () => {
      const response = await api.get(`/warehouse/maps/${mapId}/zones`);
      return zonesResponseSchema.parse(response.data);
    },
    enabled: !!mapId,
    ...options,
  });
}

export function useCreateZone(
  options?: UseMutationOptions<Zone, Error, { mapId: string; data: CreateZoneDto }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mapId, data }) => {
      const parsed = CreateZoneDtoSchema.parse(data);
      const response = await api.post(`/warehouse/maps/${mapId}/zones`, parsed);
      return zoneResponseSchema.parse(response.data);
    },
    onSuccess: (_, { mapId }) => {
      queryClient.invalidateQueries({ queryKey: ['zones', mapId] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-map', mapId] });
    },
    ...options,
  });
}

export function useUpdateZone(
  options?: UseMutationOptions<Zone, Error, { zoneId: string; data: UpdateZoneDto }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ zoneId, data }) => {
      const parsed = UpdateZoneDtoSchema.parse(data);
      const response = await api.put(`/warehouse/zones/${zoneId}`, parsed);
      return zoneResponseSchema.parse(response.data);
    },
    onSuccess: (_, { zoneId }) => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    },
    ...options,
  });
}

export function useDeleteZone(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zoneId) => {
      await api.delete(`/warehouse/zones/${zoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    },
    ...options,
  });
}

export function useBinOccupancy(
  mapId: string,
  options?: UseQueryOptions<BinOccupancy[], Error>
) {
  return useQuery({
    queryKey: ['bin-occupancy', mapId],
    queryFn: async () => {
      const response = await api.get(`/warehouse/maps/${mapId}/occupancy`);
      return binOccupancyResponseSchema.parse(response.data);
    },
    enabled: !!mapId,
    ...options,
  });
}

export function usePickingRoutes(
  mapId: string,
  options?: UseQueryOptions<PickingRoute[], Error>
) {
  return useQuery({
    queryKey: ['picking-routes', mapId],
    queryFn: async () => {
      const response = await api.get(`/warehouse/maps/${mapId}/picking-routes`);
      return pickingRoutesResponseSchema.parse(response.data);
    },
    enabled: !!mapId,
    ...options,
  });
}