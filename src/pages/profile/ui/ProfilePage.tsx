// Страница профиля пользователя. Layout: 'root'.

import './profile.scss';

import { Link, router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { Popup } from '@shared/ui/popup';
import { userStore, type User } from '@entities/user';
import { addressStore } from '@entities/address';
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
import { AddressList } from '@features/profile/manage-addresses';
import { CardList, bindNewCard } from '@features/profile/manage-cards';
import { AddressPicker, type AddressPickerController } from '@widgets/address-picker';
import { Wordle } from '@widgets/wordle';
import { OrderStatusModal, type OrderStatusModalController } from '@widgets/order-status';
import { For, onCleanup, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { signal, useStoreSignal } from '@shared/lib/signals';

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

const DEFAULT_AVATAR_URL = 'https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp';

const decorate = (orders: Order[]): OrderRowView[] =>
    orders.map((o) => ({ ...o, _badge: statusBadge(o.status) }));

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
    ]);
    const orders = ordersRes.status === 'fulfilled' ? ordersRes.value : [];
    return { user, orders: decorate(orders) };
}

export function ProfilePage(props: ProfilePageProps): VNode {
    const userSig = useStoreSignal(userStore, (s) => s.user);
    // Стрим статусов точечно подменяет записи в этом списке.
    const ordersSig = signal<OrderRowView[]>(props.orders);
    const wordleSolved = signal<boolean>(localStorage.getItem('wordle_solved') === 'true');
    const wordleOpen = signal<boolean>(false);

    let pickerCtl: AddressPickerController | null = null;
    let orderStatusCtl: OrderStatusModalController | null = null;
    let avatarFileInput: HTMLInputElement | null = null;

    // Активные трекеры статуса заказа: закрываются на onCleanup.
    const orderTrackers: Map<string, OrderTracker> = new Map();

    // Подменяет статус строки заказа; закрывает трекер при терминальном статусе.
    const applyStatusUpdate = (orderId: string, rawStatus: string) => {
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

    const handleAddAddress = () => {
        void pickerCtl?.openMapModal();
    };

    const handleEditAddress = (id: string) => {
        void pickerCtl?.openMapModal(id);
    };

    const handleAddCard = () => {
        void bindNewCard().catch(() =>
            Popup.alert('Не удалось начать привязку карты. Попробуйте позже.'),
        );
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

    // Для нетерминальных заказов модалка подписывается на стрим обновлений.
    const handleOpenOrder = (order: OrderRowView) => {
        if (!orderStatusCtl) return;
        const isTerminal = TERMINAL_STATUSES.has(order.status);
        orderStatusCtl.open(order, { subscribe: !isTerminal });
    };

    onMount(() => {
        subscribeActiveOrders();
    });

    onCleanup(() => {
        for (const tracker of orderTrackers.values()) tracker.close();
        orderTrackers.clear();
    });

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
                                onerror={`this.src='${DEFAULT_AVATAR_URL}'`}
                            />
                            <div
                                class="profile-avatar__overlay"
                                onClick={handleAvatarPickClick}
                            >
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
                                <span class="profile-input profile-input_name">
                                    {() => userSig()?.name ?? ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="profile-card profile-card_details">
                        <EditProfileForm
                            name={props.user.name}
                            email={props.user.email}
                        />
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
                        <AddressList onEdit={handleEditAddress} />
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
                        <CardList />
                    </div>

                    <div class="profile-card profile-card_main profile-card_orders">
                        <h2 class="section-title">История заказов</h2>
                        <div class="orders-list">
                            <Show
                                when={() => ordersSig().length > 0}
                                fallback={<div class="empty-text">История заказов пуста</div>}
                            >
                                <For each={ordersSig} key={(o) => o.order_id}>
                                    {(order) => (
                                        <div
                                            class="order-row"
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
                                                class="order-row__img"
                                                src={order.restaurant_image_url ?? ''}
                                                alt="order"
                                                onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'"
                                            />
                                            <div class="order-row__date">{order.created_at ?? ''}</div>
                                            <div class="order-row__info">
                                                <div class="order-row__name">
                                                    {order.restaurant_name ?? 'Заказ'}
                                                </div>
                                                <div
                                                    class={`order-row__status order-row__status_${order._badge.className}`}
                                                >
                                                    <span class="order-row__status-icon">
                                                        {order._badge.icon}
                                                    </span>
                                                    <span class="order-row__status-label">
                                                        {order._badge.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="order-row__price">
                                                {((order.total_cost ?? 0) / 1_000_000).toFixed(2)}₽
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>
                </main>
            </div>

            <AddressPicker
                hideInput
                skipDetails={false}
                controllerRef={(ctl: AddressPickerController | null) => {
                    pickerCtl = ctl;
                }}
            />
            <Wordle
                open={wordleOpen}
                onClose={handleWordleClose}
                onWin={handleWordleWin}
            />
            <OrderStatusModal
                controllerRef={(ctl: OrderStatusModalController | null) => {
                    orderStatusCtl = ctl;
                }}
            />
        </div>
    );
}
