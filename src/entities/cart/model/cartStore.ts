import { Store } from '@shared/lib/store';
import { ApiError } from '@shared/api/http';
import { cartApi } from '../api/cartApi';
import type { CartConfirmer, CartSnapshot, CartState, DishToAdd } from './types';

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
     * Внутренний путь добавления блюда: инкрементирует количество, если
     * позиция уже есть в корзине, иначе создаёт новую.
     *
     * Обрабатывает два специфичных кода ошибки бэкенда:
     * `CART_LOCKED` (текущая корзина заблокирована: пересоздаётся новая) и
     * `MULTIPLE_RESTAURANTS` (конфликт ресторанов после гонки: запрашивается
     * подтверждение и корзина пересоздаётся).
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
        const existing = snapshot.items.find((i) => i.dish_id === dish.id);

        try {
            if (existing) {
                const currentCartId = snapshot.cartId;
                if (!currentCartId) {
                    throw new Error('cartStore.addDish: cart_id is missing for quantity update');
                }
                await cartApi.updateQuantity(currentCartId, dish.id, existing.quantity + 1);
            } else {
                await cartApi.addItem(snapshot.cartId, dish.id, 1);
            }
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

            const target = state.items.find((i) => i.dish_id === dishId);
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
}

export const cartStore = new CartStore();
