// Виджет корзины: список позиций, изменение количества, итог и переход к оформлению.
// Кнопка закрытия сохраняет класс js-close-panels для внешнего слушателя на страницах.

import './cartWidget.scss';

import { cartStore, fromMicros, type CartItem } from '@entities/cart';
import { clearCart } from '@features/cart/clear-cart';
import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { computed, useStoreSignal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';

/** Картинка-заглушка блюда при ошибке загрузки `image_url`. */
const FALLBACK_DISH_IMAGE = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

export interface CartWidgetProps {
    /** Колбэк после перехода к оформлению (например, чтобы закрыть боковую панель). */
    onCheckout?: () => void;
}

async function handleClear(): Promise<void> {
    try {
        await clearCart();
    } catch (err) {
        console.error('[CartWidget] clearCart failed:', err);
        await Popup.alert('Не удалось очистить корзину. Попробуйте ещё раз.');
    }
}

/** Цена одной позиции в рублях, без дробной части. */
function formatItemPriceRub(item: CartItem): string {
    return `${fromMicros(item.price).toFixed(0)}₽`;
}

/** Виджет корзины: список позиций, изменение количества, итог и переход к оформлению. */
export function CartWidget(props: CartWidgetProps = {}): VNode {
    const items = useStoreSignal(cartStore, (s) => s.items);
    const totalCost = useStoreSignal(cartStore, (s) => s.totalCost);
    const status = useStoreSignal(cartStore, (s) => s.status);

    const hasItems = computed<boolean>(() => items().length > 0);
    const totalRub = computed<string>(() => `${fromMicros(totalCost()).toFixed(0)}₽`);
    const clearDisabled = computed<boolean>(() => status() === 'syncing');

    const handleCheckout = (): void => {
        void router.go(ROUTES.checkout);
        props.onCheckout?.();
    };

    const handleImgError = (event: Event): void => {
        const img = event.target as HTMLImageElement | null;
        if (img) img.src = FALLBACK_DISH_IMAGE;
    };

    return (
        <div class="cart-wrapper">
            <div class="cart-header-top">
                <span class="cart-title">Корзина</span>
                <div class="cart-header-actions">
                    <Show when={hasItems}>
                        <button
                            id="clear-cart-btn"
                            class="button button_secondary"
                            type="button"
                            disabled={clearDisabled}
                            onClick={(): void => {
                                void handleClear();
                            }}
                        >
                            Очистить
                        </button>
                    </Show>
                    <button
                        type="button"
                        class="cart-close-btn js-close-panels"
                        aria-label="Закрыть корзину"
                    >
                        ×
                    </button>
                </div>
            </div>

            <Show
                when={hasItems}
                fallback={
                    <>
                        <div class="cart-empty-container">
                            <div class="empty-icon">🛍️</div>
                            <div class="empty-title">Тут пока пусто</div>
                            <div class="empty-subtitle">Выберите что-нибудь вкусное</div>
                        </div>
                        <div class="cart-footer">
                            <button class="button button_checkout" type="button" disabled>
                                Оформить заказ
                            </button>
                        </div>
                    </>
                }
            >
                <div class="cart-items-list">
                    <For each={items} key={(item): number => item.dish_id}>
                        {(item): VNode => {
                            const dishId = item.dish_id;
                            // For не перевызывает children при изменении полей позиции,
                            // поэтому актуальную позицию читаем из сигнала items на каждом
                            // тике; если позиция исчезла, держим последний снимок до размонтирования.
                            const currentItem = computed<CartItem>(
                                () => items().find((it) => it.dish_id === dishId) ?? item,
                            );
                            const quantity = computed<number>(() => currentItem().quantity);
                            const priceRub = computed<string>(() => formatItemPriceRub(currentItem()));
                            return (
                                <div class="cart-item">
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        class="cart-item__img"
                                        onError={handleImgError}
                                    />
                                    <div class="cart-item__info">
                                        <div class="cart-item__name">{item.name}</div>
                                        <div class="cart-item__price">{priceRub}</div>
                                    </div>
                                    <div class="cart-item__counter">
                                        <button
                                            type="button"
                                            class="counter-btn js-minus"
                                            data-id={dishId}
                                            onClick={(): void => {
                                                void cartStore.changeQuantity(dishId, -1);
                                            }}
                                        >
                                            −
                                        </button>
                                        <span class="counter-value">{quantity}</span>
                                        <button
                                            type="button"
                                            class="counter-btn js-plus"
                                            data-id={dishId}
                                            onClick={(): void => {
                                                void cartStore.changeQuantity(dishId, 1);
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>

                <div class="cart-footer">
                    <button
                        class="button button_checkout active js-checkout-btn"
                        type="button"
                        onClick={handleCheckout}
                    >
                        <span>Оформить заказ</span>
                        <span>{totalRub}</span>
                    </button>
                </div>
            </Show>
        </div>
    ) as VNode;
}
