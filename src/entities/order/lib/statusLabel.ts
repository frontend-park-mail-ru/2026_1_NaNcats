export interface StatusBadge {
    label: string;
    icon: string;
    className: string; // CSS-модификатор: success | progress | warning | danger
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

export function statusBadge(rawStatus: string | undefined | null): StatusBadge {
    if (!rawStatus) return FALLBACK;
    return BADGES[rawStatus] ?? FALLBACK;
}
