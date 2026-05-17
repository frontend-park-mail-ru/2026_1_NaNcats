// Стили шапки пока живут в home.scss.
// eslint-disable-next-line no-restricted-imports
import '@pages/home/ui/home.scss';

import type { User } from '@entities/user';
import { restaurantApi, type SearchAllResult } from '@entities/restaurant';
import { logoutAction } from '@features/auth/logout';
import { router, Link } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { getQueryParam } from '@shared/lib/url/searchParams';
import { effect, onCleanup, signal } from '@shared/lib/signals';
import { For, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Logo } from '@shared/ui/logo';
import { imageFallback } from '@shared/lib/img';

/** `default` - шапка с поиском и адресом, `back` - с кнопкой возврата. */
export type HeaderMode = 'default' | 'back';

export interface HeaderProps {
    /** Сигнал-аксессор текущего пользователя или null, если он не авторизован. */
    user: () => User | null;
    /** Режим отображения. Аксессор-форма позволяет менять режим без перемонтажа Header. */
    mode?: HeaderMode | (() => HeaderMode);
    /** Текущий поисковый запрос (для предзаполнения инпута). */
    searchQuery?: string;
    /** Скрыть блок поиска. Аксессор-форма позволяет скрывать реактивно. */
    hideSearch?: boolean | (() => boolean);
    /** Колбэк нажатия кнопки входа. */
    onLogin?: () => void;
    /** Колбэк нажатия кнопки регистрации. */
    onRegister?: () => void;
    /** Колбэк успешного выхода из аккаунта. */
    onLoggedOut?: () => void;
    /** Колбэк нажатия кнопки возврата (актуально для mode === 'back'). */
    onBack?: () => void;
    /** Колбэк отправки поискового запроса (по Enter или по очистке). */
    onSearchSubmit?: (query: string) => void;
}

const SEARCH_DEBOUNCE_MS = 350;

/** Переход на страницу ресторана (с опциональным якорем на блюдо). */
function navigateToRestaurant(restaurantId: string | number, dishId?: string | number) {
    const base = `${ROUTES.restaurant}?id=${encodeURIComponent(String(restaurantId))}`;
    const url = dishId !== undefined ? `${base}&dish=${encodeURIComponent(String(dishId))}` : base;
    void router.go(url);
}

