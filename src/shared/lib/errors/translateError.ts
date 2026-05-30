/**
 * Перевод серверных ошибок на русский. Бэкенд во многих местах отдаёт
 * сообщения на английском (а иногда машинные слаги вроде CART_LOCKED). Нигде в
 * UI нельзя показывать такой текст напрямую — этот модуль превращает его в
 * аккуратное русское сообщение. Неизвестный английский текст не «протекает» в
 * интерфейс: для него возвращается безопасный обобщённый фолбэк.
 */

import { ApiError } from '@shared/api/http';

/** Карта известных серверных сообщений (в нижнем регистре) → русский текст. */
const MESSAGE_MAP: Record<string, string> = {
    // Авторизация / пользователь
    unauthorized: 'Войдите в аккаунт, чтобы продолжить',
    'invalid session': 'Сессия истекла, войдите снова',
    'email already exists': 'Этот email уже зарегистрирован',
    'email already in use': 'Этот email уже зарегистрирован',
    'user not found': 'Пользователь не найден',
    'target user not found': 'Пользователь не найден',

    // Адреса
    'address not found': 'Адрес не найден',
    'address id is required': 'Не указан адрес',
    'failed to fetch addresses': 'Не удалось загрузить адреса',
    'failed to save address': 'Не удалось сохранить адрес',
    'failed to update address': 'Не удалось обновить адрес',
    'failed to delete address': 'Не удалось удалить адрес',

    // Карты / оплата
    'card id is required': 'Не выбрана карта',
    'card not found': 'Карта не найдена',
    'failed to get payment methods': 'Не удалось загрузить способы оплаты',
    'failed to set default payment method': 'Не удалось выбрать карту по умолчанию',
    'failed to delete payment method': 'Не удалось удалить карту',
    'failed to initiate payment': 'Не удалось начать оплату',
    'failed to initiate payment method binding': 'Не удалось привязать карту',

    // Корзина
    'cart is empty': 'Корзина пуста',
    cart_locked: 'Корзина сейчас оформляется, дождитесь завершения',
    multiple_restaurants: 'В корзине блюда из разных ресторанов',
    'cannot checkout: cart has unassigned items': 'У некоторых блюд нет владельца — распределите их перед оформлением',
    'failed to get cart': 'Не удалось загрузить корзину',
    'invalid cart data': 'Не удалось обработать корзину',
    'invalid quantity': 'Неверное количество',
    'only admin can clear cart': 'Очистить корзину может только организатор',
    'only admin can close shared cart': 'Закрыть общую корзину может только организатор',
    'only admin can generate invites': 'Создавать приглашения может только организатор',
    'only admin can kick members': 'Удалять участников может только организатор',
    'only admin can reassign items': 'Перераспределять блюда может только организатор',
    'you can only remove your own items': 'Можно убирать только свои блюда',
    'you can only update your own items': 'Можно менять только свои блюда',
    'you have no rights to add items to this cart': 'Нет прав добавлять блюда в эту корзину',
    'invite link is invalid or expired': 'Ссылка-приглашение недействительна или истекла',
    'failed to generate invite': 'Не удалось создать приглашение',

    // Заказы
    'order id is required': 'Не указан заказ',

    // Рестораны / блюда / отзывы
    'restaurant not found': 'Ресторан не найден',
    'dishes or restaurant not found': 'Ресторан или блюда не найдены',
    'rating must be between 1 and 5': 'Оценка должна быть от 1 до 5',
    'comment is required': 'Добавьте комментарий',

    // Промокоды
    'promo not found': 'Промокод не найден',
    'already bound': 'Промокод уже привязан',

    // Файлы / загрузка
    'file is too large (max 5mb)': 'Файл слишком большой (до 5 МБ)',
    'file size larger than 5mb limit': 'Файл слишком большой (до 5 МБ)',
    'form data is too large': 'Файл слишком большой (до 5 МБ)',
    'form data is too large (max 5mb)': 'Файл слишком большой (до 5 МБ)',
    'unsupported image format': 'Неподдерживаемый формат изображения',
    'failed to process file': 'Не удалось обработать файл',
    'failed to process image file': 'Не удалось обработать изображение',
    'failed to process logo file': 'Не удалось обработать логотип',
    'failed to upload avatar': 'Не удалось загрузить аватар',
    'failed to delete avatar': 'Не удалось удалить аватар',

    // Игра «5 букв»
    'word is not in the dictionary': 'Такого слова нет в словаре',
    'word length must be exactly 5 letters': 'Слово должно быть из 5 букв',
    'game is already finished for today': 'Игра на сегодня уже закончена',

    // Общие
    'internal server error': 'Что-то пошло не так. Попробуйте позже',
    'invalid request body': 'Неверные данные запроса',
    'invalid payload': 'Неверные данные запроса',
    'network request failed': 'Нет соединения с сервером. Проверьте интернет',
};

/** Универсальный фолбэк, когда конкретный текст ошибки неизвестен. */
const GENERIC_FALLBACK = 'Что-то пошло не так. Попробуйте ещё раз';

/** Сообщение для сетевых сбоев (запрос не дошёл до сервера). */
const NETWORK_FALLBACK = 'Нет соединения с сервером. Проверьте интернет';

/** Есть ли в строке латиница (признак непереведённого серверного текста). */
function hasLatin(text: string): boolean {
    return /[a-z]/i.test(text);
}

/**
 * Достаёт текст сообщения из любого пойманного значения.
 *
 * @param err Пойманное исключение/значение.
 * @returns Строка-сообщение (возможно, пустая).
 */
function extractMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === 'string') return m;
    }
    return '';
}

/**
 * Переводит серверную ошибку в аккуратное русское сообщение для UI.
 *
 * Логика: сетевой сбой → отдельный текст; известное сообщение → перевод по
 * карте; уже русский текст (без латиницы) пропускаем как есть; неизвестный
 * английский текст НИКОГДА не показываем — отдаём `fallback`.
 *
 * @param err Пойманное исключение (ApiError, Error, строка и т.п.).
 * @param fallback Текст по умолчанию для неизвестных/английских ошибок.
 * @returns Русское сообщение, готовое к показу пользователю.
 */
export function translateError(err: unknown, fallback: string = GENERIC_FALLBACK): string {
    if (err instanceof ApiError && err.status === 0) return NETWORK_FALLBACK;

    const raw = extractMessage(err).trim();
    if (raw === '') return fallback;

    const mapped = MESSAGE_MAP[raw.toLowerCase()];
    if (mapped) return mapped;

    // Текст уже на русском (нет латиницы) — например, готовые сообщения колеса.
    if (!hasLatin(raw)) return raw;

    // Непереведённый английский/слаг наружу не показываем.
    return fallback;
}
