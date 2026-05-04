import type { GatewayWsEvent } from '../model/types';

const TERMINAL_STATUSES = new Set(['finished', 'cancelled', 'failed']);

/**
 * Набор колбэков, через которые трекер сообщает о событиях WebSocket-канала.
 */
export interface OrderTrackerHandlers {
    /** Вызывается на каждое распарсенное событие статуса заказа. */
    onEvent: (event: GatewayWsEvent) => void;
    /** Вызывается при успешном открытии соединения. */
    onOpen?: () => void;
    /**
     * Вызывается при закрытии соединения. Аргумент `clean` равен `true`,
     * если закрытие инициировано вызывающим кодом или достигнут терминальный
     * статус заказа.
     */
    onClose?: (clean: boolean) => void;
    /** Вызывается при ошибке транспорта. */
    onError?: (e: Event) => void;
}

/**
 * Управляющий интерфейс активного трекера заказа.
 */
export interface OrderTracker {
    /** Закрывает соединение и отменяет запланированный реконнект. */
    close(): void;
    /** Возвращает `true`, если трекер был закрыт явно. */
    isClosed(): boolean;
}

/**
 * Собирает URL WebSocket-эндпоинта трекинга заказа на основе текущего хоста
 * и протокола страницы.
 *
 * @param orderId Идентификатор заказа.
 * @returns Полный URL для подключения.
 */
function buildWsUrl(orderId: string): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws/orders/${encodeURIComponent(orderId)}`;
}

/**
 * Подключается к WebSocket-каналу трекинга заказа и возвращает управляющий
 * объект.
 *
 * Реализует автоматический реконнект с экспоненциальной задержкой (от 1 с до
 * 30 с) до тех пор, пока соединение не будет закрыто явно или заказ не
 * перейдёт в терминальный статус (`finished`, `cancelled`, `failed`).
 *
 * @param orderId Идентификатор заказа.
 * @param handlers Колбэки уведомлений.
 * @returns Управляющий объект для остановки трекинга.
 */
export function connectOrderTracker(orderId: string, handlers: OrderTrackerHandlers): OrderTracker {
    let socket: WebSocket | null = null;
    let closedByUser = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;

    const connect = () => {
        if (closedByUser) return;
        try {
            socket = new WebSocket(buildWsUrl(orderId));
        } catch (e) {
            console.error('orderTracker: failed to construct WebSocket', e);
            scheduleReconnect();
            return;
        }

        socket.addEventListener('open', () => {
            reconnectAttempt = 0;
            handlers.onOpen?.();
        });

        socket.addEventListener('message', (e) => {
            try {
                const data = JSON.parse(e.data) as GatewayWsEvent;
                handlers.onEvent(data);
                if (TERMINAL_STATUSES.has(data.status)) {
                    closedByUser = true;
                }
            } catch (parseErr) {
                console.warn('orderTracker: failed to parse message', parseErr, e.data);
            }
        });

        socket.addEventListener('error', (e) => {
            handlers.onError?.(e);
        });

        socket.addEventListener('close', () => {
            handlers.onClose?.(closedByUser);
            socket = null;
            if (!closedByUser) scheduleReconnect();
        });
    };

    const scheduleReconnect = () => {
        if (closedByUser) return;
        reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
        const delay = Math.min(1000 * 2 ** (reconnectAttempt - 1), 30_000);
        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, delay);
    };

    connect();

    return {
        close() {
            closedByUser = true;
            if (reconnectTimer !== null) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (socket && socket.readyState <= WebSocket.OPEN) {
                socket.close(1000, 'client closed');
            }
            socket = null;
        },
        isClosed() {
            return closedByUser;
        },
    };
}
