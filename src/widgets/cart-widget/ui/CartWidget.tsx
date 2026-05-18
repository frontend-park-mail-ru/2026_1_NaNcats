// Виджет корзины: список позиций, изменение количества, итог и переход к оформлению.
// Поддерживает совместную корзину: участники, инвайт-ссылка, владельцы позиций,
// права гостя и администратора, live-обновления через WebSocket в cartStore.
// Кнопка закрытия сохраняет класс js-close-panels для внешнего слушателя на страницах.

import './cartWidget.scss';

import { cartStore, fromMicros, type CartItem, type CartMember } from '@entities/cart';
import { userStore } from '@entities/user';
import { clearCart } from '@features/cart/clear-cart';
import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { computed, signal, useStoreSignal } from '@shared/lib/signals';
import { For, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';

/** Картинка-заглушка блюда при ошибке загрузки `image_url`. */
const FALLBACK_DISH_IMAGE = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

export interface CartWidgetProps {
    /** Колбэк после перехода к оформлению (например, чтобы закрыть боковую панель). */
    onCheckout?: () => void;
}

/** Цена одной позиции в рублях, без дробной части. */
function formatItemPriceRub(item: CartItem) {
    return `${fromMicros(item.price).toFixed(0)}₽`;
}

/**
 * Человекочитаемая метка участника корзины относительно текущего пользователя.
 * Имён бэкенд не отдаёт, поэтому участник опознаётся по роли и числовому id.
 */
function memberLabel(member: CartMember, currentUserId: number | null, adminId: number | null): string {
    if (currentUserId !== null && member.user_id === currentUserId) {
        return member.user_id === adminId ? 'Вы (организатор)' : 'Вы';
    }
    if (member.user_id === adminId) return 'Организатор';
    return `Участник #${member.user_id}`;
}

/** Метка владельца позиции для бейджа в строке товара. */
function ownerLabel(ownerId: number | null | undefined, currentUserId: number | null, adminId: number | null): string {
    if (ownerId === null || ownerId === undefined) return 'Ничьё';
    if (currentUserId !== null && ownerId === currentUserId) return 'Ваше';
    if (ownerId === adminId) return 'Организатор';
    return `Участник #${ownerId}`;
}

/**
 * Извлекает токен приглашения из введённой пользователем строки. Принимает
 * как «голый» токен, так и полную ссылку вида `https://.../?cart_invite=TOKEN`.
 *
 * @param raw Произвольная строка из поля ввода.
 * @returns Токен приглашения либо пустая строка, если распознать не удалось.
 */
function extractInviteToken(raw: string): string {
    const value = raw.trim();
    if (value.includes('cart_invite=')) {
        try {
            const url = new URL(value, window.location.origin);
            return url.searchParams.get('cart_invite')?.trim() ?? '';
        } catch {
            const match = value.match(/cart_invite=([^&\s]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        }
    }
    return value;
}

/** Виджет корзины: список позиций, совместная корзина, итог и переход к оформлению. */
export function CartWidget(props: CartWidgetProps = {}): VNode {
    const items = useStoreSignal(cartStore, (s) => s.items);
    const totalCost = useStoreSignal(cartStore, (s) => s.totalCost);
    const status = useStoreSignal(cartStore, (s) => s.status);
    const mode = useStoreSignal(cartStore, (s) => s.mode);
    const adminId = useStoreSignal(cartStore, (s) => s.adminId);
    const members = useStoreSignal(cartStore, (s) => s.members);
    const user = useStoreSignal(userStore, (s) => s.user);

    // Локальное состояние виджета: инвайт-ссылка, статус копирования, поле кода.
    const inviteToken = signal<string>('');
    const copied = signal<boolean>(false);
    const joinCode = signal<string>('');
    const busy = signal<boolean>(false);
    // Поле ввода кода приглашения скрыто за ссылкой, пока не понадобится.
    const joinOpen = signal<boolean>(false);

    // Поле ввода кода неконтролируемое: значение читаем и чистим через ref,
    // потому что проп value у этого VDOM прокидывается через setAttribute.
    let joinInputEl: HTMLInputElement | null = null;

    const currentUserId = computed<number | null>(() => user()?.id ?? null);
    const hasItems = computed(() => items().length > 0);
    const isShared = computed(() => mode() === 'shared');
    const isAdmin = computed(() => {
        const uid = currentUserId();
        return uid !== null && adminId() !== null && uid === adminId();
    });
    // Гость совместной корзины: участник, но не организатор.
    const isGuest = computed(() => isShared() && !isAdmin());
    const totalRub = computed(() => `${fromMicros(totalCost()).toFixed(0)}₽`);
    const actionsDisabled = computed(() => status() === 'syncing' || busy());

    const inviteLink = computed(() => {
        const token = inviteToken();
        return token ? `${window.location.origin}/?cart_invite=${encodeURIComponent(token)}` : '';
    });

    const handleCheckout = () => {
        void router.go(ROUTES.checkout);
        props.onCheckout?.();
    };

    const handleImgError = (event: Event) => {
        const img = event.target as HTMLImageElement | null;
        if (img) img.src = FALLBACK_DISH_IMAGE;
    };

    const handleClear = async () => {
        try {
            await clearCart();
        } catch (err) {
            console.error('[CartWidget] clearCart failed:', err);
            await Popup.alert('Не удалось очистить корзину. Попробуйте ещё раз.');
        }
    };

    // Создаёт инвайт-ссылку и переводит корзину в совместный режим.
    const handleGenerateInvite = async () => {
        busy.set(true);
        try {
            const invite = await cartStore.generateInvite();
            inviteToken.set(invite.token);
            copied.set(false);
        } catch (err) {
            console.error('[CartWidget] generateInvite failed:', err);
            const msg = err instanceof Error && err.message ? err.message : 'Не удалось создать приглашение.';
            await Popup.alert(msg);
        } finally {
            busy.set(false);
        }
    };

    // Копирует инвайт-ссылку в буфер обмена; при недоступности API просто молчит.
    const handleCopyInvite = async () => {
        const link = inviteLink();
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            copied.set(true);
            setTimeout(() => copied.set(false), 2000);
        } catch (err) {
            console.warn('[CartWidget] clipboard write failed:', err);
            await Popup.alert('Не удалось скопировать. Скопируйте ссылку вручную.');
        }
    };

    // Присоединяет пользователя к совместной корзине по введённому коду.
    // Принимает как «голый» токен, так и полную ссылку-приглашение.
    const handleJoin = async () => {
        const raw = joinCode().trim();
        if (!raw) return;
        const token = extractInviteToken(raw);
        if (!token) {
            await Popup.alert('Не удалось распознать код приглашения.');
            return;
        }
        busy.set(true);
        try {
            await cartStore.joinByToken(token);
            joinCode.set('');
            if (joinInputEl) joinInputEl.value = '';
        } catch (err) {
            console.error('[CartWidget] joinByToken failed:', err);
            await Popup.alert('Не удалось присоединиться: приглашение недействительно или просрочено.');
        } finally {
            busy.set(false);
        }
    };

    const handleKick = async (member: CartMember) => {
        if (!(await Popup.confirm('Удалить участника из корзины? Его блюда останутся, но станут ничейными.'))) {
            return;
        }
        try {
            await cartStore.kickMember(member.user_id);
        } catch (err) {
            console.error('[CartWidget] kickMember failed:', err);
            await Popup.alert('Не удалось удалить участника.');
        }
    };

    const handleCloseShared = async () => {
        if (!(await Popup.confirm('Закрыть совместную корзину? Гости и их блюда будут удалены.'))) return;
        try {
            await cartStore.closeShared();
            inviteToken.set('');
        } catch (err) {
            console.error('[CartWidget] closeShared failed:', err);
            await Popup.alert('Не удалось закрыть совместную корзину.');
        }
    };

    return (
        <div class="cart-wrapper">
            <div class="cart-header-top">
                <span class="cart-title">{() => (isShared() ? 'Совместная корзина' : 'Корзина')}</span>
                <div class="cart-header-actions">
                    <Show when={() => hasItems() && !isGuest()}>
                        <button
                            id="clear-cart-btn"
                            class="button button_secondary"
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => {
                                void handleClear();
                            }}
                        >
                            Очистить
                        </button>
                    </Show>
                    <button type="button" class="cart-close-btn js-close-panels" aria-label="Закрыть корзину">
                        ×
                    </button>
                </div>
            </div>

            <Show when={isShared}>
                <div class="cart-shared">
                    <div class="cart-shared__head">
                        <span class="cart-shared__label">{() => `Участники · ${members().length}`}</span>
                    </div>
                    <div class="cart-members">
                        <For each={members} key={(m) => m.user_id}>
                            {(m) => (
                                <div class="cart-member">
                                    <span class="cart-member__dot" />
                                    <span class="cart-member__name">
                                        {() => memberLabel(m, currentUserId(), adminId())}
                                    </span>
                                    <Show when={() => isAdmin() && m.user_id !== adminId()}>
                                        <button
                                            type="button"
                                            class="cart-member__kick"
                                            aria-label="Удалить участника"
                                            disabled={actionsDisabled}
                                            onClick={() => {
                                                void handleKick(m);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>

                    <Show
                        when={isAdmin}
                        fallback={
                            <p class="cart-shared__note">
                                Вы участник корзины. Заказ оформит организатор, а вы можете добавлять свои блюда.
                            </p>
                        }
                    >
                        <Show
                            when={() => inviteToken() !== ''}
                            fallback={
                                <button
                                    type="button"
                                    class="button button_secondary cart-shared__invite-btn"
                                    disabled={actionsDisabled}
                                    onClick={() => {
                                        void handleGenerateInvite();
                                    }}
                                >
                                    🔗 Создать ссылку-приглашение
                                </button>
                            }
                        >
                            <div class="cart-invite">
                                <div class="cart-invite__link" title={inviteLink}>
                                    {inviteLink}
                                </div>
                                <div class="cart-invite__actions">
                                    <button
                                        type="button"
                                        class="button button_primary"
                                        onClick={() => {
                                            void handleCopyInvite();
                                        }}
                                    >
                                        {() => (copied() ? '✓ Скопировано' : 'Копировать')}
                                    </button>
                                    <button
                                        type="button"
                                        class="button button_secondary"
                                        disabled={actionsDisabled}
                                        onClick={() => {
                                            void handleGenerateInvite();
                                        }}
                                    >
                                        Обновить
                                    </button>
                                </div>
                            </div>
                        </Show>
                        <button
                            type="button"
                            class="cart-shared__close"
                            disabled={actionsDisabled}
                            onClick={() => {
                                void handleCloseShared();
                            }}
                        >
                            Закрыть совместную корзину
                        </button>
                    </Show>
                </div>
            </Show>

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
                    <For
                        each={items}
                        key={(item) => `${item.dish_id}:${item.owner_user_id ?? 0}`}
                    >
                        {(item) => {
                            const dishId = item.dish_id;
                            // Позицию ищем по паре dish_id + владелец: у блюда в
                            // совместной корзине бывает по строке на участника.
                            const ownerKey = item.owner_user_id ?? 0;
                            // For не перевызывает children при изменении полей позиции,
                            // поэтому актуальную позицию читаем из сигнала items на каждом
                            // тике; если позиция исчезла, держим последний снимок до размонтирования.
                            const currentItem = computed<CartItem>(
                                () =>
                                    items().find(
                                        (it) => it.dish_id === dishId && (it.owner_user_id ?? 0) === ownerKey,
                                    ) ?? item,
                            );
                            const quantity = computed(() => currentItem().quantity);
                            const priceRub = computed(() => formatItemPriceRub(currentItem()));
                            const ownerText = computed(() =>
                                ownerLabel(currentItem().owner_user_id, currentUserId(), adminId()),
                            );
                            // Гость правит только свои позиции, в соло-корзине ограничений нет.
                            const canModify = computed(() => {
                                if (!isShared()) return true;
                                return currentItem().owner_user_id === currentUserId();
                            });
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
                                        <Show when={isShared}>
                                            <div
                                                class={() =>
                                                    currentItem().owner_user_id == null
                                                        ? 'cart-item__owner cart-item__owner_none'
                                                        : 'cart-item__owner'
                                                }
                                            >
                                                {ownerText}
                                            </div>
                                        </Show>
                                    </div>
                                    <div class="cart-item__counter">
                                        <Show
                                            when={() => isShared() && currentItem().owner_user_id == null}
                                            fallback={
                                                <>
                                                    <button
                                                        type="button"
                                                        class="counter-btn"
                                                        disabled={() => !canModify()}
                                                        onClick={() => {
                                                            void cartStore.changeQuantity(dishId, -1);
                                                        }}
                                                    >
                                                        −
                                                    </button>
                                                    <span class="counter-value">{quantity}</span>
                                                    <button
                                                        type="button"
                                                        class="counter-btn"
                                                        disabled={() => !canModify()}
                                                        onClick={() => {
                                                            void cartStore.changeQuantity(dishId, 1);
                                                        }}
                                                    >
                                                        +
                                                    </button>
                                                </>
                                            }
                                        >
                                            {/* Позиция удалённого участника осталась без владельца.
                                                Организатор может забрать её себе, иначе оформить
                                                заказ нельзя. */}
                                            <Show when={isAdmin}>
                                                <button
                                                    type="button"
                                                    class="cart-item__claim"
                                                    onClick={() => {
                                                        void cartStore.claimItem(dishId);
                                                    }}
                                                >
                                                    Забрать себе
                                                </button>
                                            </Show>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>

                <div class="cart-footer">
                    <Show when={() => !isShared() && isAdmin()}>
                        <button
                            type="button"
                            class="button button_secondary cart-invite-start"
                            disabled={actionsDisabled}
                            onClick={() => {
                                void handleGenerateInvite();
                            }}
                        >
                            👥 Пригласить друзей в корзину
                        </button>
                    </Show>

                    <Show
                        when={() => !isGuest()}
                        fallback={
                            <button class="button button_checkout" type="button" disabled>
                                Заказ оформит организатор
                            </button>
                        }
                    >
                        <button
                            class="button button_checkout active js-checkout-btn"
                            type="button"
                            onClick={handleCheckout}
                        >
                            <span>Оформить заказ</span>
                            <span>{totalRub}</span>
                        </button>
                    </Show>
                </div>
            </Show>

            <Show when={() => !isShared()}>
                <div class="cart-join">
                    <Show
                        when={joinOpen}
                        fallback={
                            <button type="button" class="cart-join__toggle" onClick={() => joinOpen.set(true)}>
                                🔗 Войти в корзину по коду
                            </button>
                        }
                    >
                        <div class="cart-join__row">
                            <input
                                type="text"
                                class="cart-join__input"
                                placeholder="Код приглашения"
                                autocomplete="off"
                                ref={(el: Element | null) => {
                                    joinInputEl = el as HTMLInputElement | null;
                                }}
                                onInput={(e: Event) => {
                                    joinCode.set((e.target as HTMLInputElement).value);
                                }}
                            />
                            <button
                                type="button"
                                class="cart-join__submit"
                                disabled={() => actionsDisabled() || joinCode().trim() === ''}
                                onClick={() => {
                                    void handleJoin();
                                }}
                            >
                                Войти
                            </button>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
}
