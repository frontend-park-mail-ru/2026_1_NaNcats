// Страница оформления заказа. Layout: 'root'.

import './checkout.scss';

import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { ApiError } from '@shared/api/http';
import { userStore } from '@entities/user';
import { addressStore, type Address } from '@entities/address';
import { cardStore, type Card } from '@entities/card';
import { cartApi, cartStore, fromMicros, toMicros, type CartItem } from '@entities/cart';
import { orderApi, type Order } from '@entities/order';
import { restaurantApi } from '@entities/restaurant';
import { imageFallback } from '@shared/lib/img';
import { AddressPicker, type AddressPickerController } from '@widgets/address-picker';
import { OrderStatusModal, type OrderStatusModalController } from '@widgets/order-status';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { signal, useStoreSignal } from '@shared/lib/signals';
import { applyPromo, removeAppliedPromo, appliedCodeAccessor, loadPromos } from '@features/profile/manage-promos';
import { httpClient } from '@shared/api/http/HttpClient';

/** Фиксированный сбор за доставку (рубли). */
const DELIVERY_FEE_RUB = 360;
/** Фиксированный сервисный сбор (рубли). */
const SERVICE_FEE_RUB = 99;

export interface CheckoutPageProps {
    /** Позиции корзины, попадающие в заказ. */
    items: CartItem[];
    /** Идентификатор ресторана, к которому привязана корзина. */
    restaurantId: number;
    /** Отображаемое имя ресторана. */
    restaurantName: string;
    /** Ссылка на логотип ресторана. */
    restaurantLogoUrl: string;
    /** Сохранённые адреса пользователя. */
    addresses: Address[];
    /** Сохранённые карты пользователя. */
    cards: Card[];
    /** Адрес по умолчанию (первый из сохранённых либо null). */
    initialAddress: Address | null;
    /** Карта по умолчанию (дефолтная пользователя либо null). */
    initialCard: Card | null;
}

/** Сумма позиций корзины в рублях. */
const itemsTotalRub = (items: CartItem[]): number =>
    items.reduce((sum, i) => sum + fromMicros(i.price) * i.quantity, 0);

/** Loader: грузит пользователя, адреса, карты, корзину; редиректит при отсутствии авторизации или пустой корзине. */
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

