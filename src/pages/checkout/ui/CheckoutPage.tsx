/**
 * Страница оформления заказа.
 *
 * Показывает условия доставки, состав заказа, способ оплаты и итоговую
 * сумму. Состояние выбора (адрес, карта) живёт в локальных сигналах;
 * модалки состава корзины, выбора адреса и способа оплаты управляются
 * сигналами-флагами, а классы `modal-overlay_active` ставятся через
 * реактивные аксессоры. Виджеты AddressPicker и OrderStatusModal
 * монтируются как декларативные дети; страница вызывает их императивные
 * методы (`openMapModal`, `open`) через controller-объекты, полученные
 * по `controllerRef` (`ref` ядро VDOM применяет только к DOM-узлам).
 *
 * Loader. `load()` загружает текущего пользователя (без авторизации
 * редиректит на `/login`), параллельно подгружает адреса, карты и корзину.
 * Пустая корзина приводит к редиректу на `/`. Для UI берётся бренд
 * ресторана из корзины (имя и логотип); неудача запроса бренда не
 * блокирует страницу.
 *
 * Поток оплаты. После клика по "Оплатить" страница проверяет адрес,
 * гарантирует назначение владельцев у всех позиций (в соло-корзине
 * автоматически реассайнит непривязанные на админа), формирует payload и
 * вызывает `orderApi.create`. По успеху открывает модалку статуса заказа,
 * по ошибке выводит сообщение и возвращает кнопку в исходное состояние.
 *
 * Layout: 'root'.
 */

import './checkout.scss';

