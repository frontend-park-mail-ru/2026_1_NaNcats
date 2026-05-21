// Мок-данные промокодов для верстки. Будут заменены на ответ бэкенда, когда
// эндпоинт промокодов окажется на фронте.

import type { Promo } from './types';

export const MOCK_PROMOS: readonly Promo[] = [
    {
        id: 'epic30',
        code: 'EPIC30',
        title: 'Скидка 30% на пиццу',
        condition: 'Pizza Epic Family · от 800 ₽',
        expiresAt: 'до 20 мая 2026',
    },
    {
        id: 'welcome300',
        code: 'WELCOME300',
        title: '300 ₽ на первый заказ',
        condition: 'Любой ресторан · от 1 200 ₽',
        expiresAt: 'до 31 мая 2026',
    },
    {
        id: 'freeburger',
        code: 'FREEBURGER',
        title: 'Бесплатная доставка',
        condition: 'Burger Heroes',
        expiresAt: 'до 13 мая 2026',
        expiringSoon: true,
        expiringSoonText: '⏱ Истекает через 2 дня · до 13 мая',
    },
];
