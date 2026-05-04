import { httpClient } from '@shared/api/http';
import type { Order, OrderCreatePayload, OrderCreateResponse } from '../model/types';

/**
 * Ответ эндпоинта проверки статуса оплаты заказа.
 */
export interface CheckPaymentResponse {
    /** Идентификатор заказа. */
    order_id: string;
    /** Идентификатор платежа на стороне платёжного провайдера. */
    payment_id?: string;
    /** Статус платежа: `pending`, `succeeded`, `canceled`, `waiting_for_capture`. */
    payment_status: string;
}

/**
 * REST-клиент для работы с заказами.
 */
export const orderApi = {
    /**
     * Создаёт новый заказ.
     *
     * Передача `idempotencyKey` позволяет безопасно повторять запрос при
     * сетевых ошибках: бэкенд отдаст уже созданный заказ вместо дубля.
     *
     * @param payload Полезная нагрузка создания заказа.
     * @param idempotencyKey Ключ идемпотентности.
     * @returns Идентификатор заказа и URL подтверждения оплаты, если она нужна.
     */
    create(payload: OrderCreatePayload, idempotencyKey: string): Promise<OrderCreateResponse> {
        return httpClient.postJson<OrderCreateResponse>('/orders', payload, idempotencyKey);
    },

    /**
     * Возвращает список заказов текущего пользователя.
     *
     * @returns Массив заказов в сырой форме бэкенда.
     */
    list(): Promise<Order[]> {
        return httpClient.getJson<Order[]>('/profile/orders');
    },

    /**
     * Опрашивает статус оплаты заказа у платёжного провайдера.
     *
     * @param orderID Идентификатор заказа.
     * @returns Ответ со статусом платежа.
     */
    checkPayment(orderID: string): Promise<CheckPaymentResponse> {
        return httpClient.postJson<CheckPaymentResponse>(`/orders/${encodeURIComponent(orderID)}/check-payment`, {});
    },

    /**
     * Отменяет заказ.
     *
     * @param orderID Идентификатор заказа.
     * @returns Ответ со статусом операции отмены.
     */
    cancel(orderID: string): Promise<{ status: string }> {
        return httpClient.postJson<{ status: string }>(`/orders/${encodeURIComponent(orderID)}/cancel`, {});
    },
};
