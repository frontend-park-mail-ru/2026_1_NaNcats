import { httpClient } from '@shared/api/http';
import type { Order, OrderCreatePayload, OrderCreateResponse } from '../model/types';

export interface CheckPaymentResponse {
    order_id: string;
    payment_id?: string;
    payment_status: string; // "pending" | "succeeded" | "canceled" | "waiting_for_capture"
}

export const orderApi = {
    create(payload: OrderCreatePayload, idempotencyKey: string): Promise<OrderCreateResponse> {
        return httpClient.postJson<OrderCreateResponse>('/orders', payload, idempotencyKey);
    },

    list(): Promise<Order[]> {
        return httpClient.getJson<Order[]>('/profile/orders');
    },

    checkPayment(orderID: string): Promise<CheckPaymentResponse> {
        return httpClient.postJson<CheckPaymentResponse>(`/orders/${encodeURIComponent(orderID)}/check-payment`, {});
    },

    cancel(orderID: string): Promise<{ status: string }> {
        return httpClient.postJson<{ status: string }>(`/orders/${encodeURIComponent(orderID)}/cancel`, {});
    },
};
