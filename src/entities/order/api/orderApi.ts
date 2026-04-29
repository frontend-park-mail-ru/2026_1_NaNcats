import { httpClient } from '@shared/api/http';
import type { Order, OrderCreatePayload, OrderCreateResponse } from '../model/types';

export const orderApi = {
    create(payload: OrderCreatePayload, idempotencyKey: string): Promise<OrderCreateResponse> {
        return httpClient.postJson<OrderCreateResponse>('/orders', payload, idempotencyKey);
    },

    list(): Promise<Order[]> {
        return httpClient.getJson<Order[]>('/profile/orders');
    },
};
