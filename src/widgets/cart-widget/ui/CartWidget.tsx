// Виджет корзины: список позиций, изменение количества, итог и переход к оформлению.
// Поддерживает совместную корзину: участники, инвайт-ссылка, владельцы позиций,
// права гостя и администратора, live-обновления через WebSocket в cartStore.
// Кнопка закрытия сохраняет класс js-close-panels для внешнего слушателя на страницах.

import './cartWidget.scss';

import { cartStore, fromMicros, type CartItem, type CartMember } from '@entities/cart';
import { userStore } from '@entities/user';
import { clearCart } from '@features/cart/clear-cart';
import {
    applyPromo,
    removeAppliedPromo,
    appliedCodeAccessor,
    promoReasonToMessage,
} from '@features/profile/manage-promos';
import { router } from '@app/router';
import { httpClient } from '@shared/api/http';
import { ROUTES } from '@shared/config/routes';
import { computed, effect, signal, useStoreSignal } from '@shared/lib/signals';
import { For, onCleanup, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';
import { lockScroll, unlockScroll } from '@shared/lib/scrollLock';
import qrcode from 'qrcode-generator';

/** Картинка-заглушка блюда при ошибке загрузки `image_url`. */
const FALLBACK_DISH_IMAGE = 'https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp';

/** Один распознанный штрихкод (минимум, который нам нужен от BarcodeDetector). */
interface DetectedBarcode {
    rawValue?: string;
}

/** Конструктор нативного BarcodeDetector (есть в Chrome/Android, нет в iOS Safari). */
interface BarcodeDetectorCtor {
    new (options?: { formats?: string[] }): {
        detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
    };
}

export interface CartWidgetProps {
    /** Колбэк после перехода к оформлению (например, чтобы закрыть боковую панель). */
    onCheckout?: () => void;
    /** Колбэк закрытия корзины. */
    onClose?: () => void;
}

/** Цена одной позиции в рублях, без дробной части. */
function formatItemPriceRub(item: CartItem) {
    return `${fromMicros(item.price).toFixed(0)}₽`;
}

/**
 * Человекочитаемая метка участника корзины относительно текущего пользователя.
 * Участник опознаётся по публичному id (UUID), подпись — по имени и роли.
 */
function memberLabel(member: CartMember, currentUserId: string | null, adminId: string | null): string {
    if (currentUserId !== null && member.public_id === currentUserId) {
        return member.public_id === adminId ? 'Вы (организатор)' : 'Вы';
    }
    if (member.public_id === adminId) return 'Организатор';
    return member.name;
}

/** Метка владельца позиции для бейджа в строке товара. */
function ownerLabel(
    ownerPublicId: string | null | undefined,
    ownerName: string | null | undefined,
    currentUserId: string | null,
    adminId: string | null,
): string {
    if (!ownerPublicId) return 'Ничьё';
    if (currentUserId !== null && ownerPublicId === currentUserId) return 'Ваше';
    if (ownerPublicId === adminId) return 'Организатор';
    return ownerName && ownerName.length > 0 ? ownerName : 'Участник';
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
    // QR-модалка с инвайт-ссылкой: открывается по нажатию на QR-кнопку.
    const qrOpen = signal<boolean>(false);
    // Модалка сканера QR (только на мобилках): открывается по кнопке-камере.
    const scanOpen = signal<boolean>(false);
    const scanError = signal<string>('');
    let scanStream: MediaStream | null = null;
    let scanRaf: number | null = null;

    // Блокируем фоновый скролл, пока открыта любая модалка корзины (QR-код или сканер).
    let cartScrollLocked = false;
    effect(() => {
        const anyOpen = qrOpen() || scanOpen();
        if (anyOpen && !cartScrollLocked) {
            lockScroll();
            cartScrollLocked = true;
        } else if (!anyOpen && cartScrollLocked) {
            unlockScroll();
            cartScrollLocked = false;
        }
    });

    // Поле ввода кода неконтролируемое: значение читаем и чистим через ref,
    // потому что проп value у этого VDOM прокидывается через setAttribute.
    let joinInputEl: HTMLInputElement | null = null;
    let promoInputEl: HTMLInputElement | null = null;
    const promoInput = signal<string>('');
    const promoOpen = signal<boolean>(false);
    const promoError = signal<string>('');

    const cartRestaurantId = useStoreSignal(cartStore, (s) => s.restaurantId);
    const cartTotalCost = useStoreSignal(cartStore, (s) => s.totalCost);
    const currentUserId = computed<string | null>(() => user()?.public_id ?? null);
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

    /**
     * Data-URL картинки QR-кода для инвайт-ссылки. type=0 включает автоподбор
     * версии под длину строки; error correction 'M' даёт запас на повреждения.
     */
    const qrDataUrl = computed<string>(() => {
        const link = inviteLink();
        if (!link) return '';
        const qr = qrcode(0, 'M');
        qr.addData(link);
        qr.make();
        return qr.createDataURL(6, 4);
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

    // Присоединяет пользователя к совместной корзине по уже распознанному токену.
    const joinWithToken = async (token: string) => {
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

    // Присоединяется по введённому коду. Принимает как «голый» токен, так и
    // полную ссылку-приглашение.
    const handleJoin = async () => {
        const raw = joinCode().trim();
        if (!raw) return;
        await joinWithToken(extractInviteToken(raw));
    };

    // Останавливает камеру и цикл распознавания сканера.
    const stopScan = () => {
        if (scanRaf !== null) {
            cancelAnimationFrame(scanRaf);
            scanRaf = null;
        }
        if (scanStream !== null) {
            scanStream.getTracks().forEach((track) => track.stop());
            scanStream = null;
        }
    };

    const closeScanner = () => {
        stopScan();
        scanOpen.set(false);
        scanError.set('');
    };

    const openScanner = () => {
        scanError.set('');
        scanOpen.set(true);
    };

    // Запускает камеру и распознавание QR на смонтированном <video>. Использует
    // нативный BarcodeDetector (Android Chrome); где его нет (iOS Safari) —
    // подсказываем ввести код вручную через поле ниже.
    const startScan = async (video: HTMLVideoElement) => {
        const DetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
            scanError.set('Камера недоступна. Введите код вручную.');
            return;
        }
        if (DetectorCtor === undefined) {
            scanError.set('Сканирование QR не поддерживается этим браузером. Введите код вручную.');
            return;
        }
        try {
            scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = scanStream;
            await video.play();
        } catch {
            scanError.set('Не удалось получить доступ к камере. Разрешите доступ или введите код вручную.');
            return;
        }
        const detector = new DetectorCtor({ formats: ['qr_code'] });
        const tick = async () => {
            if (!scanOpen.peek()) return;
            try {
                const codes = await detector.detect(video);
                if (codes.length > 0) {
                    const token = extractInviteToken(String(codes[0].rawValue ?? ''));
                    if (token) {
                        closeScanner();
                        await joinWithToken(token);
                        return;
                    }
                }
            } catch {
                // Временные ошибки детектора игнорируем и пробуем следующий кадр.
            }
            scanRaf = requestAnimationFrame(() => {
                void tick();
            });
        };
        scanRaf = requestAnimationFrame(() => {
            void tick();
        });
    };

    onCleanup(stopScan);

    const handleKick = async (member: CartMember) => {
        if (!(await Popup.confirm('Удалить участника из корзины? Его блюда останутся, но станут ничейными.'))) {
            return;
        }
        try {
            await cartStore.kickMember(member.public_id);
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
                    <button
                        type="button"
                        class="cart-close-btn js-close-panels"
                        aria-label="Закрыть корзину"
                        onClick={() => props.onClose?.()}
                    >
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
                        <For each={members} key={(m) => m.public_id}>
                            {(m) => (
                                <div class="cart-member">
                                    <span class="cart-member__dot" />
                                    <span class="cart-member__name">
                                        {() => memberLabel(m, currentUserId(), adminId())}
                                    </span>
                                    <Show when={() => isAdmin() && m.public_id !== adminId()}>
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
                                        class="button button_primary cart-invite__icon-btn"
                                        title="Копировать ссылку"
                                        onClick={() => {
                                            void handleCopyInvite();
                                        }}
                                    >
                                        <Show
                                            when={copied}
                                            fallback={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                >
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            }
                                        >
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                stroke-width="2.4"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            >
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </Show>
                                    </button>
                                    <button
                                        type="button"
                                        class="button button_secondary cart-invite__icon-btn"
                                        title="Показать QR-код"
                                        onClick={() => qrOpen.set(true)}
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm2-2h2v2h-2v-2zm2 2h2v2h-2v-2zm0-4h2v2h-2v-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        class="button button_secondary cart-invite__refresh-btn"
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
                    <For each={items} key={(item) => `${item.dish_id}:${item.owner_public_id ?? ''}`}>
                        {(item) => {
                            const dishId = item.dish_id;
                            // Позицию ищем по паре dish_id + владелец: у блюда в
                            // совместной корзине бывает по строке на участника.
                            const ownerKey = item.owner_public_id ?? '';
                            // For не перевызывает children при изменении полей позиции,
                            // поэтому актуальную позицию читаем из сигнала items на каждом
                            // тике; если позиция исчезла, держим последний снимок до размонтирования.
                            const currentItem = computed<CartItem>(
                                () =>
                                    items().find(
                                        (it) => it.dish_id === dishId && (it.owner_public_id ?? '') === ownerKey,
                                    ) ?? item,
                            );
                            const quantity = computed(() => currentItem().quantity);
                            const priceRub = computed(() => formatItemPriceRub(currentItem()));
                            const ownerText = computed(() =>
                                ownerLabel(
                                    currentItem().owner_public_id,
                                    currentItem().owner_name,
                                    currentUserId(),
                                    adminId(),
                                ),
                            );
                            // Гость правит только свои позиции, в соло-корзине ограничений нет.
                            const canModify = computed(() => {
                                if (!isShared()) return true;
                                return currentItem().owner_public_id === currentUserId();
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
                                                    currentItem().owner_public_id == null
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
                                            when={() => isShared() && currentItem().owner_public_id == null}
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

                <div class="cart-promo">
                    <Show
                        when={() => appliedCodeAccessor() !== ''}
                        fallback={
                            <Show
                                when={promoOpen}
                                fallback={
                                    <button
                                        type="button"
                                        class="cart-promo__toggle"
                                        onClick={() => promoOpen.set(true)}
                                    >
                                        🏷️ Ввести промокод
                                    </button>
                                }
                            >
                                <>
                                    <div class="cart-promo__row">
                                        <input
                                            type="text"
                                            class="cart-promo__input"
                                            placeholder="Промокод"
                                            autocomplete="off"
                                            ref={(el: Element | null) => {
                                                promoInputEl = el as HTMLInputElement | null;
                                            }}
                                            onInput={(e: Event) => {
                                                promoInput.set((e.target as HTMLInputElement).value);
                                                promoError.set('');
                                            }}
                                        />
                                        <button
                                            type="button"
                                            class="cart-promo__submit"
                                            disabled={() => promoInput().trim() === ''}
                                            onClick={async () => {
                                                const code = promoInput.peek().trim();
                                                if (!code) return;
                                                promoError.set('');
                                                try {
                                                    const resp = await httpClient.post('/promos/validate', {
                                                        code: code.toUpperCase(),
                                                        restaurant_brand_id: cartRestaurantId() ?? 0,
                                                        order_amount: cartTotalCost() ?? 0,
                                                        delivery_cost: 0,
                                                        service_fee: 0,
                                                    });
                                                    if (!resp.ok) {
                                                        promoError.set('Промокод не найден');
                                                        return;
                                                    }
                                                    const data = await resp.json();
                                                    if (!data.valid) {
                                                        promoError.set(promoReasonToMessage(data.reason ?? ''));
                                                        return;
                                                    }
                                                    applyPromo(code);
                                                    promoInput.set('');
                                                    if (promoInputEl) promoInputEl.value = '';
                                                    promoOpen.set(false);
                                                } catch {
                                                    promoError.set('Ошибка проверки промокода');
                                                }
                                            }}
                                        >
                                            Применить
                                        </button>
                                    </div>
                                    <Show when={() => promoError() !== ''}>
                                        <div class="error-msg" style="margin-top: 6px; font-size: 12px;">
                                            {promoError}
                                        </div>
                                    </Show>
                                </>
                            </Show>
                        }
                    >
                        <div class="cart-promo__applied">
                            <span class="cart-promo__badge">🏷️ {appliedCodeAccessor}</span>
                            <button type="button" class="cart-promo__remove" onClick={() => removeAppliedPromo()}>
                                ✕
                            </button>
                        </div>
                    </Show>
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
                            <div class="cart-join__entry">
                                <button type="button" class="cart-join__toggle" onClick={() => joinOpen.set(true)}>
                                    🔗 Войти в корзину по коду
                                </button>
                                <button
                                    type="button"
                                    class="cart-join__scan"
                                    aria-label="Отсканировать QR-код"
                                    title="Отсканировать QR-код"
                                    onClick={openScanner}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path
                                            d="M4 9V5.5C4 4.67 4.67 4 5.5 4H9M15 4h3.5c.83 0 1.5.67 1.5 1.5V9M20 15v3.5c0 .83-.67 1.5-1.5 1.5H15M9 20H5.5C4.67 20 4 19.33 4 18.5V15"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                        />
                                        <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" />
                                    </svg>
                                </button>
                            </div>
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

            <Show when={qrOpen}>
                <div
                    class="cart-qr-overlay"
                    onClick={(e: Event) => {
                        if (e.target === e.currentTarget) qrOpen.set(false);
                    }}
                >
                    <div class="cart-qr-modal">
                        <button
                            type="button"
                            class="cart-qr-modal__close"
                            aria-label="Закрыть"
                            onClick={() => qrOpen.set(false)}
                        >
                            ×
                        </button>
                        <div class="cart-qr-modal__title">QR-код приглашения</div>
                        <img class="cart-qr-modal__image" src={() => qrDataUrl()} alt="QR-код" />
                        <div class="cart-qr-modal__hint">Отсканируйте, чтобы присоединиться к совместной корзине</div>
                    </div>
                </div>
            </Show>

            <Show when={scanOpen}>
                <div
                    class="cart-scan-overlay"
                    onClick={(e: Event) => {
                        if (e.target === e.currentTarget) closeScanner();
                    }}
                >
                    <div class="cart-scan-modal">
                        <button
                            type="button"
                            class="cart-scan-modal__close"
                            aria-label="Закрыть"
                            onClick={closeScanner}
                        >
                            ×
                        </button>
                        <div class="cart-scan-modal__title">Сканируйте QR-код</div>
                        <div class="cart-scan-modal__viewport">
                            <video
                                class="cart-scan-modal__video"
                                muted
                                playsinline
                                ref={(el: Element | null) => {
                                    if (el !== null) void startScan(el as HTMLVideoElement);
                                }}
                            />
                            <div class="cart-scan-modal__frame" aria-hidden="true" />
                        </div>
                        <Show
                            when={() => scanError() !== ''}
                            fallback={<div class="cart-scan-modal__hint">Наведите камеру на QR-код приглашения</div>}
                        >
                            <div class="cart-scan-modal__error">{() => scanError()}</div>
                        </Show>
                    </div>
                </div>
            </Show>
        </div>
    );
}
