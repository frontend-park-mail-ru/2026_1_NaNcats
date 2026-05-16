import { httpClient } from '@shared/api/http';
import type { CartItem, CartMember, CartSnapshot } from '../model/types';

/**
 * Сырой ответ эндпоинтов `GET /cart`. Отделён от {@link CartSnapshot}, чтобы
 * не смешивать имена полей бэкенда (snake_case, опциональные) с
 * нормализованной формой, в которой работает фронтенд.
 */
interface CartResponse {
    cart_id?: string;
    items?: CartItem[];
    restaurant_id?: number;
    mode?: string;
    status?: string;
    admin_id?: number;
    members?: CartMember[];
    total_cost?: number;
}

/**
 * Ответ эндпоинта генерации инвайта в групповую корзину.
 */
interface InviteResponse {
    token?: string;
    expires_at?: string;
}

/**
 * Ответ эндпоинта присоединения к корзине по токену.
 */
interface JoinCartResponse {
    cart_id?: string;
}

/**
 * Добавляет в полезную нагрузку поле `cart_id`, если идентификатор корзины
 * известен. Используется для эндпоинтов, в которых `cart_id` опциональный
 * (создаётся новая корзина при его отсутствии).
 *
 * @template T Тип исходной полезной нагрузки.
 * @param cartId Идентификатор корзины или `null`.
 * @param payload Исходная полезная нагрузка.
 * @returns Полезная нагрузка с добавленным `cart_id` либо без изменений.
 */
const withCartId = <T extends object>(cartId: string | null, payload: T): T | (T & { cart_id: string }) => {
    return cartId ? { ...payload, cart_id: cartId } : payload;
};

/**
 * REST-клиент для работы с корзиной (как пользовательской, так и групповой).
 * Загрузка нормализует ответ бэкенда под {@link CartSnapshot}; остальные
 * методы делегируются {@link httpClient} без преобразования.
 */
export const cartApi = {
    /**
     * Загружает снимок текущей корзины.
     *
     * Поля ответа бэкенда заполняются значениями по умолчанию, чтобы
     * вызывающий код мог не проверять их на `undefined`.
     *
     * @returns Нормализованный снимок корзины.
     */
    async load(): Promise<CartSnapshot> {
        const data = await httpClient.getJson<CartResponse>('/cart');

        return {
            cartId: data.cart_id ? data.cart_id : null,
            items: data.items ?? [],
            restaurantId: data.restaurant_id ?? 0,
            mode: data.mode ?? 'solo',
            roomStatus: data.status ?? '',
            adminId: data.admin_id ?? null,
            members: data.members ?? [],
            totalCost: data.total_cost ?? 0,
        };
    },

    /**
     * Добавляет позицию в корзину. Если `cartId` равен `null`, бэкенд создаст
     * новую корзину под текущим пользователем.
     *
     * @param cartId Идентификатор корзины или `null` для создания новой.
     * @param dishId Идентификатор блюда.
     * @param quantity Количество единиц (по умолчанию 1).
     */
    addItem(cartId: string | null, dishId: number, quantity: number = 1): Promise<void> {
        return httpClient.send(
            'POST',
            '/cart/items',
            withCartId(cartId, {
                // Каталог ресторанов отдаёт id блюд строками, а cart-сервис
                // ждёт int64: приводим к числу, иначе бэкенд вернёт 400.
                dish_id: Number(dishId),
                quantity: Number(quantity),
            }),
        );
    },

    /**
     * Заменяет количество позиции в корзине на указанное значение.
     *
     * @param cartId Идентификатор корзины.
     * @param dishId Идентификатор блюда.
     * @param quantity Новое количество единиц.
     */
    updateQuantity(cartId: string, dishId: number, quantity: number): Promise<void> {
        return httpClient.send('PUT', '/cart/items', {
            cart_id: cartId,
            dish_id: Number(dishId),
            quantity: Number(quantity),
        });
    },

    /**
     * Удаляет позицию из корзины полностью.
     *
     * @param cartId Идентификатор корзины.
     * @param dishId Идентификатор блюда.
     */
    removeItem(cartId: string, dishId: number): Promise<void> {
        return httpClient.send('DELETE', '/cart/items', {
            cart_id: cartId,
            dish_id: Number(dishId),
        });
    },

    /**
     * Полностью очищает корзину.
     *
     * @param cartId Идентификатор корзины.
     */
    clear(cartId: string): Promise<void> {
        return httpClient.send('DELETE', '/cart', {
            cart_id: cartId,
        });
    },

    /**
     * Меняет владельца позиции в групповой корзине (для разделения чека).
     *
     * @param cartId Идентификатор корзины.
     * @param dishId Идентификатор блюда.
     * @param newOwnerId Идентификатор нового владельца или `null`, чтобы
     *   снять привязку.
     */
    reassignOwner(cartId: string, dishId: number, newOwnerId: number | null): Promise<void> {
        return httpClient.send('PATCH', '/cart/items/owner', {
            cart_id: cartId,
            dish_id: Number(dishId),
            new_owner_id: newOwnerId,
        });
    },

    /**
     * Генерирует приглашение в групповую корзину.
     *
     * @param cartId Идентификатор корзины.
     * @returns Ответ с токеном и временем истечения.
     */
    generateInvite(cartId: string): Promise<InviteResponse> {
        return httpClient.postJson<InviteResponse>(`/cart/invite?cart_id=${encodeURIComponent(cartId)}`, {});
    },

    /**
     * Присоединяет текущего пользователя к групповой корзине по токену
     * приглашения.
     *
     * @param token Токен приглашения.
     * @returns Ответ с идентификатором корзины, к которой произошло
     *   присоединение.
     */
    joinCart(token: string): Promise<JoinCartResponse> {
        return httpClient.postJson<JoinCartResponse>('/cart/join', { token });
    },

    /**
     * Удаляет участника из групповой корзины (доступно администратору).
     *
     * @param cartId Идентификатор корзины.
     * @param targetUserId Идентификатор пользователя, которого нужно удалить.
     */
    kickMember(cartId: string, targetUserId: number): Promise<void> {
        return httpClient.send('DELETE', '/cart/members', {
            cart_id: cartId,
            target_user_id: targetUserId,
        });
    },

    /**
     * Закрывает групповую корзину для дальнейших изменений и переводит её к
     * этапу оформления заказа.
     *
     * @param cartId Идентификатор корзины.
     */
    closeSharedCart(cartId: string): Promise<void> {
        return httpClient.send('POST', '/cart/close', {
            cart_id: cartId,
        });
    },

    /**
     * Альтернативный путь обновления количества через `putJson`. Используется
     * вызывающим кодом, который ожидает JSON-ответ от сервера.
     *
     * @param cartId Идентификатор корзины.
     * @param dishId Идентификатор блюда.
     * @param quantity Новое количество единиц.
     */
    update(cartId: string, dishId: number, quantity: number): Promise<void> {
        return httpClient.putJson('/cart/items', {
            cart_id: cartId,
            dish_id: Number(dishId),
            quantity: Number(quantity),
        });
    },

    /**
     * Альтернативный путь удаления позиции через `deleteJson`. Используется
     * вызывающим кодом, который ожидает JSON-ответ от сервера.
     *
     * @param cartId Идентификатор корзины.
     * @param dishId Идентификатор блюда.
     */
    remove(cartId: string, dishId: number): Promise<void> {
        return httpClient.deleteJson('/cart/items', { cart_id: cartId, dish_id: Number(dishId) });
    },
};
