/**
 * Описание визуального бейджа статуса заказа.
 */
export interface StatusBadge {
    /** Текст подписи. */
    label: string;
    /** Эмодзи-иконка. */
    icon: string;
    /** CSS-модификатор: `success`, `progress`, `warning` или `danger`. */
    className: string;
}

const BADGES: Record<string, StatusBadge> = {
    created: { label: 'Принят', icon: '📝', className: 'progress' },
    cart_locked: { label: 'Ожидает оплаты', icon: '⏳', className: 'warning' },
    payment_ready: { label: 'Ожидает оплаты', icon: '💳', className: 'warning' },
    paid: { label: 'Оплачен', icon: '✅', className: 'success' },
    in_progress: { label: 'Готовится', icon: '🍳', className: 'progress' },
    waiting: { label: 'Готовится', icon: '🍳', className: 'progress' },
    delivering: { label: 'В пути', icon: '🚗', className: 'progress' },
    finished: { label: 'Доставлен', icon: '🎉', className: 'success' },
    cancelled: { label: 'Отменён', icon: '✖', className: 'danger' },
    failed: { label: 'Ошибка', icon: '⚠️', className: 'danger' },
};

const FALLBACK: StatusBadge = { label: 'Неизвестно', icon: '❓', className: 'progress' };

/**
 * Подбирает визуальный бейдж для сырого статуса заказа.
 *
 * При отсутствии или неизвестном статусе возвращает фолбэк с подписью
 * «Неизвестно», чтобы UI всегда мог отобразить какой-то бейдж.
 *
 * @param rawStatus Сырой статус заказа от бэкенда.
 * @returns Описание бейджа.
 */
export function statusBadge(rawStatus: string | undefined | null): StatusBadge {
    if (!rawStatus) return FALLBACK;
    return BADGES[rawStatus] ?? FALLBACK;
}
