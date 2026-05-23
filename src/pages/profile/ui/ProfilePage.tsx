// Страница профиля пользователя. Layout: 'root'.

import './profile.scss';

import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { Modal } from '@shared/ui/modal';
import { Popup } from '@shared/ui/popup';
import { userStore, type User } from '@entities/user';
import { addressStore, type Address } from '@entities/address';
import { cardStore } from '@entities/card';
import {
    orderApi,
    connectOrderTracker,
    statusBadge,
    type Order,
    type OrderTracker,
    type StatusBadge,
} from '@entities/order';
import { uploadAvatar, deleteAvatar } from '@features/profile/upload-avatar';
import { EditProfileForm } from '@features/profile/edit-profile';
import { AddressesModal, removeAddress } from '@features/profile/manage-addresses';
import { CardList, bindNewCard } from '@features/profile/manage-cards';
import { PromoModal, promosAccessor, ensureLoaded as ensurePromosLoaded } from '@features/profile/manage-promos';
import { OrdersHistoryModal } from '@features/profile/orders-history';
import { AchievementsModal, achievementsAccessor, ensureAchievementsLoaded } from '@features/profile/achievements';
import { addressPickerHandle } from '@widgets/address-picker';
import { Wordle } from '@widgets/wordle';
import { OrderStatusModal, type OrderStatusModalController } from '@widgets/order-status';
import { For, onCleanup, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { signal, useStoreSignal } from '@shared/lib/signals';
import { imageFallback } from '@shared/lib/img';

/** Заказ с предвычисленным бейджем статуса. */
interface OrderRowView extends Order {
    _badge: StatusBadge;
}

export interface ProfilePageProps {
    user: User;
    orders: OrderRowView[];
}

/** Терминальные статусы заказа: обновления стрима больше не нужны. */
const TERMINAL_STATUSES = new Set<string>(['finished', 'cancelled', 'failed']);

/** Статусы заказа, известные UI; прочие сигналы WS-канала пропускаются. */
const KNOWN_ORDER_STATUSES = new Set<string>([
    'created',
    'cart_locked',
    'payment_ready',
    'paid',
    'in_progress',
    'waiting',
    'delivering',
    'finished',
    'cancelled',
    'failed',
]);

const DEFAULT_AVATAR_URL = 'https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp';
/** Запасная картинка для заказа, если у ресторана не пришёл логотип. */
const ORDER_FALLBACK_IMAGE = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

/** Бонусы, дата сгорания и срок подписки пока не приходят с бэка; держим заглушку. */
const STUB_BONUSES = 67;
const STUB_BONUSES_EXPIRE = '01.04.2026';

const RU_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const decorate = (orders: Order[]): OrderRowView[] => orders.map((o) => ({ ...o, _badge: statusBadge(o.status) }));

/** ISO/DD.MM.YYYY -> «10 мая 2026»; на невалидной дате возвращает исходное значение. */
function formatHumanDate(value: string | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = date.getDate();
    const month = RU_MONTHS_SHORT[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

/** Микрорубли -> «1 248₽». */
function formatRubles(microRubles: number): string {
    const rubles = Math.round(microRubles / 1_000_000);
    return `${rubles.toLocaleString('ru-RU')}₽`;
}

/**
 * Подсказка о доле счёта текущего пользователя в совместном заказе. Возвращает
 * `null`, если заказ не разделённый или пользователь в нём не плательщик.
 */
function splitOwnerHint(order: Order, myId: string | null): { text: string; cls: string } | null {
    const splits = order.splits ?? [];
    if (splits.length <= 1 || myId === null) return null;
    const mine = splits.find((s) => s.user_public_id === myId);
    if (!mine) return null;
    if (mine.status === 'paid') return { text: '✓ Ваша часть оплачена', cls: 'paid' };
    if (mine.status === 'pending') return { text: '⏳ Ваша часть не оплачена', cls: 'pending' };
    return null;
}

/** Loader: грузит пользователя, адреса, карты, заказы; редиректит на /login без авторизации. */
export async function load(): Promise<ProfilePageProps> {
    try {
        await userStore.loadCurrent();
    } catch (e) {
        console.warn('profile: loadCurrent failed', e);
    }
    const user = userStore.getState().user;
    if (!user) {
        void router.go(ROUTES.login);
        return Promise.reject(new Error('not authenticated'));
    }
    const [, , ordersRes] = await Promise.allSettled([
        addressStore.loadSaved(),
        cardStore.load(),
        orderApi.list(),
        ensurePromosLoaded(),
        ensureAchievementsLoaded(),
    ]);
    const orders = ordersRes.status === 'fulfilled' ? ordersRes.value : [];
    return { user, orders: decorate(orders) };
}

export function ProfilePage(props: ProfilePageProps): VNode {
    const userSig = useStoreSignal(userStore, (s) => s.user);
    // Стрим статусов точечно подменяет записи в этом списке.
    const ordersSig = signal<OrderRowView[]>(props.orders);
    const savedAddresses = useStoreSignal(addressStore, (s) => s.saved);
    const currentAddress = useStoreSignal(addressStore, (s) => s.current);
    const wordleSolved = signal<boolean>(localStorage.getItem('wordle_solved') === 'true');
    const wordleOpen = signal<boolean>(false);

    let orderStatusCtl: OrderStatusModalController | null = null;
    let avatarFileInput: HTMLInputElement | null = null;

    // Активные трекеры статуса заказа: закрываются на onCleanup.
    const orderTrackers: Map<string, OrderTracker> = new Map();

    // Подменяет статус строки заказа; закрывает трекер при терминальном статусе.
    const applyStatusUpdate = (orderId: string, rawStatus: string) => {
        if (!KNOWN_ORDER_STATUSES.has(rawStatus)) return;

        const current = ordersSig.peek();
        const idx = current.findIndex((o) => o.order_id === orderId);
        if (idx < 0) return;
        const next = current.slice();
        next[idx] = { ...next[idx], status: rawStatus, _badge: statusBadge(rawStatus) };
        ordersSig.set(next);

        if (TERMINAL_STATUSES.has(rawStatus)) {
            const tracker = orderTrackers.get(orderId);
            if (tracker) {
                tracker.close();
                orderTrackers.delete(orderId);
            }
        }
    };

    // Подключает стрим статуса для каждого нетерминального заказа без дублей.
    const subscribeActiveOrders = () => {
        for (const order of ordersSig.peek()) {
            if (!order.order_id || TERMINAL_STATUSES.has(order.status)) continue;
            if (orderTrackers.has(order.order_id)) continue;

            const tracker = connectOrderTracker(order.order_id, {
                onEvent: (event) => applyStatusUpdate(event.order_id, event.status),
            });
            orderTrackers.set(order.order_id, tracker);
        }
    };

    const handleAvatarPickClick = () => {
        avatarFileInput?.click();
    };

    const handleAvatarChange = async () => {
        const file = avatarFileInput?.files?.[0];
        if (!file) return;
        try {
            await uploadAvatar(file);
        } catch (e) {
            console.error('profile: uploadAvatar failed', e);
            await Popup.alert('Не удалось загрузить аватар');
        }
    };

    const handleAvatarDelete = async () => {
        try {
            await deleteAvatar();
        } catch (e) {
            console.error('profile: deleteAvatar failed', e);
            await Popup.alert('Не удалось удалить аватар');
        }
    };

    const handleAddCard = () => {
        void bindNewCard().catch(() => Popup.alert('Не удалось начать привязку карты. Попробуйте позже.'));
    };

    const handleOpenWordle = () => {
        wordleOpen.set(true);
    };

    const handleWordleClose = () => {
        wordleOpen.set(false);
    };

    const handleWordleWin = () => {
        localStorage.setItem('wordle_solved', 'true');
        wordleSolved.set(true);
    };

    // Перечитывает заказы с сервера и обновляет список (с бейджами статусов).
    // Нужно после действий в модалке заказа (например, отмены): WS-событие
    // приходит не всегда, поэтому при закрытии модалки берём свежие данные.
    const reloadOrders = async () => {
        try {
            const fresh = await orderApi.list();
            ordersSig.set(decorate(fresh));
            subscribeActiveOrders();
        } catch (e) {
            console.warn('profile: reloadOrders failed', e);
        }
    };

    // Для нетерминальных заказов модалка подписывается на стрим обновлений.
    // По закрытию модалки перечитываем список, чтобы отмена/смена статуса
    // сразу отразились в профиле без перезагрузки страницы.
    const handleOpenOrder = (order: Order) => {
        if (!orderStatusCtl) return;
        const isTerminal = TERMINAL_STATUSES.has(order.status);
        orderStatusCtl.open(order, {
            subscribe: !isTerminal,
            onClose: () => {
                void reloadOrders();
            },
        });
    };

    // Модалки со списком: один экземпляр Modal на каждую, чтобы повторное открытие
    // не дублировало overlay (Modal сам игнорирует повторный open при isOpen).
    let promoModalInstance: Modal | null = null;
    let ordersModalInstance: Modal | null = null;
    let addressesModalInstance: Modal | null = null;
    let achievementsModalInstance: Modal | null = null;

    const openPromoModal = () => {
        if (promoModalInstance !== null && promoModalInstance.isOpen()) return;
        promoModalInstance = new Modal();
        promoModalInstance.open(<PromoModal onClose={() => promoModalInstance?.close()} />);
    };

    const openOrdersModal = () => {
        if (ordersModalInstance !== null && ordersModalInstance.isOpen()) return;
        ordersModalInstance = new Modal();
        ordersModalInstance.open(
            <OrdersHistoryModal
                orders={ordersSig.peek()}
                onClose={() => ordersModalInstance?.close()}
                onOpenOrder={(order: Order) => {
                    ordersModalInstance?.close();
                    handleOpenOrder(order);
                }}
            />,
        );
    };

    const openAddressesModal = () => {
        if (addressesModalInstance !== null && addressesModalInstance.isOpen()) return;
        addressesModalInstance = new Modal();
        addressesModalInstance.open(<AddressesModal onClose={() => addressesModalInstance?.close()} />);
    };

    const openAchievementsModal = () => {
        if (achievementsModalInstance !== null && achievementsModalInstance.isOpen()) return;
        achievementsModalInstance = new Modal();
        achievementsModalInstance.open(<AchievementsModal onClose={() => achievementsModalInstance?.close()} />);
    };

    const handleAddAddress = () => {
        addressPickerHandle.openMapModal();
    };

    // Если гостя привели на профиль после оформления совместного заказа
    // (флаг ставит cartStore), сразу открываем заказ с его неоплаченной долей.
    const autoOpenPendingSplitOrder = () => {
        let shouldOpen = false;
        try {
            shouldOpen = sessionStorage.getItem('nancats:open_pending_split_order') === '1';
            if (shouldOpen) sessionStorage.removeItem('nancats:open_pending_split_order');
        } catch (e) {
            console.warn('profile: sessionStorage unavailable', e);
        }
        if (!shouldOpen || !orderStatusCtl) return;

        const myId = props.user.public_id;
        const target = ordersSig.peek().find((o) => {
            const splits = o.splits ?? [];
            if (splits.length <= 1) return false;
            const mine = splits.find((s) => s.user_public_id === myId);
            return mine !== undefined && mine.status === 'pending';
        });
        if (target) {
            orderStatusCtl.open(target, { subscribe: !TERMINAL_STATUSES.has(target.status) });
        }
    };

    onMount(() => {
        subscribeActiveOrders();
        autoOpenPendingSplitOrder();
    });

    onCleanup(() => {
        for (const tracker of orderTrackers.values()) tracker.close();
        orderTrackers.clear();
        promoModalInstance?.close();
        ordersModalInstance?.close();
        addressesModalInstance?.close();
        achievementsModalInstance?.close();
    });

    // Адрес, считающийся «основным»: текущий выбранный, либо первый сохранённый.
    const primaryAddress = () => {
        const current = currentAddress();
        const saved = savedAddresses();
        if (current !== null) {
            return saved.find((a) => a.location.address_text === current.text) ?? saved[0] ?? null;
        }
        return saved[0] ?? null;
    };

    // Признак «основного» адреса для подсветки строки.
    const isPrimaryAddress = (addr: Address): boolean => {
        const primary = primaryAddress();
        return primary !== null && primary.id === addr.id;
    };

    // Компактный список адресов: основной первым, плюс ещё один, всего до 2.
    const compactAddresses = () => {
        const saved = savedAddresses();
        const primary = primaryAddress();
        if (primary === null) return [];
        const rest = saved.filter((a) => a.id !== primary.id);
        return [primary, ...rest].slice(0, 2);
    };

    // Клик по адресу делает его текущим (основным) без открытия модалки.
    const handlePickPrimary = (addr: Address) => {
        addressStore.setCurrent({
            text: addr.location.address_text,
            coords: [addr.location.latitude, addr.location.longitude],
        });
    };

    const handleEditAddress = (event: Event, id: string) => {
        event.stopPropagation();
        addressPickerHandle.openDetailsForEdit(id);
    };

    const handleRemoveAddress = async (event: Event, id: string) => {
        event.stopPropagation();
        const ok = await Popup.confirm('Удалить этот адрес?');
        if (!ok) return;
        try {
            await removeAddress(id);
        } catch (e) {
            console.error('ProfilePage: remove address failed', e);
            await Popup.alert('Не удалось удалить адрес');
        }
    };

    const compactOrders = () => ordersSig().slice(0, 2);

    return (
        <div class="profile-page">
            <div class="profile-content">
                <aside class="profile-sidebar">
                    <div class="profile-user-header">
                        <div class="profile-avatar__wrapper">
                            <img
                                id="profile-avatar-img"
                                class="profile-avatar__img"
                                src={() => userSig()?.avatar_url ?? DEFAULT_AVATAR_URL}
                                alt="avatar"
                                onError={imageFallback(DEFAULT_AVATAR_URL)}
                            />
                            <div class="profile-avatar__overlay" onClick={handleAvatarPickClick}>
                                📷
                            </div>
                            <Show
                                when={() => {
                                    const u = userSig();
                                    return Boolean(u?.avatar_url) && u?.avatar_url !== DEFAULT_AVATAR_URL;
                                }}
                            >
                                <div
                                    class="profile-avatar__delete-hover"
                                    onClick={() => {
                                        void handleAvatarDelete();
                                    }}
                                >
                                    Удалить
                                </div>
                            </Show>
                            <input
                                type="file"
                                class="js-avatar-input"
                                accept="image/png, image/jpeg, image/webp"
                                hidden
                                ref={(el: Element | null) => {
                                    avatarFileInput = el as HTMLInputElement | null;
                                }}
                                onChange={() => {
                                    void handleAvatarChange();
                                }}
                            />
                        </div>
                        <div class="profile-name-card">
                            <div class="profile-user-info">
                                <span class="profile-input profile-input_name">{() => userSig()?.name ?? ''}</span>
                            </div>
                        </div>
                    </div>

                    <div class="profile-card profile-card_details">
                        <EditProfileForm name={props.user.name} email={props.user.email} />
                    </div>

                    <div class="profile-card profile-card_row">
                        <div class="card-side-label">
                            <span>Стрик</span>
                            <div class="orange-dot orange-dot_small" />
                        </div>
                        <div class="card-side-content card-value-text">
                            {() => `${userSig()?.streak_weeks ?? 0} нед. — так держать! 🔥`}
                        </div>
                    </div>

                    <div class="profile-card profile-card_row">
                        <div class="card-side-label">Ачивки</div>
                        <div class="card-side-content profile-card__promo-row">
                            <span class="card-subtext">
                                {() => {
                                    const items = achievementsAccessor();
                                    const earned = items.filter((a) => a.earned).length;
                                    return `${earned} из ${items.length}`;
                                }}
                            </span>
                            <button type="button" class="profile-card__promo-button" onClick={openAchievementsModal}>
                                Посмотреть
                            </button>
                        </div>
                    </div>

                    <div class="profile-card profile-card_row">
                        <div class="card-side-label">Пять букв</div>
                        <div class="card-side-content card-subtext">
                            <Show
                                when={wordleSolved}
                                fallback={
                                    <>
                                        Вы ещё не отгадали сегодняшнее слово в игре «5 букв»,{' '}
                                        <span class="link-orange" onClick={handleOpenWordle}>
                                            попробуйте
                                        </span>
                                        !
                                    </>
                                }
                            >
                                <span>
                                    <b>Поздравляем!</b> Вы отгадали слово дня 🎉
                                </span>
                            </Show>
                        </div>
                    </div>

                    <div class="profile-card profile-card_row">
                        <div class="card-side-label">Бонусы</div>
                        <div class="card-side-content card-subtext">
                            <span class="profile-card__bonus-inline">{String(STUB_BONUSES)}</span> — успей использовать
                            до <span class="text-danger">сгорания {STUB_BONUSES_EXPIRE}</span>
                        </div>
                    </div>

                    <div class="profile-card profile-card_row">
                        <div class="card-side-label">Промокоды</div>
                        <div class="card-side-content profile-card__promo-row">
                            <span class="card-subtext">{() => `${promosAccessor().length} доступно`}</span>
                            <button type="button" class="profile-card__promo-button" onClick={openPromoModal}>
                                Смотреть
                            </button>
                        </div>
                    </div>
                </aside>

                <main class="profile-main">
                    <div class="profile-card profile-card_main">
                        <div class="section-header">
                            <h2 class="section-title">Адреса доставки</h2>
                            <button
                                type="button"
                                class="orange-dot orange-dot_large"
                                aria-label="Добавить адрес"
                                onClick={handleAddAddress}
                            />
                        </div>
                        <Show
                            when={() => savedAddresses().length > 0}
                            fallback={<div class="empty-text">У вас пока нет сохранённых адресов</div>}
                        >
                            <div class="address-compact-list">
                                <For each={compactAddresses} key={(a) => a.id}>
                                    {(addr) => (
                                        <div
                                            class={() =>
                                                isPrimaryAddress(addr)
                                                    ? 'address-compact address-compact_primary'
                                                    : 'address-compact'
                                            }
                                            role="button"
                                            tabindex="0"
                                            onClick={() => handlePickPrimary(addr)}
                                            onKeyDown={(event: Event) => {
                                                const ke = event as KeyboardEvent;
                                                if (ke.key === 'Enter' || ke.key === ' ') {
                                                    ke.preventDefault();
                                                    handlePickPrimary(addr);
                                                }
                                            }}
                                        >
                                            <span
                                                class={() =>
                                                    isPrimaryAddress(addr)
                                                        ? 'address-compact__radio address-compact__radio_active'
                                                        : 'address-compact__radio'
                                                }
                                            />
                                            <span class="address-compact__label">{addr.label ?? 'Адрес'}</span>
                                            <span class="address-compact__sep">·</span>
                                            <span class="address-compact__text">{addr.location.address_text}</span>
                                            <span
                                                class="address-compact__action"
                                                role="button"
                                                tabindex="0"
                                                aria-label="Редактировать"
                                                onClick={(event: Event) => handleEditAddress(event, addr.id)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                    <path
                                                        d="M1 11.5V13h1.5l8.5-8.5L9.5 3L1 11.5Z"
                                                        stroke="#7D7D7D"
                                                        stroke-width="1.2"
                                                        stroke-linejoin="round"
                                                    />
                                                </svg>
                                            </span>
                                            <span
                                                class="address-compact__action"
                                                role="button"
                                                tabindex="0"
                                                aria-label="Удалить"
                                                onClick={(event: Event) => {
                                                    void handleRemoveAddress(event, addr.id);
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                    <path
                                                        d="M2 2L12 12M12 2L2 12"
                                                        stroke="#7D7D7D"
                                                        stroke-width="1.4"
                                                        stroke-linecap="round"
                                                    />
                                                </svg>
                                            </span>
                                        </div>
                                    )}
                                </For>
                            </div>
                            <Show when={() => savedAddresses().length > 2}>
                                <div class="address-compact-footer">
                                    <span
                                        class="link-orange link-orange_underline"
                                        role="button"
                                        tabindex="0"
                                        onClick={openAddressesModal}
                                        onKeyDown={(event: Event) => {
                                            const ke = event as KeyboardEvent;
                                            if (ke.key === 'Enter' || ke.key === ' ') {
                                                ke.preventDefault();
                                                openAddressesModal();
                                            }
                                        }}
                                    >
                                        Остальные адреса
                                    </span>
                                    <span class="address-compact-footer__count">
                                        {() => `всего ${savedAddresses().length}`}
                                    </span>
                                </div>
                            </Show>
                        </Show>
                    </div>

                    <div class="profile-card profile-card_main">
                        <div class="section-header">
                            <h2 class="section-title">Карты и оплата</h2>
                            <button
                                type="button"
                                class="orange-dot orange-dot_large"
                                aria-label="Привязать карту"
                                onClick={handleAddCard}
                            />
                        </div>
                        {(() => {
                            const canScrollLeft = signal(false);
                            const canScrollRight = signal(false);
                            // Контейнер списка карт держим через ref из CardList,
                            // без завязки на глобальный id.
                            let listEl: HTMLElement | null = null;
                            const updateArrows = () => {
                                if (!listEl) return;
                                canScrollLeft.set(listEl.scrollLeft > 0);
                                canScrollRight.set(listEl.scrollLeft + listEl.clientWidth < listEl.scrollWidth - 1);
                            };
                            return (
                                <div class="cards-row">
                                    <Show when={canScrollLeft}>
                                        <button
                                            type="button"
                                            class="cards-scroll-arrow"
                                            aria-label="Прокрутить карты влево"
                                            onClick={() => {
                                                listEl?.scrollBy({ left: -120, behavior: 'smooth' });
                                            }}
                                        >
                                            ‹
                                        </button>
                                    </Show>
                                    <CardList
                                        listRef={(el: HTMLElement | null) => {
                                            listEl = el;
                                            if (el) {
                                                el.addEventListener('scroll', updateArrows);
                                                requestAnimationFrame(updateArrows);
                                            }
                                        }}
                                    />
                                    <Show when={canScrollRight}>
                                        <button
                                            type="button"
                                            class="cards-scroll-arrow"
                                            aria-label="Прокрутить карты вправо"
                                            onClick={() => {
                                                listEl?.scrollBy({ left: 120, behavior: 'smooth' });
                                            }}
                                        >
                                            ›
                                        </button>
                                    </Show>
                                </div>
                            );
                        })()}
                    </div>

                    <div class="profile-card profile-card_main profile-card_orders">
                        <div class="orders-section-head">
                            <h2 class="section-title">История заказов</h2>
                            <span class="orders-section-head__count">{() => `${ordersSig().length} заказов`}</span>
                        </div>
                        <Show
                            when={() => ordersSig().length > 0}
                            fallback={<div class="empty-text">История заказов пуста</div>}
                        >
                            <div class="orders-list">
                                <For each={compactOrders} key={(o) => o.order_id}>
                                    {(order) => (
                                        <div
                                            class="order-card"
                                            data-order-id={order.order_id}
                                            role="button"
                                            tabindex="0"
                                            onClick={() => handleOpenOrder(order)}
                                            onKeyDown={(event: Event) => {
                                                const ke = event as KeyboardEvent;
                                                if (ke.key === 'Enter' || ke.key === ' ') {
                                                    ke.preventDefault();
                                                    handleOpenOrder(order);
                                                }
                                            }}
                                        >
                                            <img
                                                class="order-card__img"
                                                src={order.restaurant_image_url || ORDER_FALLBACK_IMAGE}
                                                alt="order"
                                                onError={imageFallback(ORDER_FALLBACK_IMAGE)}
                                            />
                                            <div class="order-card__body">
                                                <div class="order-card__name">{order.restaurant_name ?? 'Заказ'}</div>
                                                <div class="order-card__date">{formatHumanDate(order.created_at)}</div>
                                            </div>
                                            <div class="order-card__aside">
                                                <div class="order-card__price">
                                                    {formatRubles(order.total_cost ?? 0)}
                                                </div>
                                                <div
                                                    class={`order-card__status order-card__status_${order._badge.className}`}
                                                >
                                                    <span class="order-card__status-dot">●</span>
                                                    <span>{order._badge.label}</span>
                                                </div>
                                                {(() => {
                                                    const hint = splitOwnerHint(order, props.user.public_id);
                                                    return hint ? (
                                                        <div class={`order-card__split order-card__split_${hint.cls}`}>
                                                            {hint.text}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                            <div class="orders-actions">
                                <button type="button" class="orders-actions__secondary" onClick={openOrdersModal}>
                                    Показать все заказы
                                    <span class="orders-actions__arrow" aria-hidden="true">
                                        →
                                    </span>
                                </button>
                            </div>
                        </Show>
                    </div>
                </main>
            </div>

            <Wordle open={wordleOpen} onClose={handleWordleClose} onWin={handleWordleWin} />
            <OrderStatusModal
                controllerRef={(ctl: OrderStatusModalController | null) => {
                    orderStatusCtl = ctl;
                }}
            />
        </div>
    );
}
