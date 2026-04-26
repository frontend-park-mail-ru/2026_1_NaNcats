import { httpClient, ApiError } from '@shared/api/http';
import type { Order, OrderCreatePayload, OrderCreateResponse } from '../model/types';

export const orderApi = {
    async create(payload: OrderCreatePayload): Promise<OrderCreateResponse> {
        const res = await httpClient.post('/orders', payload);
        if (!res.ok) {
            const message = await res
                .json()
                .then((b: { message?: string }) => b?.message)
                .catch(() => undefined);
            throw new ApiError(message ?? 'order.create failed', { status: res.status, url: '/orders' });
        }
        return (await res.json()) as OrderCreateResponse;
    },

    async list(): Promise<Order[]> {
        const res = await httpClient.get('/profile/orders');
        if (!res.ok) {
            throw new ApiError('order.list failed', { status: res.status, url: '/profile/orders' });
        }
        return (await res.json()) as Order[];
    },
};
