/**
 * Пара координат в формате `[широта, долгота]`. Кортеж используется, чтобы
 * совпадать с форматом, в котором координаты сохраняются в localStorage.
 */
export type Coordinates = [number, number];

/**
 * Геолокационная часть адреса: текстовое представление и числовые координаты.
 */
export interface AddressLocation {
    /** Человекочитаемая строка адреса. */
    address_text: string;
    /** Широта в градусах. */
    latitude: number;
    /** Долгота в градусах. */
    longitude: number;
}

/**
 * Дополнительные поля адреса, не относящиеся к геолокации (вход в подъезд,
 * комментарии курьеру, метка адреса).
 */
export interface AddressDetails {
    /** Номер квартиры или офиса. */
    apartment?: string;
    /** Номер подъезда. */
    entrance?: string;
    /** Этаж. */
    floor?: string;
    /** Код домофона. */
    door_code?: string;
    /** Свободный комментарий курьеру. */
    courier_comment?: string;
    /** Пользовательская метка адреса (например, «Дом», «Работа»). */
    label?: string;
}

/**
 * Сохранённый адрес профиля: геолокация плюс детали и серверный идентификатор.
 */
export interface Address extends AddressDetails {
    /** Идентификатор адреса на стороне сервера. */
    id: string;
    /** Геолокационная часть адреса. */
    location: AddressLocation;
}

/**
 * Форма ответа эндпоинта `GET /profile/addresses`.
 */
export interface AddressListResponse {
    /** Список адресов; может отсутствовать, если их нет. */
    addresses?: Address[];
}

/**
 * Полезная нагрузка для создания или обновления адреса. В отличие от
 * {@link Address}, здесь координаты разнесены в плоские поля `lat`/`lon`,
 * чтобы соответствовать формату, ожидаемому бэкендом.
 */
export interface AddressUpsertPayload extends AddressDetails {
    /** Текстовое представление адреса. */
    address_text: string;
    /** Широта в градусах. */
    lat: number;
    /** Долгота в градусах. */
    lon: number;
}
