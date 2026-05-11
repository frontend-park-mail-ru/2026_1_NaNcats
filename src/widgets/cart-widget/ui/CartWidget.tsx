/**
 * Виджет корзины в виде функционального компонента VDOM/JSX.
 *
 * Поведение перенесено из старого `CartWidget.ts` 1:1: список позиций,
 * кнопки изменения количества, итог и переход к оформлению. Изменения по
 * сравнению с classic-реализацией:
 *
 * - Подписка на стор идёт через {@link useStoreSignal}: `items` и
 *   `totalCost` это сигналы-аксессоры, JSX перерисовывает только нужные
 *   куски DOM (счётчик одной позиции, итог в футере) без перестроения всего
 *   списка.
 * - Список позиций рендерится через `<For each>` с ключом `dish_id`:
 *   keyed-реконсиляция оставляет DOM-узел позиции живым между изменениями
 *   её количества, что нужно для CSS-анимаций добавления и убирает мерцание.
 * - Кнопка очистки больше не монтируется как отдельный child-компонент:
 *   она inline в JSX. Логика клика та же (вызов `cartStore.clear()` через
 *   `clearCart` из feature-слоя), и `disabled` привязан к статусу стора
 *   через сигнал.
 * - Кнопка закрытия панелей сохранила класс `js-close-panels`, чтобы
 *   внешний слушатель на странице ресторана и главной (он переключает
 *   класс контейнеров с боковыми панелями) продолжал работать до того, как
 *   страницы будут мигрированы в Unit 10a/10b.
 *
 * Дисциплина реактивных выражений (см. JSDoc в `vdom/show.tsx` и `vdom/for.tsx`).
 * Все JSX-выражения, которые должны реактивно меняться, передаются как
 * функции-аксессоры: либо сам сигнал (`when={items}` через `computed`),
 * либо inline-фабрика (`{(): string => fromMicros(totalCost()).toFixed(0) + '₽'}`).
 * Голые выражения вида `{totalCost()}` зафиксировались бы один раз при mount.
 */

import './cartWidget.scss';

import { cartStore, fromMicros, type CartItem } from '@entities/cart';
import { clearCart } from '@features/cart/clear-cart';
import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { computed, useStoreSignal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';

/** Дефолтная картинка блюда, подставляемая при ошибке загрузки `image_url`. */
const FALLBACK_DISH_IMAGE = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

/**
 * Пропсы компонента {@link CartWidget}.
 *
 * Пока пропов нет: виджет полностью подписывается на глобальный стор корзины
 * через {@link useStoreSignal} и не принимает никаких внешних колбэков. Если
 * потребуется кастомизация (например, изменение целевого роута оформления),
 * поля появятся здесь.
 */
export interface CartWidgetProps {
    /**
     * Опциональный колбэк, который выполняется после успешного перехода к
     * оформлению. Используется, например, страницей ресторана, чтобы
     * закрыть боковую панель корзины. Если не передан, после клика по
     * "Оформить заказ" выполняется только навигация.
     */
    onCheckout?: () => void;
}

/**
 * Обработчик клика по кнопке очистки корзины. Ловит ошибку API и показывает
 * пользователю подсказку через Popup, чтобы не падать в неинформативное
 * сообщение в консоли.
 */
async function handleClear(): Promise<void> {
    try {
        await clearCart();
    } catch (err) {
        console.error('[CartWidget] clearCart failed:', err);
        await Popup.alert('Не удалось очистить корзину. Попробуйте ещё раз.');
    }
}

/**
 * Считает строку с ценой одной позиции в рублях. Вынесено в отдельную
 * функцию, чтобы JSX-выражение оставалось коротким и однозначно читаемым.
 *
 * @param item Позиция корзины.
 * @returns Цена в рублях, отформатированная без дробной части.
 */
function formatItemPriceRub(item: CartItem): string {
    return `${fromMicros(item.price).toFixed(0)}₽`;
}

/**
 * Функциональный компонент CartWidget. Подписывается на cartStore.items и
 * cartStore.totalCost, рендерит список позиций с кнопками изменения
 * количества и блок футера с переходом к оформлению. Когда корзина пуста,
 * показывает плейсхолдер вместо списка и блокирует кнопку оформления.
 *
 * @param props Пропсы виджета.
 * @returns VNode-дерево виджета корзины.
 */
export function CartWidget(props: CartWidgetProps = {}): VNode {
    const items = useStoreSignal(cartStore, (s) => s.items);
    const totalCost = useStoreSignal(cartStore, (s) => s.totalCost);
    const status = useStoreSignal(cartStore, (s) => s.status);

    const hasItems = computed<boolean>(() => items().length > 0);
    const totalRub = computed<string>(() => `${fromMicros(totalCost()).toFixed(0)}₽`);
    const clearDisabled = computed<boolean>(() => status() === 'syncing');

    /**
     * Обработчик клика по "Оформить заказ": уходит на страницу оформления и,
     * если задан внешний колбэк, дополнительно сообщает наверх.
     */
    const handleCheckout = (): void => {
        void router.go(ROUTES.checkout);
        props.onCheckout?.();
    };

    /**
     * Обработчик ошибки загрузки изображения блюда: подменяет `src` на
     * дефолтную картинку, чтобы в DOM не висела разбитая иконка.
     *
     * @param event Событие error на теге img.
     */
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
                            // Реактивная привязка количества и цены: For не
                            // перевызывает children при изменении полей
                            // (только при смене состава по ключу), поэтому
                            // читаем актуальную позицию через сигнал items на
                            // каждом тике. Если позиция исчезла, держим
                            // последний известный снимок: ушедший элемент
                            // через миг будет размонтирован самим For.
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
