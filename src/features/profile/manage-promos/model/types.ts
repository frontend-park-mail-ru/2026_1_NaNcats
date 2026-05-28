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

/**
 * Собирает строку условий промокода: ресторан(ы) и минимальный чек. Если
 * передана карта названий брендов, подставляет имя ресторана — чтобы было
 * понятно, где действует промокод.
 */
function buildCondition(dto: PromoDTO, brandNames?: Record<string, string>): string {
    const parts: string[] = [];
    const ids = dto.restaurant_brand_ids;
    if (ids.length === 1) {
        const name = brandNames?.[String(ids[0])];
        parts.push(name ? `Только в ресторане «${name}»` : 'Только в одном ресторане');
    } else if (ids.length > 1) {
        const names = ids.map((id) => brandNames?.[String(id)]).filter((n): n is string => Boolean(n));
        parts.push(names.length === ids.length ? `Рестораны: ${names.join(', ')}` : 'Только в избранных ресторанах');
    } else {
        parts.push('Любой ресторан');
    }
    if (dto.min_order_amount > 0) {
        parts.push(`от ${Math.round(dto.min_order_amount / 1_000_000)} ₽`);
    }
    return parts.join(' · ');
}

/**
 * Преобразует DTO бэкенда в UI Promo.
 *
 * @param dto Промокод с бэкенда.
 * @param brandNames Карта «id бренда → название» для пояснения, где действует.
 */
export function dtoToPromo(dto: PromoDTO, brandNames?: Record<string, string>): Promo {
    const expiry = checkExpiringSoon(dto.expires_at);
    return {
        id: String(dto.id),
        code: dto.code,
        title: dto.title,
        condition: buildCondition(dto, brandNames),
        expiresAt: formatExpiry(dto.expires_at),
        expiringSoon: expiry.soon,
        expiringSoonText: expiry.text,
    };
}
