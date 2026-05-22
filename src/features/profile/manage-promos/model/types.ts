/**
 * Промокод из бэкенда.
 */
export interface PromoDTO {
    id: number;
    code: string;
    title: string;
    discount_percent: number | null;
    discount_amount: number | null;
    min_order_amount: number;
    expires_at: string;
    restaurant_brand_ids: number[];
}

/**
 * Промокод в UI-формате для отображения в карточке.
 */
export interface Promo {
    id: string;
    code: string;
    title: string;
    condition: string;
    expiresAt: string;
    expiringSoon?: boolean;
    expiringSoonText?: string;
}

const RU_MONTHS = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
];

/** Преобразует ISO-дату в «до 31 мая 2026». */
function formatExpiry(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `до ${d.getDate()} ${RU_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Проверяет, истекает ли промокод в ближайшие 7 дней. */
function checkExpiringSoon(iso: string): { soon: boolean; text: string } {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { soon: false, text: '' };
    const diff = d.getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return { soon: true, text: `⏱ Истёк` };
    if (days <= 7)
        return { soon: true, text: `⏱ Истекает через ${days} дн. · до ${d.getDate()} ${RU_MONTHS[d.getMonth()]}` };
    return { soon: false, text: '' };
}

/** Собирает строку условий промокода: рестораны и минимальный чек. */
function buildCondition(dto: PromoDTO): string {
    const parts: string[] = [];
    if (dto.restaurant_brand_ids.length === 1) {
        parts.push('Только в одном ресторане');
    } else if (dto.restaurant_brand_ids.length > 1) {
        parts.push('Только в избранных ресторанах');
    } else {
        parts.push('Любой ресторан');
    }
    if (dto.min_order_amount > 0) {
        parts.push(`от ${Math.round(dto.min_order_amount / 1_000_000)} ₽`);
    }
    return parts.join(' · ');
}

/** Преобразует DTO бэкенда в UI Promo. */
export function dtoToPromo(dto: PromoDTO): Promo {
    const expiry = checkExpiringSoon(dto.expires_at);
    return {
        id: String(dto.id),
        code: dto.code,
        title: dto.title,
        condition: buildCondition(dto),
        expiresAt: formatExpiry(dto.expires_at),
        expiringSoon: expiry.soon,
        expiringSoonText: expiry.text,
    };
}
