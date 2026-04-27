import { httpClient } from '@shared/api/http';
import type { Address, AddressListResponse, AddressUpsertPayload } from '../model/types';

export const addressApi = {
    async list(): Promise<Address[]> {
        const data = await httpClient.getJson<AddressListResponse>('/profile/addresses');
        return data.addresses ?? [];
    },

    create(payload: AddressUpsertPayload): Promise<void> {
        return httpClient.send('POST', '/profile/addresses', payload);
    },

    patch(id: string, payload: AddressUpsertPayload): Promise<void> {
        return httpClient.send('PATCH', `/profile/addresses/${id}`, payload);
    },

    remove(id: string): Promise<void> {
        return httpClient.send('DELETE', `/profile/addresses/${id}`);
    },
};
