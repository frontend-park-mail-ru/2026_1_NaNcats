import { httpClient } from '@shared/api/http';
import type { Order, OrderCreatePayload, OrderCreateResponse } from '../model/types';

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
     * @returns Идентификатор созданного заказа. URL подтверждения оплаты
     * приходит отдельным WebSocket-событием в `GatewayWsEvent.payment_url`.
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
     * Отменяет заказ.
     *
     * @param orderID Идентификатор заказа.
     * @returns Ответ со статусом операции отмены.
     */
    cancel(orderID: string): Promise<{ status: string }> {
        return httpClient.postJson<{ status: string }>(`/orders/${encodeURIComponent(orderID)}/cancel`, {});
    },

    /**
     * Запускает оплату доли счёта (split) в совместном заказе.
     *
     * Бэкенд перепривязывает долю на текущего пользователя и запускает по ней
     * платёж: URL подтверждения оплаты приходит отдельным WebSocket-событием
     * в `GatewayWsEvent.payment_url` для соответствующего `split_id`.
     *
     * @param splitID Идентификатор доли счёта.
     * @param paymentMethodID Идентификатор привязанной карты или пустая строка
     *   для оплаты новой картой.
     */
    payForSplit(splitID: string, paymentMethodID: string): Promise<{ message: string }> {
        return httpClient.postJson<{ message: string }>(`/orders/splits/${encodeURIComponent(splitID)}/pay`, {
            payment_method_id: paymentMethodID,
        });
    },
};
