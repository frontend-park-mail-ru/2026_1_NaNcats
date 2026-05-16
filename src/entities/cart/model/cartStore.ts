import { Store } from '@shared/lib/store';
import { ApiError } from '@shared/api/http';
import { Popup } from '@shared/ui/popup';
import { ROUTES } from '@shared/config/routes';
import { userStore } from '@entities/user';
import { cartApi } from '../api/cartApi';
import { connectCartSocket, type CartSocket } from '../api/cartSocket';
import type { CartConfirmer, CartInvite, CartSnapshot, CartState, CartWsEvent, DishToAdd } from './types';

/**
 * Проверяет, является ли ошибка ответом 409 с кодом `MULTIPLE_RESTAURANTS`.
 * Такой ответ бэкенд возвращает при попытке добавить в корзину блюдо из
 * другого ресторана; обработчик должен спросить подтверждение и очистить
 * корзину.
 *
 * @param e Произвольное значение, потенциально являющееся ошибкой.
 * @returns `true`, если это ApiError с нужным статусом и сообщением.
 */
const isMultipleRestaurantsError = (e: unknown): boolean => {
    if (!(e instanceof ApiError)) return false;
    return e.status === 409 && e.message === 'MULTIPLE_RESTAURANTS';
};

/**
 * Проверяет, является ли ошибка ответом 409 с кодом `CART_LOCKED`. Такой
 * ответ бэкенд возвращает, когда корзина заблокирована (например, ушла в
 * оплату); обработчик должен пересоздать корзину и повторить добавление.
 *
 * @param e Произвольное значение, потенциально являющееся ошибкой.
 * @returns `true`, если это ApiError с нужным статусом и сообщением.
 */
const isCartLockedError = (e: unknown): boolean => {
    if (!(e instanceof ApiError)) return false;
    return e.status === 409 && e.message === 'CART_LOCKED';
};

/**
 * Стор корзины пользователя.
 *
 * Поддерживает локальный снимок корзины в синхронном виде для UI и
 * инкапсулирует все взаимодействия с {@link cartApi}: загрузку, добавление,
 * изменение количества, очистку. Обрабатывает специфичные коды ошибок
 * бэкенда (`MULTIPLE_RESTAURANTS`, `CART_LOCKED`), запрашивая подтверждение
 * через переданный {@link CartConfirmer} и пересоздавая корзину при
 * необходимости. После любой записи перечитывает корзину с сервера
 * (`refresh`), чтобы локальное состояние совпадало с серверным.
 */
class CartStore extends Store<CartState> {
    /** Активный WebSocket-канал совместной корзины или `null`. */
    private realtimeSocket: CartSocket | null = null;
    /** Идентификатор корзины, для которой открыт {@link realtimeSocket}. */
    private realtimeCartId: string | null = null;

    constructor() {
        super({
            cartId: null,
            items: [],
            restaurantId: 0,
            mode: 'solo',
            roomStatus: '',
            adminId: null,
            members: [],
            totalCost: 0,
            status: 'idle',
        });
    }

    /**
     * Загружает текущую корзину с сервера и записывает в состояние. При
     * ошибке статус переводится в `error`, прежний снимок не очищается.
     */
    async load(): Promise<void> {
        this.setState({ status: 'loading', error: undefined });

        try {
            const snapshot = await cartApi.load();
            this.applySnapshot(snapshot, 'idle');
        } catch (e) {
            console.error('cartStore.load', e);
            this.setState({ status: 'error', error: 'load failed' });
        }
    }

