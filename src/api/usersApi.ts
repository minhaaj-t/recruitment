import { api } from './client';
import type { ManagedUser, StoreRow } from '../types/models';

export async function listUsers() {
  const { data } = await api.get<ManagedUser[]>('/users');
  return data;
}

export type CreateUserBody = {
  email: string;
  password: string;
  fullName: string;
  roleCode: string;
  storeId?: number;
  hodStoreAdminIds?: number[];
  hrStoreIds?: number[];
};

export async function createUser(body: CreateUserBody) {
  const { data } = await api.post('/users', body);
  return data;
}

export async function setUserActive(id: number, isActive: boolean) {
  const { data } = await api.patch(`/users/${id}/active`, { isActive });
  return data;
}

export async function listStores() {
  const { data } = await api.get<StoreRow[]>('/stores');
  return data;
}

export async function createStore(name: string, code?: string) {
  const { data } = await api.post<StoreRow>('/stores', { name, code });
  return data;
}
