import type { CartWsEvent } from '../model/types';

/**
 * Колбэки канала живых обновлений совместной корзины.
 */
export interface CartSocketHandlers {
    /** Вызывается на каждое распарсенное событие изменения корзины. */
    onEvent: (event: CartWsEvent) => void;
    /** Вызывается при успешном открытии соединения. */
    onOpen?: () => void;
}

/**
 * Управляющий интерфейс активного канала корзины.
 */
export interface CartSocket {
    /** Закрывает соединение и отменяет запланированный реконнект. */
    close(): void;
}

/** Максимальное число шагов экспоненциальной задержки реконнекта. */
const MAX_BACKOFF_STEP = 6;

/**
 * Собирает URL WebSocket-эндпоинта совместной корзины на основе текущего
 * хоста и протокола страницы.
 *
 * @param cartId Идентификатор корзины.
 * @returns Полный URL для подключения.
 */
function buildCartWsUrl(cartId: string): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws/cart?cart_id=${encodeURIComponent(cartId)}`;
}

/**
 * Подключается к WebSocket-каналу совместной корзины и возвращает управляющий
 * объект.
 *
 * Реализует автоматический реконнект с экспоненциальной задержкой (от 1 с до
 * 30 с) до тех пор, пока соединение не будет закрыто явно через {@link
 * CartSocket.close}. Каждое сообщение бэкенда (изменение позиций, состав
 * участников, закрытие комнаты) парсится в {@link CartWsEvent} и передаётся в
 * `handlers.onEvent`.
 *
 * @param cartId Идентификатор корзины.
 * @param handlers Колбэки уведомлений.
 * @returns Управляющий объект для остановки канала.
 */
export function connectCartSocket(cartId: string, handlers: CartSocketHandlers): CartSocket {
    let socket: WebSocket | null = null;
    let closedByUser = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;

    const scheduleReconnect = () => {
        if (closedByUser) return;
        reconnectAttempt = Math.min(reconnectAttempt + 1, MAX_BACKOFF_STEP);
        const delay = Math.min(1000 * 2 ** (reconnectAttempt - 1), 30_000);
        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, delay);
    };

    const connect = () => {
        if (closedByUser) return;
        try {
            socket = new WebSocket(buildCartWsUrl(cartId));
        } catch (e) {
            console.error('cartSocket: failed to construct WebSocket', e);
            scheduleReconnect();
            return;
        }

        socket.addEventListener('open', () => {
            reconnectAttempt = 0;
            handlers.onOpen?.();
        });

        socket.addEventListener('message', (e) => {
            try {
                const data = JSON.parse(e.data) as CartWsEvent;
                handlers.onEvent(data);
            } catch (parseErr) {
                console.warn('cartSocket: failed to parse message', parseErr, e.data);
            }
        });

        socket.addEventListener('close', () => {
            socket = null;
            if (!closedByUser) scheduleReconnect();
        });

        // Ошибку транспорта отдельно не обрабатываем: за ней всегда следует
        // событие close, в котором и планируется реконнект.
        socket.addEventListener('error', () => {});
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
    };
}
