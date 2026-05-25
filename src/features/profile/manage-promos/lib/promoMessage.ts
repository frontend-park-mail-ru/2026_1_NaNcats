// Маппинг reason-строки от бэка в читаемое русское сообщение.
// Используется и в чекауте, и в виджете корзины, и в модалке профиля,
// чтобы текст ошибки промокода был единообразным во всех точках входа.

const REASON_MAP: Record<string, string> = {
    'promo not found': 'Промокод не найден',
    'promo has expired': 'Срок действия промокода истёк',
    'order amount is below minimum': 'Сумма заказа ниже минимальной для этого промокода',
    'promo is not valid for this restaurant': 'Промокод не действует в этом ресторане',
    'promo is tied to another user': 'Промокод предназначен другому пользователю',
    'promo already used': 'Промокод уже был использован',
    'max uses reached': 'Промокод исчерпал лимит использований',
};

export function promoReasonToMessage(reason: string): string {
    return REASON_MAP[reason] ?? 'Промокод недействителен';
}