    /**
     * Добавляет блюдо в корзину.
     *
     * Если в корзине уже есть позиции из другого ресторана, спрашивает
     * подтверждение через `confirmer` и при согласии очищает корзину перед
     * добавлением. После успеха перечитывает корзину с сервера.
     *
     * @param dish Блюдо к добавлению.
     * @param restaurantId Идентификатор ресторана, к которому относится блюдо.
     * @param confirmer Колбэк подтверждения очистки корзины при конфликте
     *   ресторанов; если не передан, конфликт считается отклонённым.
     * @throws Любая ошибка из API после установки статуса `error`.
     */
    async addDish(dish: DishToAdd, restaurantId: number, confirmer?: CartConfirmer): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });

        try {
            let snapshot = await this.ensureLoaded();

            if (snapshot.items.length > 0 && snapshot.restaurantId !== 0 && snapshot.restaurantId !== restaurantId) {
                // Совместную корзину очистить может только организатор, да и
                // сбрасывать чужие блюда неуместно. Поэтому просто сообщаем,
                // что рестораны смешивать нельзя.
                if (snapshot.mode === 'shared') {
                    throw new Error(
                        'совместная корзина собрана для другого ресторана, смешивать рестораны в ней нельзя',
                    );
                }

                const ok = confirmer ? await confirmer() : false;
                if (!ok) {
                    this.setState({ status: 'idle' });
                    return;
                }

                const currentCartId = snapshot.cartId;
                if (!currentCartId) {
                    throw new Error('cartStore.addDish: cart_id is missing before clear');
                }

                await cartApi.clear(currentCartId);
                snapshot = await this.refresh();
            }

            await this.addOrIncrement(snapshot, dish, restaurantId, confirmer);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.addDish', e);
            this.setState({ status: 'error', error: e instanceof Error ? e.message : 'add failed' });
            throw e;
        }
    }

    /**
     * Добавляет блюдо в корзину. Количество уже имеющейся позиции наращивает
     * сам бэкенд, поэтому отдельного обновления количества здесь нет.
     *
     * Обрабатывает два кода ошибки бэкенда: `CART_LOCKED` (корзина ушла в
     * оплату) и `MULTIPLE_RESTAURANTS` (в корзине блюдо из другого ресторана).
     * В обоих случаях корзина пересоздаётся, для конфликта ресторанов сначала
     * запрашивается подтверждение.
     *
     * @param snapshot Текущий снимок корзины.
     * @param dish Блюдо к добавлению.
     * @param restaurantId Идентификатор ресторана блюда.
     * @param confirmer Колбэк подтверждения при конфликте ресторанов.
     */
    private async addOrIncrement(
        snapshot: CartSnapshot,
        dish: DishToAdd,
        restaurantId: number,
        confirmer?: CartConfirmer,
    ): Promise<void> {
        try {
            await cartApi.addItem(snapshot.cartId, dish.id, 1);
        } catch (e) {
            if (isCartLockedError(e)) {
                const fresh = await this.refresh();
                if (fresh.cartId) {
                    await cartApi.clear(fresh.cartId);
                    await this.refresh();
                }
                await cartApi.addItem(null, dish.id, 1);
                return;
            }

            if (!isMultipleRestaurantsError(e)) throw e;

            const ok = confirmer ? await confirmer() : false;
            if (!ok) {
                this.setState({ status: 'idle' });
                return;
            }

            const fresh = await this.refresh();
            if (fresh.cartId) {
                await cartApi.clear(fresh.cartId);
                await this.refresh();
            }
            await cartApi.addItem(null, dish.id, 1);
        }

        void restaurantId;
    }

    /**
     * Меняет количество блюда в корзине на указанную дельту. Если итоговое
     * количество становится не положительным, позиция удаляется. После
     * успеха перечитывает корзину с сервера.
     *
     * @param dishId Идентификатор блюда.
     * @param delta Прирост количества (может быть отрицательным).
     */
    async changeQuantity(dishId: number, delta: number): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });

        try {
            const state = await this.ensureLoaded();

            const currentCartId = state.cartId;
            if (!currentCartId) {
                throw new Error('cartStore.changeQuantity: cart_id is missing');
            }

            // У блюда в совместной корзине бывает по позиции на участника,
            // поэтому трогаем только позицию текущего пользователя.
            const myId = userStore.getState().user?.id ?? null;
            const target = state.items.find(
                (i) => i.dish_id === dishId && (i.owner_user_id ?? null) === myId,
            );
            if (!target) {
                this.setState({ status: 'idle' });
                return;
            }

            const nextQty = target.quantity + delta;

            if (nextQty <= 0) {
                await cartApi.removeItem(currentCartId, dishId);
            } else {
                await cartApi.updateQuantity(currentCartId, dishId, nextQty);
            }

            await this.refresh();
        } catch (e) {
            console.error('cartStore.changeQuantity', e);
            this.setState({ status: 'error', error: 'change quantity failed' });
        }
    }

    /**
     * Полностью очищает корзину. Если корзина ещё не создана на сервере,
     * сбрасывает только локальное состояние без сетевого запроса.
     */
    async clear(): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });

        try {
            const state = await this.ensureLoaded();

            if (!state.cartId) {
                this.disconnectRealtime();
                this.setState({
                    cartId: null,
                    items: [],
                    restaurantId: 0,
                    mode: 'solo',
                    roomStatus: '',
                    adminId: null,
                    members: [],
                    totalCost: 0,
                    status: 'idle',
                    error: undefined,
                });
                return;
            }

            await cartApi.clear(state.cartId);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.clear', e);
            this.setState({ status: 'error', error: 'clear failed' });
        }
    }

    /**
     * Записывает поля снимка корзины в состояние стора, выставляя указанный
     * статус и сбрасывая поле ошибки.
     *
     * @param snapshot Снимок корзины.
     * @param status Целевое значение статуса.
     */
    private applySnapshot(snapshot: CartSnapshot, status: CartState['status']): void {
        this.setState({
            cartId: snapshot.cartId,
            items: snapshot.items,
            restaurantId: snapshot.restaurantId,
            mode: snapshot.mode,
            roomStatus: snapshot.roomStatus,
            adminId: snapshot.adminId,
            members: snapshot.members,
            totalCost: snapshot.totalCost,
            status,
            error: undefined,
        });
        this.syncRealtime(snapshot);
    }

    /**
     * Перечитывает корзину с сервера, применяет снимок и возвращает
     * результирующее состояние.
     *
     * @returns Актуальное состояние стора после применения снимка.
     */
    private async refresh(): Promise<CartState> {
        const fresh = await cartApi.load();
        this.applySnapshot(fresh, 'idle');
        return this.getState();
    }

    /**
     * Гарантирует, что корзина загружена. Если в локальном состоянии уже
     * есть `cartId` или позиции, повторного запроса не делает; иначе
     * подгружает снимок с сервера.
     *
     * @returns Актуальное состояние стора.
     */
    private async ensureLoaded(): Promise<CartState> {
        const state = this.getState();

        if (state.cartId || state.items.length > 0) {
            return state;
        }

        const fresh = await cartApi.load();
        this.applySnapshot(fresh, 'idle');
        return this.getState();
    }

    /**
     * Открывает или закрывает WebSocket-канал живых обновлений в зависимости
     * от снимка корзины. Канал нужен только для совместной (`shared`) корзины:
     * для соло-режима соединение закрывается. Повторный вызов с тем же
     * `cartId` соединение не пересоздаёт.
     *
     * @param snapshot Снимок корзины, к которому подстраивается канал.
     */
    private syncRealtime(snapshot: CartSnapshot): void {
        const shouldConnect = snapshot.mode === 'shared' && snapshot.cartId !== null;

        if (!shouldConnect) {
            this.disconnectRealtime();
            return;
        }
        if (this.realtimeCartId === snapshot.cartId) {
            return;
        }

        this.disconnectRealtime();
        this.realtimeCartId = snapshot.cartId;
        this.realtimeSocket = connectCartSocket(snapshot.cartId as string, {
            onEvent: (event) => this.handleRealtimeEvent(event),
        });
    }

    /**
     * Обрабатывает событие WebSocket-канала: перечитывает корзину целиком,
     * так как дельты бэкенд не присылает. Событие `CartLocked` означает, что
     * организатор оформил совместный заказ.
     *
     * @param event Распарсенное событие изменения корзины.
     */
    private handleRealtimeEvent(event: CartWsEvent): void {
        if (event.event_type === 'CartLocked') {
            this.notifyGuestOrderPlaced();
        }
        void this.refresh().catch((e) => console.error('cartStore: realtime refresh failed', e));
    }

    /**
     * Уводит гостя совместной корзины на страницу профиля, чтобы он оплатил
     * свою часть оформленного заказа. Пометку в sessionStorage читает профиль
     * и сразу открывает нужный заказ. Организатору это не нужно: он и так
     * видит модалку статуса после оформления.
     */
    private notifyGuestOrderPlaced(): void {
        const state = this.getState();
        const me = userStore.getState().user;
        const isGuest = me !== null && state.adminId !== null && me.id !== state.adminId;
        if (!isGuest) return;

        try {
            sessionStorage.setItem('nancats:open_pending_split_order', '1');
        } catch (e) {
            console.warn('cartStore: sessionStorage unavailable', e);
        }

        void Popup.alert('Организатор оформил совместный заказ. Откроем его, чтобы вы оплатили свою часть.').then(
            () => {
                window.location.assign(ROUTES.profile);
            },
        );
    }

    /**
     * Закрывает активный WebSocket-канал совместной корзины, если он открыт.
     */
    private disconnectRealtime(): void {
        if (this.realtimeSocket) {
            this.realtimeSocket.close();
            this.realtimeSocket = null;
        }
        this.realtimeCartId = null;
    }

    /**
     * Генерирует приглашение в совместную корзину и переводит её в режим
     * `shared`. Доступно только администратору корзины.
     *
     * @returns Токен приглашения и срок его действия.
     * @throws Error, если корзина ещё не создана, либо ApiError при отказе бэкенда.
     */
    async generateInvite(): Promise<CartInvite> {
        const state = await this.ensureLoaded();
        if (!state.cartId) {
            throw new Error('Корзина пуста: добавьте блюдо, прежде чем приглашать друзей');
        }

        this.setState({ status: 'syncing', error: undefined });
        try {
            const invite = await cartApi.generateInvite(state.cartId);
            // Бэкенд переводит корзину в shared-режим - перечитываем снимок.
            await this.refresh();
            return { token: invite.token ?? '', expiresAt: invite.expires_at ?? '' };
        } catch (e) {
            console.error('cartStore.generateInvite', e);
            this.setState({ status: 'error', error: 'invite failed' });
            throw e;
        }
    }

    /**
     * Присоединяет текущего пользователя к совместной корзине по токену
     * приглашения и загружает её снимок.
     *
     * @param token Токен приглашения.
     * @throws ApiError, если приглашение недействительно или просрочено.
     */
    async joinByToken(token: string): Promise<void> {
        this.setState({ status: 'syncing', error: undefined });
        try {
            await cartApi.joinCart(token);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.joinByToken', e);
            this.setState({ status: 'error', error: 'join failed' });
            throw e;
        }
    }

    /**
     * Удаляет участника из совместной корзины. Доступно только
     * администратору; блюда удалённого участника становятся ничейными.
     *
     * @param targetUserId Идентификатор удаляемого участника.
     */
    async kickMember(targetUserId: number): Promise<void> {
        const state = this.getState();
        if (!state.cartId) return;

        this.setState({ status: 'syncing', error: undefined });
        try {
            await cartApi.kickMember(state.cartId, targetUserId);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.kickMember', e);
            this.setState({ status: 'error', error: 'kick failed' });
            throw e;
        }
    }

    /**
     * Закрывает совместную корзину и возвращает её в соло-режим. Доступно
     * только администратору; гости и их блюда удаляются.
     */
    async closeShared(): Promise<void> {
        const state = this.getState();
        if (!state.cartId) return;

        this.setState({ status: 'syncing', error: undefined });
        try {
            await cartApi.closeSharedCart(state.cartId);
            await this.refresh();
        } catch (e) {
            console.error('cartStore.closeShared', e);
            this.setState({ status: 'error', error: 'close failed' });
            throw e;
        }
    }

    /**
     * Сбрасывает корзину в пустое состояние и закрывает канал живых
     * обновлений. Вызывается при выходе пользователя из аккаунта.
     */
    reset(): void {
        this.disconnectRealtime();
        this.setState({
            cartId: null,
            items: [],
            restaurantId: 0,
            mode: 'solo',
            roomStatus: '',
            adminId: null,
            members: [],
            totalCost: 0,
            status: 'idle',
            error: undefined,
        });
    }
}

export const cartStore = new CartStore();