import { Link, router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { ApiError } from '@shared/api/http';
import { userStore } from '@entities/user';
import { addressStore, type Address } from '@entities/address';
import { cardStore, type Card } from '@entities/card';
import { cartApi, cartStore, fromMicros, toMicros, type CartItem } from '@entities/cart';
import { orderApi, type Order } from '@entities/order';
import { restaurantApi } from '@entities/restaurant';
import { AddressPicker, type AddressPickerController } from '@widgets/address-picker';
import { OrderStatusModal, type OrderStatusModalController } from '@widgets/order-status';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { signal } from '@shared/lib/signals';

/** Фиксированный сбор за доставку (рубли). */
const DELIVERY_FEE_RUB = 360;
/** Фиксированный сервисный сбор (рубли). */
const SERVICE_FEE_RUB = 99;

/**
 * Пропсы страницы оформления заказа, формируемые loader-ом.
 */
export interface CheckoutPageProps {
    /** Позиции корзины, попадающие в заказ. */
    items: CartItem[];
    /** Идентификатор ресторана, к которому привязана корзина. */
    restaurantId: number;
    /** Отображаемое имя ресторана. */
    restaurantName: string;
    /** Ссылка на логотип ресторана. */
    restaurantLogoUrl: string;
    /** Сохранённые адреса пользователя для выбора доставки. */
    addresses: Address[];
    /** Сохранённые карты пользователя для выбора способа оплаты. */
    cards: Card[];
    /** Адрес, выбранный по умолчанию (первый из сохранённых либо null). */
    initialAddress: Address | null;
    /** Карта, выбранная по умолчанию (дефолтная пользователя либо null). */
    initialCard: Card | null;
}

/**
 * Считает сумму позиций корзины в рублях.
 *
 * @param items Список позиций корзины.
 * @returns Сумма цены * количество, переведённая из micros в рубли.
 */
const itemsTotalRub = (items: CartItem[]): number =>
    items.reduce((sum, i) => sum + fromMicros(i.price) * i.quantity, 0);

/**
 * Loader страницы checkout.
 *
 * @returns Промис с пропсами страницы; редирект на `/login` или `/` приводит
 * к Promise.reject, что роутер интерпретирует как error-стейт.
 */
export async function load(): Promise<CheckoutPageProps> {
    try {
        await userStore.loadCurrent();
    } catch (e) {
        console.warn('checkout: loadCurrent failed', e);
    }

    if (!userStore.getState().user) {
        void router.go(ROUTES.login);
        return Promise.reject(new Error('not authenticated'));
    }

    await Promise.allSettled([addressStore.loadSaved(), cardStore.load(), cartStore.load()]);

    const cart = cartStore.getState();
    if (!cart.items.length) {
        void router.go(ROUTES.home);
        return Promise.reject(new Error('cart empty'));
    }

    const addresses = addressStore.getState().saved;
    const cards = cardStore.getState().cards;
    const initialAddress = addresses[0] ?? null;
    const initialCard = cards.find((c) => c.is_default) ?? null;

    let restaurantName = 'Заказ';
    let restaurantLogoUrl = '';
    try {
        const brand = await restaurantApi.getBrand(cart.restaurantId);
        restaurantName = brand.name || restaurantName;
        restaurantLogoUrl = brand.logo_url || '';
    } catch (e) {
        console.warn('checkout: getBrand failed', e);
    }

    return {
        items: cart.items,
        restaurantId: cart.restaurantId,
        restaurantName,
        restaurantLogoUrl,
        addresses,
        cards,
        initialAddress,
        initialCard,
    };
}

/**
 * Функциональный компонент страницы оформления заказа.
 *
 * Хранит выбор пользователя и итоговые суммы в локальных сигналах; модалки
 * управляются сигналами-флагами `cartOpen`/`addressOpen`/`paymentOpen` и
 * включаются добавлением класса `modal-overlay_active` через реактивный
 * аксессор `class`.
 *
 * @param props Пропсы страницы из loader-а.
 * @returns VNode-дерево страницы checkout.
 */
export function CheckoutPage(props: CheckoutPageProps): VNode {
    // Реактивный список позиций: может обновиться, если страница пере-загрузит корзину после реассайна.
    const itemsSig = signal<CartItem[]>(props.items);
    // Реактивный список адресов: обновляется при добавлении нового через AddressPicker.
    const addressesSig = signal<Address[]>(props.addresses);
    // Реактивный список карт: для текущей версии не меняется на странице, но удобнее держать в сигнале для For.
    const cardsSig = signal<Card[]>(props.cards);
    // Текущий выбранный адрес.
    const selectedAddressSig = signal<Address | null>(props.initialAddress);
    // Текущая выбранная карта (null = стандартная новая карта).
    const selectedCardSig = signal<Card | null>(props.initialCard);
    // Текст ошибки оформления: пустая строка значит "ошибки нет".
    const errorSig = signal<string>('');
    // Статус кнопки оплаты: блокируется во время запроса.
    const payProcessingSig = signal<boolean>(false);

    // Флаги открытости модалок.
    const cartOpenSig = signal<boolean>(false);
    const addressOpenSig = signal<boolean>(false);
    const paymentOpenSig = signal<boolean>(false);

    // Контроллеры дочерних виджетов: устанавливаются через ref-колбэк.
    let pickerCtl: AddressPickerController | null = null;
    let orderStatusCtl: OrderStatusModalController | null = null;

    /**
     * Считает форматированные итоговые суммы по текущим позициям.
     *
     * @returns Объект с отформатированными строками для шаблона.
     */
    const computeTotals = (): {
        cartItemsTotal: string;
        deliveryFee: string;
        serviceFee: string;
        grandTotal: string;
        hasItems: boolean;
    } => {
        const cartTotal = itemsTotalRub(itemsSig());
        const grand = cartTotal > 0 ? cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB : 0;
        return {
            cartItemsTotal: cartTotal.toFixed(2),
            deliveryFee: DELIVERY_FEE_RUB.toFixed(2),
            serviceFee: SERVICE_FEE_RUB.toFixed(2),
            grandTotal: grand.toFixed(2),
            hasItems: cartTotal > 0,
        };
    };

    /**
     * Возвращает CSS-класс модального оверлея с учётом флага открытости.
     *
     * @param baseClass Базовый класс оверлея.
     * @param openSig Сигнал-флаг "модалка открыта".
     * @returns Аксессор класса для реактивного пропа.
     */
    const overlayClass = (baseClass: string, openSig: () => boolean): (() => string) =>
        (): string => (openSig() ? `${baseClass} modal-overlay_active` : baseClass);

    /**
     * Обработчик клика по строке выбора адреса.
     *
     * @param addr Выбранный адрес.
     */
    const handleSelectAddress = (addr: Address): void => {
        selectedAddressSig.set(addr);
    };

    /**
     * Обработчик клика по карте либо по записи "стандартная оплата".
     *
     * @param card Выбранная карта или null для стандартной оплаты.
     */
    const handleSelectCard = (card: Card | null): void => {
        selectedCardSig.set(card);
    };

    /**
     * Обработчик клика по кнопке "Добавить новый адрес": закрывает модалку
     * выбора адреса и через паузу 100мс открывает модалку карты в AddressPicker.
     */
    const handleAddNewAddress = (): void => {
        addressOpenSig.set(false);
        setTimeout(() => {
            void pickerCtl?.openMapModal();
        }, 100);
    };

    /**
     * Обработчик выбора адреса в AddressPicker: подменяет адреса в сигнале и
     * проставляет первый из обновлённого списка как текущий выбранный.
     * Аргументы виджета (text, coords) странице не нужны: актуальный список
     * адресов читается напрямую из addressStore.
     */
    const handlePickerSelect = (): void => {
        const fresh = addressStore.getState().saved;
        addressesSig.set(fresh);
        if (fresh.length > 0) {
            selectedAddressSig.set(fresh[0]);
        }
    };

    /**
     * Гарантирует, что у всех позиций корзины назначен владелец-плательщик.
     *
     * @returns Список готовых к оплате позиций либо null при невозможности.
     */
    const ensureAssignedItems = async (): Promise<CartItem[] | null> => {
        const cart = cartStore.getState();
        const unassignedItems = cart.items.filter((item) => item.owner_user_id == null);

        if (!unassignedItems.length) {
            return cart.items;
        }

        if (cart.mode === 'solo' && cart.cartId && cart.adminId !== null) {
            try {
                await Promise.all(
                    unassignedItems.map((item) =>
                        cartApi.reassignOwner(
                            cart.cartId as string,
                            item.dish_id,
                            cart.adminId as number,
                        ),
                    ),
                );

                await cartStore.load();
                const freshCart = cartStore.getState();
                itemsSig.set(freshCart.items);

                if (freshCart.items.some((item) => item.owner_user_id == null)) {
                    errorSig.set('В корзине остались позиции без владельца. Проверьте корзину.');
                    return null;
                }
                return freshCart.items;
            } catch (e) {
                console.error('checkout: auto-assign failed', e);
                errorSig.set('Не удалось подготовить корзину к оплате. Попробуйте ещё раз.');
                return null;
            }
        }

        errorSig.set(
            'В корзине есть позиции без плательщика. Назначьте владельца товарам перед оплатой.',
        );
        return null;
    };

    /**
     * Основной обработчик кнопки "Оплатить".
     */
    const handlePayClick = async (): Promise<void> => {
        errorSig.set('');

        const address = selectedAddressSig.peek();
        if (!address) {
            errorSig.set('Пожалуйста, выберите адрес доставки');
            return;
        }
        if (!props.restaurantId) {
            errorSig.set('Ошибка корзины. Попробуйте перезагрузить страницу.');
            return;
        }

        const assignedItems = await ensureAssignedItems();
        if (!assignedItems) return;

        const cartTotal = itemsTotalRub(assignedItems);
        if (cartTotal <= 0) return;

        const grand = cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB;

        payProcessingSig.set(true);

        const idempotencyKey = crypto.randomUUID();
        const currentCart = cartStore.getState();
        const card = selectedCardSig.peek();

        try {
            const result = await orderApi.create(
                {
                    address_id: address.id,
                    branch_id: currentCart.restaurantId,
                    brand_id: currentCart.restaurantId,
                    payment_method_id: card?.id ?? '',
                    delivery_cost: toMicros(DELIVERY_FEE_RUB),
                    service_fee: toMicros(SERVICE_FEE_RUB),
                    total_cost: toMicros(grand),
                    pay_for_all: true,
                },
                idempotencyKey,
            );

            const orderSnapshot: Order = {
                order_id: result.order_id,
                status: 'created',
                total_cost: toMicros(grand),
                created_at: new Date().toLocaleDateString('ru-RU'),
                restaurant_id: currentCart.restaurantId,
                restaurant_name: props.restaurantName,
                restaurant_image_url: props.restaurantLogoUrl,
                items: assignedItems.map((i) => ({
                    dish_id: i.dish_id,
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                    image_url: i.image_url,
                })),
                service_fee: toMicros(SERVICE_FEE_RUB),
                delivery_cost: toMicros(DELIVERY_FEE_RUB),
            };

            await cartStore.clear();

            if (orderStatusCtl) {
                orderStatusCtl.open(orderSnapshot, {
                    subscribe: true,
                    onClose: () => {
                        void router.go(ROUTES.home);
                    },
                });
            } else {
                void router.go(ROUTES.profile);
            }
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Ошибка соединения с сервером';
            errorSig.set(msg || 'Произошла ошибка при оформлении заказа');
            payProcessingSig.set(false);
        }
    };

    return (
        <div
            class="page-wrapper checkout-page"
            style="background: var(--bg-main); overflow-y: auto;"
        >
            <header class="checkout-header">
                <div class="checkout-header__container">
                    <Link
                        class="checkout-header__back router-link"
                        to={ROUTES.home}
                        style="text-decoration: none;"
                    >
                        <div class="back-icon-arrow" />
                        <span>Назад</span>
                    </Link>
                </div>
            </header>

            <div class="checkout-content">
                <main class="checkout-main">
                    <h1 class="checkout-title">Оформление заказа</h1>

                    <div class="checkout-card">
                        <div class="checkout-card__header">
                            <h2 class="checkout-card__title">Условия доставки</h2>
                        </div>
                        <Show
                            when={(): boolean => selectedAddressSig() !== null}
                            fallback={
                                <div class="checkout-warning">
                                    ⚠️ Необходимо добавить или выбрать адрес доставки
                                    <button
                                        class="button button_primary mt-10"
                                        style="height: 40px; width: 200px;"
                                        onClick={(): void => addressOpenSig.set(true)}
                                    >
                                        Выбрать адрес
                                    </button>
                                </div>
                            }
                        >
                            <div class="address-display">
                                <div class="address-display__icon">🏠</div>
                                <div class="address-display__text">
                                    {(): string => {
                                        const a = selectedAddressSig();
                                        if (!a) return '';
                                        const base = a.location.address_text;
                                        return a.apartment ? `${base}, кв. ${a.apartment}` : base;
                                    }}
                                </div>
                                <button
                                    class="button button_ghost"
                                    style="height: 30px; margin: 0; padding: 0 10px;"
                                    onClick={(): void => addressOpenSig.set(true)}
                                >
                                    Изменить
                                </button>
                            </div>
                        </Show>
                    </div>

                    <div class="checkout-card mt-20">
                        <h2 class="checkout-card__title">Время доставки</h2>
                        <div class="time-display">⏱️ 45-55 минут</div>
                        <button
                            class="button button_secondary mt-20"
                            style="width: 100%;"
                            onClick={(): void => cartOpenSig.set(true)}
                        >
                            Посмотреть состав заказа
                        </button>
                    </div>
                </main>

                <aside class="checkout-sidebar">
                    <div class="checkout-card">
                        <div class="checkout-card__header">
                            <h2 class="checkout-card__title">Способ оплаты</h2>
                        </div>
                        <div class="payment-display">
                            <div class="payment-display__icon">💳</div>
                            <div class="payment-display__text">
                                {(): string => {
                                    const c = selectedCardSig();
                                    return c ? `**${c.last4}` : 'Стандартная оплата (новая карта)';
                                }}
                            </div>
                            <button
                                class="button button_ghost"
                                style="height: 30px; margin: 0; padding: 0 10px;"
                                onClick={(): void => paymentOpenSig.set(true)}
                            >
                                Изменить
                            </button>
                        </div>
                    </div>

                    <div class="checkout-card mt-20">
                        <h2 class="checkout-card__title">Что в цене</h2>
                        <div class="summary-row">
                            <span>Товары в заказе</span>
                            <span>{(): string => `${computeTotals().cartItemsTotal} ₽`}</span>
                        </div>
                        <div class="summary-row">
                            <span>Доставка</span>
                            <span>{(): string => `${computeTotals().deliveryFee} ₽`}</span>
                        </div>
                        <div class="summary-row">
                            <span>Сервисный сбор</span>
                            <span>{(): string => `${computeTotals().serviceFee} ₽`}</span>
                        </div>

                        <div class="checkout-total-row mt-20">
                            <button
                                class="button button_primary"
                                style="width: auto; padding: 0 40px; margin: 0;"
                                disabled={(): boolean => {
                                    if (payProcessingSig()) return true;
                                    if (selectedAddressSig() === null) return true;
                                    return !computeTotals().hasItems;
                                }}
                                onClick={(): void => {
                                    void handlePayClick();
                                }}
                            >
                                {(): string => (payProcessingSig() ? 'Оформляем...' : 'Оплатить')}
                            </button>
                            <div class="checkout-total-price">
                                {(): string => `${computeTotals().grandTotal} ₽`}
                            </div>
                        </div>
                        <div
                            class="error-msg"
                            style="text-align: right; margin-top: 5px;"
                        >
                            {errorSig}
                        </div>
                    </div>
                </aside>
            </div>

            <div class={overlayClass('modal-overlay', cartOpenSig)}>
                <div class="checkout-modal">
                    <div
                        class="checkout-modal__close"
                        onClick={(): void => cartOpenSig.set(false)}
                    >
                        &times;
                    </div>
                    <h2 class="checkout-modal__title">Состав заказа</h2>
                    <div class="checkout-modal__content" style="max-height: 400px; overflow-y: auto;">
                        <Show
                            when={(): boolean => itemsSig().length > 0}
                            fallback={<p>Корзина пуста</p>}
                        >
                            <For each={itemsSig} key={(i): string | number => i.dish_id}>
                                {(item): VNode => (
                                    <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                        <img
                                            src={item.image_url}
                                            style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover; margin-right: 15px;"
                                            onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'"
                                        />
                                        <div style="flex: 1;">
                                            <div style="font-weight: 500; font-size: 14px;">
                                                {item.name}
                                            </div>
                                            <div style="color: #777; font-size: 12px;">
                                                {`${item.quantity} шт. x ${(item.price / 1_000_000).toFixed(2)} ₽`}
                                            </div>
                                        </div>
                                        <div style="font-weight: 700;">
                                            {`${((item.price * item.quantity) / 1_000_000).toFixed(2)} ₽`}
                                        </div>
                                    </div>
                                )}
                            </For>
                        </Show>
                    </div>
                </div>
            </div>

            <div class={overlayClass('modal-overlay', addressOpenSig)}>
                <div class="checkout-modal" style="width: 500px;">
                    <div
                        class="checkout-modal__close"
                        onClick={(): void => addressOpenSig.set(false)}
                    >
                        &times;
                    </div>
                    <h2 class="checkout-modal__title">Выберите адрес</h2>
                    <div class="checkout-modal__content">
                        <div class="selection-list">
                            <Show
                                when={(): boolean => addressesSig().length > 0}
                                fallback={<p class="empty-text">У вас нет сохраненных адресов.</p>}
                            >
                                <For each={addressesSig} key={(a): string => a.id}>
                                    {(addr): VNode => (
                                        <div
                                            class={(): string => {
                                                const isActive =
                                                    selectedAddressSig()?.id === addr.id;
                                                return isActive
                                                    ? 'selection-item selection-item_active'
                                                    : 'selection-item';
                                            }}
                                            data-id={addr.id}
                                            onClick={(): void => handleSelectAddress(addr)}
                                        >
                                            <div style="font-weight: 600;">
                                                {addr.location.address_text}
                                            </div>
                                            <div style="font-size: 12px; color: #777;">
                                                {`Кв. ${addr.apartment || '-'}, эт. ${addr.floor || '-'}`}
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </div>
                        <button
                            class="button button_primary mt-20"
                            onClick={handleAddNewAddress}
                        >
                            Добавить новый адрес (Карта)
                        </button>
                    </div>
                </div>
            </div>

            <div class={overlayClass('modal-overlay', paymentOpenSig)}>
                <div class="checkout-modal" style="width: 400px;">
                    <div
                        class="checkout-modal__close"
                        onClick={(): void => paymentOpenSig.set(false)}
                    >
                        &times;
                    </div>
                    <h2 class="checkout-modal__title">Способ оплаты</h2>
                    <div class="checkout-modal__content">
                        <div class="selection-list">
                            <div
                                class={(): string => {
                                    const noCard = selectedCardSig() === null;
                                    return noCard
                                        ? 'selection-item selection-item_active'
                                        : 'selection-item';
                                }}
                                data-id=""
                                onClick={(): void => handleSelectCard(null)}
                            >
                                <div style="font-weight: 600;">💳 Стандартная оплата</div>
                                <div style="font-size: 12px; color: #777;">
                                    Ввести реквизиты новой карты
                                </div>
                            </div>
                            <For each={cardsSig} key={(c): string => c.id}>
                                {(card): VNode => (
                                    <div
                                        class={(): string => {
                                            const isActive = selectedCardSig()?.id === card.id;
                                            return isActive
                                                ? 'selection-item selection-item_active'
                                                : 'selection-item';
                                        }}
                                        data-id={card.id}
                                        onClick={(): void => handleSelectCard(card)}
                                    >
                                        <div style="font-weight: 600;">{`💳 **${card.last4}`}</div>
                                        <div style="font-size: 12px; color: #777;">
                                            {card.card_type ?? ''}
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </div>

            <AddressPicker
                hideInput
                skipDetails={false}
                onSelect={handlePickerSelect}
                controllerRef={(ctl: AddressPickerController | null): void => {
                    pickerCtl = ctl;
                }}
            />
            <OrderStatusModal
                controllerRef={(ctl: OrderStatusModalController | null): void => {
                    orderStatusCtl = ctl;
                }}
            />
        </div>
    ) as VNode;
}