export function CheckoutPage(props: CheckoutPageProps): VNode {
    const itemsSig = signal<CartItem[]>(props.items);
    const addressesSig = signal<Address[]>(props.addresses);
    const cardsSig = signal<Card[]>(props.cards);
    const selectedAddressSig = signal<Address | null>(props.initialAddress);
    // null = стандартная новая карта.
    const selectedCardSig = signal<Card | null>(props.initialCard);
    // Пустая строка значит "ошибки нет".
    const errorSig = signal<string>('');
    const payProcessingSig = signal<boolean>(false);
    const promoInputSig = signal<string>('');
    const promoErrorSig = signal<string>('');
    let promoInputEl: HTMLInputElement | null = null;

    const addressOpenSig = signal<boolean>(false);
    const paymentOpenSig = signal<boolean>(false);

    // Совместная корзина: способ оплаты заказа. true - админ платит за всех,
    // false - бэкенд делит счёт на доли по владельцам позиций.
    const isSharedCartSig = useStoreSignal(cartStore, (s) => s.mode === 'shared');
    const payForAllSig = signal<boolean>(true);

    let pickerCtl: AddressPickerController | null = null;
    let orderStatusCtl: OrderStatusModalController | null = null;

    /** Скидка промокода в рублях (заполняется через API validate). */
    const promoDiscount = signal<number>(0);

    /** Переводит reason из бэкенда в читаемое сообщение. */
    const promoReasonToMessage = (reason: string): string => {
        const map: Record<string, string> = {
            'promo already used': 'Промокод уже был использован',
            'promo has expired': 'Срок действия промокода истёк',
            'order amount is below minimum': 'Сумма заказа ниже минимальной для этого промокода',
            'max uses reached': 'Промокод исчерпал лимит использований',
            'promo is not valid for this restaurant': 'Промокод не действует в этом ресторане',
            'promo not found': 'Промокод не найден',
            'promo is tied to another user': 'Промокод предназначен другому пользователю',
        };
        return map[reason] ?? 'Промокод недействителен';
    };

    /** Запрашивает скидку у бэкенда при наличии промокода. */
    const refreshPromoDiscount = async () => {
        const code = appliedCodeAccessor();
        if (!code) {
            promoDiscount.set(0);
            return;
        }
        try {
            const resp = await httpClient.post('/promos/validate', {
                code,
                restaurant_brand_id: props.restaurantId ?? 0,
                order_amount: toMicros(itemsTotalRub(itemsSig())),
                delivery_cost: toMicros(DELIVERY_FEE_RUB),
                service_fee: toMicros(SERVICE_FEE_RUB),
            });
            if (!resp.ok) {
                // Промокод не прошёл проверку — снимаем и сообщаем пользователю.
                removeAppliedPromo();
                promoDiscount.set(0);
                promoErrorSig.set('Промокод недействителен');
                return;
            }
            const data = await resp.json();
            if (data.valid) {
                promoDiscount.set(Math.round(data.discount / 1_000_000));
            } else {
                removeAppliedPromo();
                promoDiscount.set(0);
                promoErrorSig.set(promoReasonToMessage(data.reason ?? ''));
            }
        } catch {
            promoDiscount.set(0);
        }
    };

    // Запросить скидку при загрузке.
    void refreshPromoDiscount();

    /** Форматированные итоговые суммы по текущим позициям. */
    const computeTotals = () => {
        const cartTotal = itemsTotalRub(itemsSig());
        const discount = promoDiscount();
        const grand = cartTotal > 0 ? Math.max(0, cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB - discount) : 0;
        return {
            cartItemsTotal: cartTotal.toFixed(2),
            deliveryFee: DELIVERY_FEE_RUB.toFixed(2),
            serviceFee: SERVICE_FEE_RUB.toFixed(2),
            discount,
            grandTotal: grand.toFixed(2),
            hasItems: cartTotal > 0,
        };
    };

    const overlayClass = (baseClass: string, openSig: () => boolean) => () =>
        openSig() ? `${baseClass} modal-overlay_active` : baseClass;

    const handleSelectAddress = (addr: Address) => {
        selectedAddressSig.set(addr);
    };

    const handleSelectCard = (card: Card | null) => {
        selectedCardSig.set(card);
    };

    // Закрывает модалку выбора адреса и через паузу открывает модалку карты в AddressPicker.
    const handleAddNewAddress = () => {
        addressOpenSig.set(false);
        setTimeout(() => {
            void pickerCtl?.openMapModal();
        }, 100);
    };

    // Актуальный список адресов читаем напрямую из addressStore.
    const handlePickerSelect = () => {
        const fresh = addressStore.getState().saved;
        addressesSig.set(fresh);
        if (fresh.length > 0) {
            selectedAddressSig.set(fresh[0]);
        }
    };

    // Гарантирует, что у всех позиций корзины назначен владелец-плательщик; null если не получилось.
    const ensureAssignedItems = async () => {
        const cart = cartStore.getState();

        // В solo-корзине владелец каждой позиции — сам пользователь, назначать
        // некого. Ничейные позиции возможны только в shared-корзине (например,
        // блюда, оставшиеся после кика гостя), поэтому проверку делаем лишь там.
        if (cart.mode !== 'shared') {
            return cart.items;
        }

        const unassignedItems = cart.items.filter((item) => item.owner_public_id == null);

        if (!unassignedItems.length) {
            return cart.items;
        }

        // Переназначить ничейные позиции (например, оставшиеся после кика
        // гостя) на себя может только организатор корзины.
        const me = userStore.getState().user;
        const isAdmin = me !== null && cart.adminId !== null && me.public_id === cart.adminId;

        if (isAdmin && cart.cartId && cart.adminId !== null) {
            try {
                await Promise.all(
                    unassignedItems.map((item) =>
                        cartApi.reassignOwner(cart.cartId as string, item.dish_id, cart.adminId as string),
                    ),
                );

                await cartStore.load();
                const freshCart = cartStore.getState();
                itemsSig.set(freshCart.items);

                if (freshCart.items.some((item) => item.owner_public_id == null)) {
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

        errorSig.set('В корзине есть позиции без плательщика. Назначьте владельца товарам перед оплатой.');
        return null;
    };

    const handlePayClick = async () => {
        errorSig.set('');

        // В совместной корзине заказ оформляет только организатор: бэкенд
        // блокирует корзину от имени админа, гостю запрос вернёт 403.
        const cartState = cartStore.getState();
        const me = userStore.getState().user;
        if (cartState.mode === 'shared' && (me === null || me.public_id !== cartState.adminId)) {
            errorSig.set('Оформить заказ может только организатор совместной корзины.');
            return;
        }

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

        const grand = Math.max(0, cartTotal + DELIVERY_FEE_RUB + SERVICE_FEE_RUB - promoDiscount());

        payProcessingSig.set(true);

        const idempotencyKey = crypto.randomUUID();
        const currentCart = cartStore.getState();
        const card = selectedCardSig.peek();

        try {
            // Для соло-корзины разделение счёта не имеет смысла: всегда pay_for_all.
            const payForAll = currentCart.mode === 'shared' ? payForAllSig.peek() : true;

            const result = await orderApi.create(
                {
                    address_id: address.id,
                    branch_id: currentCart.restaurantId,
                    brand_id: currentCart.restaurantId,
                    payment_method_id: card?.id ?? '',
                    delivery_cost: toMicros(DELIVERY_FEE_RUB),
                    service_fee: toMicros(SERVICE_FEE_RUB),
                    total_cost: toMicros(grand),
                    pay_for_all: payForAll,
                    promocode: appliedCodeAccessor() || undefined,
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

            if (appliedCodeAccessor()) {
                removeAppliedPromo();
                void loadPromos();
            }

            // В snapshot нет долей счёта, а для совместного заказа модалке
            // нужна секция «Разделение счёта» с кнопкой оплаты. Подтягиваем
            // только что созданный заказ из истории и берём из него splits.
            let modalOrder: Order = orderSnapshot;
            try {
                const created = (await orderApi.list()).find((o) => o.order_id === result.order_id);
                if (created) {
                    modalOrder = { ...orderSnapshot, splits: created.splits };
                }
            } catch (e) {
                console.warn('checkout: не удалось загрузить доли счёта заказа', e);
            }

            if (orderStatusCtl) {
                orderStatusCtl.open(modalOrder, {
                    subscribe: true,
                    onClose: () => {
                        // replace, а не go: страница оформления уходит из
                        // history, кнопка «назад» не вернёт на checkout.
                        void router.replace(ROUTES.profile);
                    },
                });
            } else {
                void router.replace(ROUTES.profile);
            }
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Ошибка соединения с сервером';
            errorSig.set(msg || 'Произошла ошибка при оформлении заказа');
            payProcessingSig.set(false);
        }
    };

    return (
        <div class="page-wrapper checkout-page" style="background: var(--bg-main); overflow-y: auto;">
            {/* Свой хедер не рендерим: глобальный Header из RootLayout уже
                показывает логотип и кнопку «Назад» (mode='back'). */}

            <div class="checkout-wrapper">
                <h1 class="checkout-title">Оформление заказа</h1>

                <div class="checkout-content">
                    <main class="checkout-main">
                        <div class="checkout-card">
                            <div class="checkout-card__header">
                                <h2 class="checkout-card__title">Адрес доставки</h2>
                            </div>
                            <Show
                                when={() => selectedAddressSig() !== null}
                                fallback={
                                    <div class="checkout-warning">
                                        ⚠️ Необходимо добавить или выбрать адрес доставки
                                        <button
                                            class="button button_primary mt-10"
                                            style="height: 40px; width: 200px;"
                                            onClick={() => addressOpenSig.set(true)}
                                        >
                                            Выбрать адрес
                                        </button>
                                    </div>
                                }
                            >
                                <div class="address-display">
                                    <div class="address-display__icon">🏠</div>
                                    <div class="address-display__text">
                                        {() => {
                                            const a = selectedAddressSig();
                                            if (!a) return '';
                                            const base = a.location.address_text;
                                            return a.apartment ? `${base}, кв. ${a.apartment}` : base;
                                        }}
                                    </div>
                                    <button
                                        class="button button_ghost"
                                        style="height: 30px; margin: 0; padding: 0 10px;"
                                        onClick={() => addressOpenSig.set(true)}
                                    >
                                        Изменить
                                    </button>
                                </div>
                            </Show>
                        </div>

                        <div class="checkout-card mt-20">
                            <h2 class="checkout-card__title">Время доставки</h2>
                            <div class="time-display">⏱️ 45-55 минут</div>
                        </div>

                        {(() => {
                            const canScrollDown = signal(false);
                            // Скролл-контейнер держим через ref, без завязки на глобальный id.
                            let scrollEl: HTMLElement | null = null;
                            const updateHint = () => {
                                if (!scrollEl) return;
                                canScrollDown.set(
                                    scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - 1,
                                );
                            };
                            return (
                                <div class="checkout-card mt-20 checkout-card_items">
                                    <h2 class="checkout-card__title">Состав заказа</h2>
                                    <div
                                        class="checkout-items-list"
                                        ref={(el: Element | null) => {
                                            scrollEl = el as HTMLElement | null;
                                            if (scrollEl) {
                                                scrollEl.addEventListener('scroll', updateHint);
                                                requestAnimationFrame(updateHint);
                                            }
                                        }}
                                    >
                                        <For each={itemsSig} key={(i) => `${i.dish_id}:${i.owner_public_id ?? ''}`}>
                                            {(item) => (
                                                <div class="checkout-item-row">
                                                    <img
                                                        class="checkout-item-row__img"
                                                        src={item.image_url}
                                                        onError={imageFallback(
                                                            'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp',
                                                        )}
                                                    />
                                                    <div class="checkout-item-row__info">
                                                        <div class="checkout-item-row__name">{item.name}</div>
                                                        <div class="checkout-item-row__qty">
                                                            {`${item.quantity} шт. × ${fromMicros(item.price).toFixed(0)} ₽`}
                                                        </div>
                                                    </div>
                                                    <div class="checkout-item-row__total">
                                                        {`${(fromMicros(item.price) * item.quantity).toFixed(0)} ₽`}
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                    <Show when={canScrollDown}>
                                        <div
                                            class="checkout-items-scroll-hint"
                                            onClick={() => {
                                                if (scrollEl) scrollEl.scrollBy({ top: 80, behavior: 'smooth' });
                                            }}
                                        >
                                            ▼
                                        </div>
                                    </Show>
                                </div>
                            );
                        })()}

                        <Show when={isSharedCartSig}>
                            <div class="checkout-card mt-20">
                                <h2 class="checkout-card__title">Кто оплачивает</h2>
                                <div class="selection-list mt-10">
                                    <div
                                        class={() =>
                                            payForAllSig() ? 'selection-item selection-item_active' : 'selection-item'
                                        }
                                        onClick={() => payForAllSig.set(true)}
                                    >
                                        <div style="font-weight: 600;">💰 Я оплачу весь заказ</div>
                                        <div style="font-size: 12px; color: #777;">
                                            Полная сумма спишется с вашей карты.
                                        </div>
                                    </div>
                                    <div
                                        class={() =>
                                            payForAllSig() ? 'selection-item' : 'selection-item selection-item_active'
                                        }
                                        onClick={() => payForAllSig.set(false)}
                                    >
                                        <div style="font-weight: 600;">🧾 Каждый платит за свои блюда</div>
                                        <div style="font-size: 12px; color: #777;">
                                            Счёт разделится по участникам, каждый оплатит свою часть в истории заказов.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </main>

                    <aside class="checkout-sidebar">
                        <div class="checkout-card">
                            <div class="checkout-card__header">
                                <h2 class="checkout-card__title">Способ оплаты</h2>
                            </div>
                            <div class="payment-display">
                                <div class="payment-display__icon">💳</div>
                                <div class="payment-display__text">
                                    {() => {
                                        const c = selectedCardSig();
                                        return c ? `**${c.last4}` : 'Стандартная оплата (новая карта)';
                                    }}
                                </div>
                                <button
                                    class="button button_ghost"
                                    style="height: 30px; margin: 0; padding: 0 10px;"
                                    onClick={() => paymentOpenSig.set(true)}
                                >
                                    Изменить
                                </button>
                            </div>
                        </div>

                        <div class="checkout-card mt-20">
                            <h2 class="checkout-card__title">Промокод</h2>
                            <Show
                                when={() => appliedCodeAccessor() !== ''}
                                fallback={
                                    <>
                                        <div class="checkout-promo__row">
                                            <input
                                                type="text"
                                                class="checkout-promo__input"
                                                placeholder="Введите промокод"
                                                autocomplete="off"
                                                ref={(el: Element | null) => {
                                                    promoInputEl = el as HTMLInputElement | null;
                                                }}
                                                onInput={(e: Event) => {
                                                    promoInputSig.set((e.target as HTMLInputElement).value);
                                                }}
                                            />
                                            <button
                                                type="button"
                                                class="checkout-promo__btn"
                                                disabled={() => promoInputSig().trim() === ''}
                                                onClick={async () => {
                                                    const code = promoInputSig.peek().trim();
                                                    if (!code) return;
                                                    promoErrorSig.set('');
                                                    try {
                                                        const resp = await httpClient.post('/promos/validate', {
                                                            code: code.toUpperCase(),
                                                            restaurant_brand_id: props.restaurantId ?? 0,
                                                            order_amount: toMicros(itemsTotalRub(itemsSig())),
                                                            delivery_cost: toMicros(DELIVERY_FEE_RUB),
                                                            service_fee: toMicros(SERVICE_FEE_RUB),
                                                        });
                                                        if (!resp.ok) {
                                                            promoErrorSig.set('Промокод не найден');
                                                            return;
                                                        }
                                                        const data = await resp.json();
                                                        if (!data.valid) {
                                                            promoErrorSig.set(
                                                                data.reason === 'promo not found'
                                                                    ? 'Промокод не найден'
                                                                    : 'Промокод недействителен',
                                                            );
                                                            return;
                                                        }
                                                        applyPromo(code);
                                                        promoInputSig.set('');
                                                        if (promoInputEl) promoInputEl.value = '';
                                                        promoDiscount.set(Math.round(data.discount / 1_000_000));
                                                    } catch {
                                                        promoErrorSig.set('Ошибка проверки промокода');
                                                    }
                                                }}
                                            >
                                                Применить
                                            </button>
                                        </div>
                                        <Show when={() => promoErrorSig() !== ''}>
                                            <div class="error-msg" style="margin-top: 6px; font-size: 12px;">
                                                {promoErrorSig}
                                            </div>
                                        </Show>
                                    </>
                                }
                            >
                                <div class="checkout-promo__applied">
                                    <span class="checkout-promo__badge">🏷️ {appliedCodeAccessor}</span>
                                    <div class="checkout-promo__actions">
                                        <button
                                            type="button"
                                            class="button button_ghost"
                                            style="height: 30px; margin: 0; padding: 0 10px; font-size: 12px;"
                                            onClick={() => {
                                                removeAppliedPromo();
                                                promoDiscount.set(0);
                                            }}
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        <div class="checkout-card mt-20">
                            <h2 class="checkout-card__title">Что в цене</h2>
                            <div class="summary-row">
                                <span>Товары в заказе</span>
                                <span>{() => `${computeTotals().cartItemsTotal} ₽`}</span>
                            </div>
                            <div class="summary-row">
                                <span>Доставка</span>
                                <span>{() => `${computeTotals().deliveryFee} ₽`}</span>
                            </div>
                            <div class="summary-row">
                                <span>Сервисный сбор</span>
                                <span>{() => `${computeTotals().serviceFee} ₽`}</span>
                            </div>
                            <Show when={() => computeTotals().discount > 0}>
                                <div class="summary-row summary-row_discount">
                                    <span>Скидка по промокоду</span>
                                    <span>{() => `−${computeTotals().discount.toFixed(2)} ₽`}</span>
                                </div>
                            </Show>

                            <div class="checkout-total-row mt-20">
                                <button
                                    class="button button_primary"
                                    style="width: auto; padding: 0 40px; margin: 0;"
                                    disabled={() => {
                                        if (payProcessingSig()) return true;
                                        if (selectedAddressSig() === null) return true;
                                        return !computeTotals().hasItems;
                                    }}
                                    onClick={() => {
                                        void handlePayClick();
                                    }}
                                >
                                    {() => (payProcessingSig() ? 'Оформляем...' : 'Оплатить')}
                                </button>
                                <div class="checkout-total-price">{() => `${computeTotals().grandTotal} ₽`}</div>
                            </div>
                            <div class="error-msg" style="text-align: right; margin-top: 5px;">
                                {errorSig}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            <div class={overlayClass('modal-overlay', addressOpenSig)}>
                <div class="checkout-modal" style="width: 500px;">
                    <div class="checkout-modal__close" onClick={() => addressOpenSig.set(false)}>
                        &times;
                    </div>
                    <h2 class="checkout-modal__title">Выберите адрес</h2>
                    <div class="checkout-modal__content">
                        <div class="selection-list">
                            <Show
                                when={() => addressesSig().length > 0}
                                fallback={<p class="empty-text">У вас нет сохраненных адресов.</p>}
                            >
                                <For each={addressesSig} key={(a) => a.id}>
                                    {(addr) => (
                                        <div
                                            class={() => {
                                                const isActive = selectedAddressSig()?.id === addr.id;
                                                return isActive
                                                    ? 'selection-item selection-item_active'
                                                    : 'selection-item';
                                            }}
                                            data-id={addr.id}
                                            onClick={() => handleSelectAddress(addr)}
                                        >
                                            <div style="font-weight: 600;">{addr.location.address_text}</div>
                                            <div style="font-size: 12px; color: #777;">
                                                {`Кв. ${addr.apartment || '-'}, эт. ${addr.floor || '-'}`}
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </div>
                        <button class="button button_primary mt-20" onClick={handleAddNewAddress}>
                            Добавить новый адрес (Карта)
                        </button>
                    </div>
                </div>
            </div>

            <div class={overlayClass('modal-overlay', paymentOpenSig)}>
                <div class="checkout-modal" style="width: 400px;">
                    <div class="checkout-modal__close" onClick={() => paymentOpenSig.set(false)}>
                        &times;
                    </div>
                    <h2 class="checkout-modal__title">Способ оплаты</h2>
                    <div class="checkout-modal__content">
                        <div class="selection-list">
                            <div
                                class={() => {
                                    const noCard = selectedCardSig() === null;
                                    return noCard ? 'selection-item selection-item_active' : 'selection-item';
                                }}
                                data-id=""
                                onClick={() => handleSelectCard(null)}
                            >
                                <div style="font-weight: 600;">💳 Стандартная оплата</div>
                                <div style="font-size: 12px; color: #777;">Ввести реквизиты новой карты</div>
                            </div>
                            <For each={cardsSig} key={(c) => c.id}>
                                {(card) => (
                                    <div
                                        class={() => {
                                            const isActive = selectedCardSig()?.id === card.id;
                                            return isActive ? 'selection-item selection-item_active' : 'selection-item';
                                        }}
                                        data-id={card.id}
                                        onClick={() => handleSelectCard(card)}
                                    >
                                        <div style="font-weight: 600;">{`💳 **${card.last4}`}</div>
                                        <div style="font-size: 12px; color: #777;">{card.card_type ?? ''}</div>
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
                controllerRef={(ctl: AddressPickerController | null) => {
                    pickerCtl = ctl;
                }}
            />
            <OrderStatusModal
                controllerRef={(ctl: OrderStatusModalController | null) => {
                    orderStatusCtl = ctl;
                }}
            />
        </div>
    );
}
