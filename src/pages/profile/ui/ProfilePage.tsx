/**
 * Страница профиля пользователя.
 *
 * Рендерит шапку со ссылкой "Назад" и аватаркой, боковую панель с формой
 * редактирования профиля, виджет Wordle, основную область с адресами,
 * картами и историей заказов. Виджеты AddressPicker, Wordle и
 * OrderStatusModal монтируются как декларативные дети. AddressPicker и
 * OrderStatusModal отдают императивный контроллер через проп
 * `controllerRef` (а не `ref`, потому что ядро VDOM применяет проп `ref`
 * только к DOM-узлам). Wordle управляется сигнал-пропом `open`: страница
 * меняет сигнал-флаг по клику на ссылку "попробуйте", виджет дёргает
 * `onClose` на закрытии.
 *
 * Loader. `load()` подгружает текущего пользователя, при отсутствии
 * авторизации редиректит на `/login` и отбивает rejection; параллельно
 * запрашивает адреса, карты и список заказов (потери заказов не блокируют
 * страницу). Заказы сразу декорируются предвычисленным StatusBadge.
 *
 * Реактивность. Пользователь читается из сигнала `useStoreSignal(userStore, s => s.user)`,
 * поэтому изменение аватара или имени через форму редактирования автоматически
 * обновляет шапку и боковую панель. Список заказов хранится в локальном
 * сигнале, чтобы стрим статусов мог обновлять отдельные строки без перерисовки
 * всей страницы.
 *
 * Стрим статусов. Для каждого нетерминального заказа подключается
 * `connectOrderTracker`; событие apply'ит новый статус в соответствующую
 * строку сигнала, по терминальному статусу подписка закрывается. Все
 * трекеры закрываются на `onCleanup`, поэтому утечек подписок при
 * размонтировании страницы нет.
 *
 * Layout: 'root'.
 */

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

/**
 * Декорированный заказ для отображения в строке списка.
 */
interface OrderRowView extends Order {
    /** Предвычисленный бейдж статуса (иконка, подпись, css-модификатор). */
    _badge: StatusBadge;
}

/**
 * Пропсы страницы профиля, формируемые loader-ом.
 */
export interface ProfilePageProps {
    /** Данные текущего пользователя. */
    user: User;
    /** Список заказов пользователя с предвычисленными бейджами. */
    orders: OrderRowView[];
}

/** Терминальные статусы заказа: дальнейшие обновления стрима не нужны. */
const TERMINAL_STATUSES = new Set<string>(['finished', 'cancelled', 'failed']);

/** URL дефолтного аватара пользователя для случая ошибки загрузки. */
const DEFAULT_AVATAR_URL = 'https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp';

/**
 * Декорирует заказы предвычисленными бейджами статуса.
 *
 * @param orders Сырой список заказов из API.
 * @returns Список с добавленным полем `_badge`.
 */
const decorate = (orders: Order[]): OrderRowView[] =>
    orders.map((o) => ({ ...o, _badge: statusBadge(o.status) }));

/**
 * Loader страницы профиля.
 *
 * Загружает текущего пользователя; при отсутствии авторизации перенаправляет
 * на страницу входа и отбивает rejection (роутер пометит роут как error,
 * Outlet останется со скелетоном до коммита редиректа). Параллельно
 * подгружает сохранённые адреса, карты и список заказов; ошибка заказов
 * даёт пустой список, страница продолжает работу.
 *
 * @returns Промис с пропсами страницы профиля.
 */
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

/**
 * Функциональный компонент страницы профиля.
 *
 * Использует пропсы из loader-а как начальный снимок, далее живёт через
 * локальные сигналы: `userSig` подписан на `userStore.user`, `ordersSig`
 * хранит декорированный список заказов и обновляется как из стрима
 * статусов, так и при первичной отрисовке.
 *
 * @param props Пропсы страницы из loader-а.
 * @returns VNode-дерево страницы профиля.
 */
