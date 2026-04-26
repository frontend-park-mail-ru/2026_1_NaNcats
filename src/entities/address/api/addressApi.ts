import { httpClient, ApiError } from '@shared/api/http';
import type { Address, AddressListResponse, AddressUpsertPayload } from '../model/types';

export const addressApi = {
    async list(): Promise<Address[]> {
        const res = await httpClient.get('/profile/addresses');
        if (!res.ok) {
            throw new ApiError('addresses.list failed', { status: res.status, url: '/profile/addresses' });
        }
        const data = (await res.json()) as AddressListResponse;
        return data.addresses ?? [];
    },

    async create(payload: AddressUpsertPayload): Promise<void> {
        const res = await httpClient.post('/profile/addresses', payload);
        if (!res.ok) {
            throw new ApiError('addresses.create failed', { status: res.status, url: '/profile/addresses' });
        }
    },

    async patch(id: string, payload: AddressUpsertPayload): Promise<void> {
        const url = `/profile/addresses/${id}`;
        const res = await httpClient.patch(url, payload);
        if (!res.ok) {
            throw new ApiError('addresses.patch failed', { status: res.status, url });
        }
    },

    async remove(id: string): Promise<void> {
        const url = `/profile/addresses/${id}`;
        const res = await httpClient.delete(url);
        if (!res.ok) {
            throw new ApiError('addresses.remove failed', { status: res.status, url });
        }
    },
};