/** Шапка приложения: логотип, адрес, поиск, блок авторизации. */
export function Header(props: HeaderProps): VNode {
    const searchValue = signal<string>(props.searchQuery ?? '');
    const suggestOpen = signal<boolean>(false);
    const suggestResults = signal<SearchAllResult | null>(null);
    const mobileMenuOpen = signal<boolean>(false);

    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    // Узлы нужны для определения "клик вне" и для прямого сброса значения инпута.
    let headerEl: HTMLElement | null = null;
    let searchInputEl: HTMLInputElement | null = null;
    let suggestEl: HTMLElement | null = null;

    // Header живёт в shell-е и переживает навигацию между страницами, поэтому
    // searchValue нужно синхронизировать с URL: иначе после поиска и возврата
    // на главную в поле остаётся старый запрос, а крестик не пропадает.
    // Зависим только от смены маршрута; searchValue читаем через peek, чтобы
    // ввод пользователя не перетирался этим эффектом.
    effect(() => {
        router.currentRoute();
        const queryFromUrl = getQueryParam('q')?.trim() ?? '';
        if (queryFromUrl !== searchValue.peek()) {
            searchValue.set(queryFromUrl);
            if (searchInputEl !== null) {
                searchInputEl.value = queryFromUrl;
            }
        }
    });

    // Запрос подсказок с дебаунсом; при пустом запросе подсказки скрываются.
    const scheduleSuggest = (query: string) => {
        if (searchTimer !== null) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
        if (!query) {
            suggestResults.set(null);
            suggestOpen.set(false);
            return;
        }
        searchTimer = setTimeout(async () => {
            searchTimer = null;
            try {
                const results = await restaurantApi.searchAll(query, 5);
                suggestResults.set(results);
                const total = results.restaurants.length + results.dishes.length;
                suggestOpen.set(total > 0);
            } catch {
                // Ошибка сети не критична: просто не показываем подсказки.
            }
        }, SEARCH_DEBOUNCE_MS);
    };

    // Финальный поиск: через onSearchSubmit либо переходом на главную с ?q=.
    const submitSearch = (query: string) => {
        if (props.onSearchSubmit) {
            props.onSearchSubmit(query);
            return;
        }
        const url = query ? `${ROUTES.home}?q=${encodeURIComponent(query)}` : ROUTES.home;
        void router.go(url);
    };

    const handleSearchInput = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const next = target.value;
        searchValue.set(next);
        scheduleSuggest(next.trim());
    };

    // Enter подтверждает запрос, Escape закрывает подсказки (значение не сбрасывает).
    const handleSearchKeyDown = (event: Event) => {
        const ke = event as KeyboardEvent;
        if (ke.key === 'Enter') {
            if (searchTimer !== null) {
                clearTimeout(searchTimer);
                searchTimer = null;
            }
            suggestOpen.set(false);
            submitSearch(searchValue().trim());
        } else if (ke.key === 'Escape') {
            suggestOpen.set(false);
        }
    };

    // Сброс поиска. Значение инпута пишем напрямую: VDOM прокидывает `value`
    // через setAttribute, который меняет дефолтное значение, а не текущее.
    const handleSearchClear = () => {
        searchValue.set('');
        if (searchInputEl !== null) {
            searchInputEl.value = '';
        }
        suggestResults.set(null);
        suggestOpen.set(false);
        if (searchTimer !== null) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
        submitSearch('');
    };

    // Клик по документу: закрывает подсказки и мобильное гостевое меню при клике вне их зоны.
    const handleDocClick = (event: Event) => {
        const target = event.target as Node | null;
        if (!target) return;

        // Подсказки закрываются по клику вне инпута и вне самих подсказок.
        if (suggestOpen()) {
            const insideInput = searchInputEl !== null && searchInputEl.contains(target);
            const insideSuggest = suggestEl !== null && suggestEl.contains(target);
            if (!insideInput && !insideSuggest) {
                suggestOpen.set(false);
            }
        }

        // Мобильное гостевое меню закрывается по клику вне самой шапки.
        if (mobileMenuOpen()) {
            if (headerEl !== null && !headerEl.contains(target)) {
                mobileMenuOpen.set(false);
            }
        }
    };

    const handleBackClick = () => {
        if (props.onBack) {
            props.onBack();
            return;
        }
        window.history.back();
    };

    const handleLoginClick = () => {
        mobileMenuOpen.set(false);
        props.onLogin?.();
    };

    const handleRegisterClick = () => {
        mobileMenuOpen.set(false);
        props.onRegister?.();
    };

    // stopPropagation, чтобы клик по документу не закрыл меню сразу после открытия.
    const handleMobileToggle = (event: Event) => {
        event.stopPropagation();
        mobileMenuOpen.set((prev) => !prev);
    };

    const handleLogout = async () => {
        try {
            await logoutAction();
            props.onLoggedOut?.();
        } catch (err) {
            console.error('[Header] logout failed:', err);
        }
    };

    onMount(() => {
        document.addEventListener('click', handleDocClick);
    });

    onCleanup(() => {
        document.removeEventListener('click', handleDocClick);
        if (searchTimer !== null) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
    });

    return (
        <header
            class="header"
            ref={(el: Element | null) => {
                headerEl = el as HTMLElement | null;
            }}
        >
            <Show when={() => (typeof props.mode === 'function' ? props.mode() : props.mode) === 'back'}>
                <button class="button header__back-btn" type="button" aria-label="Назад" onClick={handleBackClick}>
                    <svg class="back-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            d="M15 6l-6 6 6 6"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    <span class="back-btn__text">Назад</span>
                </button>
            </Show>

            <div
                class={() =>
                    (typeof props.mode === 'function' ? props.mode() : props.mode) === 'back'
                        ? 'logo-container logo-container_centered'
                        : 'logo-container'
                }
                role="button"
                tabindex="0"
                onClick={() => {
                    void router.go(ROUTES.home);
                }}
            >
                <Logo />
            </div>

            <Show when={() => !(typeof props.hideSearch === 'function' ? props.hideSearch() : props.hideSearch)}>
                <div class="search-bar">
                    <div class="search-bar__group search-bar__group_main">
                        <div class="search-bar__icon">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path
                                    d="M4.95838 9.90982C3.57524 9.90982 2.40291 9.42961 1.4414 8.46918C0.480467 7.50933 0 6.3379 0 4.95491C0 3.57192 0.480467 2.40021 1.4414 1.43978C2.40233 0.47935 3.57466 -0.000575969 4.95838 5.18735e-07C6.3421 0.000577006 7.51414 0.480791 8.4745 1.44064C9.43486 2.40049 9.91533 3.57192 9.9159 4.95491C9.9159 5.55561 9.80948 6.137 9.59665 6.69907C9.38381 7.26115 9.10407 7.74194 8.75742 8.14145L13.8698 13.2494C13.9506 13.3301 13.9938 13.4296 13.9996 13.5477C14.0048 13.6648 13.9615 13.7694 13.8698 13.8616C13.7775 13.9539 13.6754 14 13.5635 14C13.4516 14 13.3495 13.9539 13.2573 13.8616L8.14573 8.75281C7.71314 9.12119 7.21566 9.40626 6.65328 9.60803C6.09091 9.8098 5.52566 9.91069 4.95752 9.91069M4.95752 9.04595C6.10533 9.04595 7.07463 8.65106 7.86541 7.86127C8.65561 7.07149 9.05072 6.1027 9.05072 4.95491C9.05072 3.80712 8.6559 2.83863 7.86627 2.04941C7.07665 1.2602 6.10764 0.865308 4.95925 0.864732C3.81086 0.864732 2.84156 1.25963 2.05136 2.04941C1.26115 2.8392 0.865763 3.8077 0.865187 4.95491C0.86461 6.10212 1.25971 7.07062 2.05049 7.86041C2.84127 8.6502 3.81028 9.04509 4.95752 9.04509"
                                    fill="#7D7D7D"
                                />
                            </svg>
                        </div>
                        <input
                            type="text"
                            class="search-bar__input"
                            placeholder="Найти ресторан, блюдо или товар"
                            autocomplete="off"
                            value={props.searchQuery ?? ''}
                            onInput={handleSearchInput}
                            onKeyDown={handleSearchKeyDown}
                            ref={(el: Element | null) => {
                                searchInputEl = el as HTMLInputElement | null;
                            }}
                        />
                        <Show when={() => searchValue().trim().length > 0}>
                            <button
                                type="button"
                                class="search-bar__clear"
                                aria-label="Очистить"
                                onClick={handleSearchClear}
                            >
                                ×
                            </button>
                        </Show>
                    </div>

                    <Show
                        when={() => {
                            if (!suggestOpen()) return false;
                            const r = suggestResults();
                            if (!r) return false;
                            return r.restaurants.length + r.dishes.length > 0;
                        }}
                    >
                        <div
                            class="search-suggest"
                            style="display: block"
                            ref={(el: Element | null) => {
                                suggestEl = el as HTMLElement | null;
                            }}
                        >
                            <For each={() => suggestResults()?.restaurants ?? []} key={(r) => `r-${String(r.id)}`}>
                                {(r) => (
                                    <div
                                        class="search-suggest__item"
                                        onClick={() => {
                                            suggestOpen.set(false);
                                            navigateToRestaurant(r.id);
                                        }}
                                    >
                                        <span class="search-suggest__icon">🏠</span>
                                        <span class="search-suggest__name">{r.name}</span>
                                    </div>
                                )}
                            </For>
                            <For each={() => suggestResults()?.dishes ?? []} key={(d) => `d-${String(d.id)}`}>
                                {(d) => (
                                    <div
                                        class="search-suggest__item"
                                        onClick={() => {
                                            suggestOpen.set(false);
                                            navigateToRestaurant(d.restaurant_brand_id, d.id);
                                        }}
                                    >
                                        <span class="search-suggest__icon">🍽</span>
                                        <span class="search-suggest__name">{d.name}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
            </Show>

            <div class="header__controls">
                <Show
                    when={props.user}
                    fallback={
                        <>
                            <div class="auth-guest-controls">
                                <button class="button button_header-login" onClick={handleLoginClick}>
                                    Войти
                                </button>
                                <button class="button button_header-reg" onClick={handleRegisterClick}>
                                    Регистрация
                                </button>
                            </div>
                            <div
                                class={() =>
                                    mobileMenuOpen()
                                        ? 'mobile-auth-guest-controls mobile-auth-guest-controls_open'
                                        : 'mobile-auth-guest-controls'
                                }
                            >
                                <button
                                    type="button"
                                    class="mobile-auth-guest-controls__trigger"
                                    aria-label="Открыть меню авторизации"
                                    onClick={handleMobileToggle}
                                >
                                    <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="25" cy="25" r="13" stroke="#FFC1C1" stroke-width="2" fill="none" />
                                        <circle cx="20" cy="25" r="1.5" fill="#FFC1C1" />
                                        <circle cx="25" cy="25" r="1.5" fill="#FFC1C1" />
                                        <circle cx="30" cy="25" r="1.5" fill="#FFC1C1" />
                                    </svg>
                                </button>
                                <div class="mobile-auth-guest-controls__menu">
                                    <button
                                        class="mobile-auth-guest-controls__item"
                                        type="button"
                                        onClick={handleLoginClick}
                                    >
                                        Войти
                                    </button>
                                    <button
                                        class="mobile-auth-guest-controls__item"
                                        type="button"
                                        onClick={handleRegisterClick}
                                    >
                                        Регистрация
                                    </button>
                                </div>
                            </div>
                        </>
                    }
                >
                    <div class="notif-btn">
                        <div class="notif-btn__icon">
                            <svg width="21" height="24" viewBox="0 0 21 24" fill="none">
                                <path
                                    d="M10.5422 23.89C11.6667 23.89 12.5714 22.9852 12.5714 21.8608H8.513C8.513 22.9852 9.41776 23.89 10.5422 23.89ZM18.6589 16.7878V10.7003C18.6589 7.54519 16.9748 4.88725 14.0933 4.18721V3.59554C14.0933 1.63751 12.5002 0.0444336 10.5422 0.0444336C8.58414 0.0444336 6.99105 1.63751 6.99105 3.59554V4.18721C4.10955 4.88725 2.42546 7.53504 2.42546 10.7003V16.7878L0.396286 18.8169V19.8315H20.6881V18.8169L18.6589 16.7878ZM16.6297 17.8024H4.45463V10.7003C4.45463 8.01188 6.07792 5.62804 8.513 5.62804H12.5714C15.0065 5.62804 16.6297 8.01188 16.6297 10.7003V17.8024Z"
                                    fill="#FFC1C1"
                                />
                            </svg>
                        </div>
                    </div>
                    <div class="user-menu-wrapper">
                        <Link to={ROUTES.profile} class="user-profile">
                            <img
                                src={() => props.user()?.avatar_url ?? ''}
                                class="user-profile__avatar"
                                onError={imageFallback(
                                    'https://nancats-bucket.storage.yandexcloud.net/avatars/default-avatar.webp',
                                )}
                            />
                        </Link>
                        <div class="user-dropdown">
                            <button
                                class="user-dropdown__logout"
                                type="button"
                                onClick={() => {
                                    void handleLogout();
                                }}
                            >
                                Выйти
                            </button>
                        </div>
                    </div>
                </Show>
            </div>
        </header>
    );
}