export function ProfilePage(props: ProfilePageProps): VNode {
    // Реактивный пользователь: меняется при логауте/обновлении профиля.
    const userSig = useStoreSignal(userStore, (s) => s.user);

    // Локальный список заказов: стрим статусов будет точечно подменять записи.
    const ordersSig = signal<OrderRowView[]>(props.orders);

    // Заметка о решённой Wordle: меняется по событию onWin.
    const wordleSolved = signal<boolean>(localStorage.getItem('wordle_solved') === 'true');

    // Видимость модалки Wordle: контролируется страницей через сигнал-проп.
    const wordleOpen = signal<boolean>(false);

    // Контроллеры дочерних виджетов: заполняются их controllerRef-колбэками после mount.
    let pickerCtl: AddressPickerController | null = null;
    let orderStatusCtl: OrderStatusModalController | null = null;

    // Скрытый file-input для загрузки аватара: вызываем .click() из обработчика кнопки.
    let avatarFileInput: HTMLInputElement | null = null;

    // Активные трекеры статуса заказа: сохраняются для аккуратного onCleanup.
    const orderTrackers: Map<string, OrderTracker> = new Map();

    /**
     * Применяет новый статус к строке заказа: подменяет запись в сигнале и
     * закрывает трекер, если статус терминальный.
     *
     * @param orderId Идентификатор заказа.
     * @param rawStatus Новый сырой статус из стрима.
     */
    const applyStatusUpdate = (orderId: string, rawStatus: string): void => {
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

    /**
     * Подключает стримы статуса для каждого нетерминального заказа из текущего
     * списка. Повторные подключения для одного и того же заказа исключены.
     */
    const subscribeActiveOrders = (): void => {
        for (const order of ordersSig.peek()) {
            if (!order.order_id || TERMINAL_STATUSES.has(order.status)) continue;
            if (orderTrackers.has(order.order_id)) continue;

            const tracker = connectOrderTracker(order.order_id, {
                onEvent: (event) => applyStatusUpdate(event.order_id, event.status),
            });
            orderTrackers.set(order.order_id, tracker);
        }
    };

    /**
     * Обработчик клика по кнопке-оверлею аватара: триггерит выбор файла.
     */
    const handleAvatarPickClick = (): void => {
        avatarFileInput?.click();
    };

    /**
     * Обработчик выбора файла аватара: загружает изображение, ошибки выводятся
     * через Popup.alert.
     */
    const handleAvatarChange = async (): Promise<void> => {
        const file = avatarFileInput?.files?.[0];
        if (!file) return;
        try {
            await uploadAvatar(file);
        } catch (e) {
            console.error('profile: uploadAvatar failed', e);
            await Popup.alert('Не удалось загрузить аватар');
        }
    };

    /**
     * Обработчик клика по кнопке удаления аватара. Сетевые ошибки сообщаются
     * пользователю через Popup.alert.
     */
    const handleAvatarDelete = async (): Promise<void> => {
        try {
            await deleteAvatar();
        } catch (e) {
            console.error('profile: deleteAvatar failed', e);
            await Popup.alert('Не удалось удалить аватар');
        }
    };

    /**
     * Обработчик клика по кнопке добавления нового адреса.
     */
    const handleAddAddress = (): void => {
        void pickerCtl?.openMapModal();
    };

    /**
     * Обработчик клика по кнопке редактирования существующего адреса.
     *
     * @param id Идентификатор редактируемого адреса.
     */
    const handleEditAddress = (id: string): void => {
        void pickerCtl?.openMapModal(id);
    };

    /**
     * Обработчик клика по кнопке привязки новой карты.
     */
    const handleAddCard = (): void => {
        void bindNewCard().catch(() =>
            Popup.alert('Не удалось начать привязку карты. Попробуйте позже.'),
        );
    };

    /**
     * Обработчик клика по ссылке "попробуйте" Wordle: открывает модалку.
     */
    const handleOpenWordle = (): void => {
        wordleOpen.set(true);
    };

    /**
     * Обработчик закрытия модалки Wordle.
     */
    const handleWordleClose = (): void => {
        wordleOpen.set(false);
    };

    /**
     * Обработчик победы в Wordle: запоминает факт в localStorage и обновляет
     * подпись возле блока виджета.
     */
    const handleWordleWin = (): void => {
        localStorage.setItem('wordle_solved', 'true');
        wordleSolved.set(true);
    };

    /**
     * Обработчик клика или клавиатурного открытия строки заказа: открывает
     * модалку статуса. Для нетерминальных заказов модалка подписывается на
     * стрим обновлений.
     *
     * @param order Заказ, выбранный пользователем.
     */
    const handleOpenOrder = (order: OrderRowView): void => {
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
                                src={(): string => userSig()?.avatar_url ?? DEFAULT_AVATAR_URL}
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
                                when={(): boolean => {
                                    const u = userSig();
                                    return Boolean(u?.avatar_url) && u?.avatar_url !== DEFAULT_AVATAR_URL;
                                }}
                            >
                                <div
                                    class="profile-avatar__delete-hover"
                                    onClick={(): void => {
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
                                ref={(el: Element | null): void => {
                                    avatarFileInput = el as HTMLInputElement | null;
                                }}
                                onChange={(): void => {
                                    void handleAvatarChange();
                                }}
                            />
                        </div>
                        <div class="profile-name-card">
                            <div class="profile-user-info">
                                <span class="profile-input profile-input_name">
                                    {(): string => userSig()?.name ?? ''}
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
                            {(): string => `${userSig()?.streak_weeks ?? 0} нед. — так держать! 🔥`}
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
                                when={(): boolean => ordersSig().length > 0}
                                fallback={<div class="empty-text">История заказов пуста</div>}
                            >
                                <For each={ordersSig} key={(o): string => o.order_id}>
                                    {(order): VNode => (
                                        <div
                                            class="order-row"
                                            data-order-id={order.order_id}
                                            role="button"
                                            tabindex="0"
                                            onClick={(): void => handleOpenOrder(order)}
                                            onKeyDown={(event: Event): void => {
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
                controllerRef={(ctl: AddressPickerController | null): void => {
                    pickerCtl = ctl;
                }}
            />
            <Wordle
                open={wordleOpen}
                onClose={handleWordleClose}
                onWin={handleWordleWin}
            />
            <OrderStatusModal
                controllerRef={(ctl: OrderStatusModalController | null): void => {
                    orderStatusCtl = ctl;
                }}
            />
        </div>
    ) as VNode;
}
