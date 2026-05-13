// Главная страница: список ресторанов с фильтром по категориям, поиском и пагинацией по скроллу.

import './home.scss';

import { router } from '@app/router';
import { ROUTES } from '@shared/config/routes';
import { getQueryParam } from '@shared/lib/url/searchParams';
import { onCleanup, signal, useStoreSignal } from '@shared/lib/signals';
import { For, onMount, Show } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { restaurantApi, type Category, type Restaurant } from '@entities/restaurant';
import { userStore } from '@entities/user';
import { addressStore } from '@entities/address';
import { cartStore } from '@entities/cart';
import { CartWidget } from '@widgets/cart-widget';
import { Streak } from '@widgets/streak';

export interface HomePageProps {
    /** Рестораны первой страницы выдачи. */
    restaurants: Restaurant[];
    /** Доступные категории для фильтра. */
    categories: Category[];
    /** Идентификатор активной категории или пустая строка, если фильтр снят. */
    activeCategory: string;
    /** Текущий поисковый запрос (без пробелов по краям). */
    searchQuery: string;
}

/** Размер страницы выдачи ресторанов. */
const PAGE_SIZE = 20;
/** Выше этой ширины мобильные шторки автоматически закрываются. */
const TABLET_BREAKPOINT = 1200;
/** Ниже этой ширины работают мобильные шторки. */
const MOBILE_BREAKPOINT = 900;

/** Loader: грузит пользователя (и корзину/адреса для авторизованного), первую страницу ресторанов и категории. */
export async function load(): Promise<HomePageProps> {
    try {
        await userStore.loadCurrent();
    } catch (e) {
        console.warn('home: loadCurrent failed', e);
    }

    const isAuth = userStore.getState().user !== null;

    const tasks: Promise<unknown>[] = [];
    if (isAuth) {
        tasks.push(cartStore.load());
        tasks.push(addressStore.loadSaved());
    }
    await Promise.all(tasks);

    const initialQuery = getQueryParam('q')?.trim() ?? '';

    let restaurants: Restaurant[] = [];
    let categories: Category[] = [];

    await Promise.all([
        (initialQuery ? restaurantApi.search(initialQuery, PAGE_SIZE) : restaurantApi.listBrands(PAGE_SIZE, 0))
            .then((r) => {
                restaurants = r;
            })
            .catch((e) => console.warn('home: initial brands fetch failed', e)),
        restaurantApi
            .listCategories()
            .then((c) => {
                categories = c;
            })
            .catch((e) => console.warn('home: listCategories failed', e)),
    ]);

    return { restaurants, categories, activeCategory: '', searchQuery: initialQuery };
}

// Заголовок листинга: имя категории, либо "Поиск", либо "Рестораны".
function buildTitle(categories: Category[], activeCategoryId: string, query: string): string {
    if (activeCategoryId) {
        return categories.find((c) => c.id === activeCategoryId)?.name ?? activeCategoryId;
    }
    if (query) return 'Поиск';
    return 'Рестораны';
}

export function HomePage(props: HomePageProps): VNode {
    const restaurants = signal<Restaurant[]>(props.restaurants);
    const activeCategory = signal<string>(props.activeCategory);
    const searchQuery = signal<string>(props.searchQuery);
    // offset/hasMore актуальны только в режиме без фильтров.
    const offset = signal<number>(props.restaurants.length);
    const hasMore = signal<boolean>(props.restaurants.length === PAGE_SIZE);
    const isFetching = signal<boolean>(false);
    const categoriesOpen = signal<boolean>(false);
    const cartOpen = signal<boolean>(false);
    const user = useStoreSignal(userStore, (s) => s.user);

    // Перезапрашивает выдачу по текущим фильтрам. Пагинация работает только без фильтров;
    // комбинацию "запрос + категория" бэк не умеет, поэтому берём категорию с большим лимитом
    // и фильтруем на клиенте по подстроке в названии/описании.
    const refreshGrid = async () => {
        const q = searchQuery();
        const cat = activeCategory();

        offset.set(0);
        hasMore.set(false);

        let results: Restaurant[] = [];

        if (!q && !cat) {
            results = await restaurantApi.listBrands(PAGE_SIZE, 0).catch(() => []);
            offset.set(results.length);
            hasMore.set(results.length === PAGE_SIZE);
        } else if (q && !cat) {
            results = await restaurantApi.search(q, PAGE_SIZE).catch(() => []);
        } else if (!q && cat) {
            results = await restaurantApi.listBrandsByCategory(cat, PAGE_SIZE, 0).catch(() => []);
        } else {
            const COMBINED_LIMIT = 100;
            const inCat = await restaurantApi.listBrandsByCategory(cat, COMBINED_LIMIT, 0).catch(() => []);
            const needle = q.toLowerCase();
            results = inCat.filter((r) => {
                const name = (r.name ?? '').toLowerCase();
                const desc = (r.description ?? '').toLowerCase();
                return name.includes(needle) || desc.includes(needle);
            });
        }

        restaurants.set(results);
    };

    // Повторный клик по активной категории сбрасывает фильтр.
    const selectCategory = async (id: string) => {
        if (id === '' || activeCategory() === id) {
            activeCategory.set('');
        } else {
            activeCategory.set(id);
        }
        await refreshGrid();
    };

    const openCategoriesDrawer = () => {
        categoriesOpen.set(true);
        cartOpen.set(false);
    };

    const openCartSheet = () => {
        cartOpen.set(true);
        categoriesOpen.set(false);
    };

    const closePanels = () => {
        categoriesOpen.set(false);
        cartOpen.set(false);
    };

    // Подгружает следующую страницу при приближении к низу; пропускается при фильтрах и во время запроса.
    const handleScroll = async () => {
        if (isFetching() || !hasMore() || searchQuery() || activeCategory()) return;

        const doc = document.documentElement;
        const distanceFromBottom = doc.scrollHeight - doc.scrollTop - doc.clientHeight;
        if (distanceFromBottom > 200) return;

        isFetching.set(true);
        try {
            const next = await restaurantApi.listBrands(PAGE_SIZE, offset());
            restaurants.set((prev) => [...prev, ...next]);
            offset.set((prev) => prev + next.length);
            if (next.length < PAGE_SIZE) hasMore.set(false);
        } catch (e) {
            console.error('home: paginate failed', e);
        } finally {
            isFetching.set(false);
        }
    };

    // Escape закрывает мобильные панели.
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closePanels();
    };

    // При росте ширины окна закрываем открытые мобильные панели, чтобы они не висели на десктопе.
    const handleResize = () => {
        const width = window.innerWidth;
        if (width > TABLET_BREAKPOINT) {
            closePanels();
            return;
        }
        if (width > MOBILE_BREAKPOINT) {
            categoriesOpen.set(false);
        }
    };

    onMount(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleResize);
    });

    onCleanup(() => {
        window.removeEventListener('scroll', handleScroll);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', handleResize);
    });

    return (
        <div
            class={() => {
                const classes = ['page-wrapper', 'home-page'];
                if (categoriesOpen()) classes.push('home-page_drawer-categories');
                if (cartOpen()) classes.push('home-page_sheet-cart');
                return classes.join(' ');
            }}
        >
            <div class="mobile-toolbar">
                <button type="button" class="mobile-toolbar__btn" onClick={openCategoriesDrawer}>
                    Категории
                </button>
            </div>

            <button type="button" class="category-fab" aria-label="Открыть категории" onClick={openCategoriesDrawer}>
                <svg class="category-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M7.2 3.5C5.55 3.5 4.2 4.85 4.2 6.5C4.2 8.15 5.55 9.5 7.2 9.5C8.85 9.5 10.2 8.15 10.2 6.5C10.2 4.85 8.85 3.5 7.2 3.5Z"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                    />
                    <path
                        d="M6.1 9.2L5.7 19.2C5.67 20.06 6.35 20.8 7.21 20.8C8.07 20.8 8.75 20.08 8.72 19.22L8.3 9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M16.9 3.7V9.2M14.4 3.7V9.2M19.4 3.7V9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path d="M14.2 9.2H19.6" stroke="#FFC1C1" stroke-width="1.8" stroke-linecap="round" />
                    <path
                        d="M16.9 9.2L16.5 19.2C16.47 20.06 17.15 20.8 18.01 20.8C18.87 20.8 19.55 20.08 19.52 19.22L19.1 9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                </svg>
            </button>

            <button type="button" class="cart-fab" aria-label="Открыть корзину" onClick={openCartSheet}>
                <svg class="cart-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M4 5H5.4C6.1 5 6.42 5.27 6.58 5.86L6.94 7.2M6.94 7.2H18.6C19.58 7.2 20.18 8.02 19.92 8.96L18.84 12.86C18.64 13.58 17.98 14.08 17.24 14.08H9.18C8.38 14.08 7.69 13.54 7.5 12.76L6.94 7.2Z"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M9.6 18.2C10.2627 18.2 10.8 17.6627 10.8 17C10.8 16.3373 10.2627 15.8 9.6 15.8C8.93726 15.8 8.4 16.3373 8.4 17C8.4 17.6627 8.93726 18.2 9.6 18.2Z"
                        fill="#FFC1C1"
                    />
                    <path
                        d="M17.1 18.2C17.7627 18.2 18.3 17.6627 18.3 17C18.3 16.3373 17.7627 15.8 17.1 15.8C16.4373 15.8 15.9 16.3373 15.9 17C15.9 17.6627 16.4373 18.2 17.1 18.2Z"
                        fill="#FFC1C1"
                    />
                </svg>
            </button>

            <div class="mobile-overlay" onClick={closePanels} />

            <div class="main-layout">
                <aside class="side-column side-column_left">
                    <div class="card card_categories">
                        <div class="mobile-panel-header">
                            <h2 class="sidebar-title">Категории</h2>
                            <button
                                type="button"
                                class="mobile-panel-close"
                                aria-label="Закрыть категории"
                                onClick={closePanels}
                            >
                                ×
                            </button>
                        </div>

                        <h2 class="sidebar-title sidebar-title_desktop">Категории</h2>

                        <div class="categories-list">
                            <div
                                class={() =>
                                    activeCategory() === '' ? 'category-item category-item_active' : 'category-item'
                                }
                                tabindex="0"
                                role="button"
                                onClick={() => {
                                    void selectCategory('');
                                    if (window.innerWidth <= MOBILE_BREAKPOINT) closePanels();
                                }}
                                onKeyDown={(e: Event) => {
                                    const ke = e as KeyboardEvent;
                                    if (ke.key !== 'Enter' && ke.key !== ' ') return;
                                    ke.preventDefault();
                                    void selectCategory('');
                                }}
                            >
                                <span class="category-item__icon">🍽️</span>
                                <span class="category-item__name">Все рестораны</span>
                            </div>
                            <For each={() => props.categories} key={(c) => c.id}>
                                {(cat) => (
                                    <div
                                        class={() =>
                                            activeCategory() === cat.id
                                                ? 'category-item category-item_active'
                                                : 'category-item'
                                        }
                                        tabindex="0"
                                        role="button"
                                        onClick={() => {
                                            void selectCategory(cat.id);
                                            if (window.innerWidth <= MOBILE_BREAKPOINT) closePanels();
                                        }}
                                        onKeyDown={(e: Event) => {
                                            const ke = e as KeyboardEvent;
                                            if (ke.key !== 'Enter' && ke.key !== ' ') return;
                                            ke.preventDefault();
                                            void selectCategory(cat.id);
                                        }}
                                    >
                                        <span class="category-item__icon">{cat.emoji}</span>
                                        <span class="category-item__name">{cat.name}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </aside>

                <main class="center-column">
                    <div class="sheet">
                        <div class="sheet__header">
                            <h1 class="sheet__title">
                                {() => buildTitle(props.categories, activeCategory(), searchQuery())}
                            </h1>
                        </div>

                        <Show when={() => searchQuery() !== ''}>
                            <div class="search-results-label" style="display: block">
                                {() => `Найдено по запросу «${searchQuery()}»`}
                            </div>
                        </Show>

                        <div class="res-grid">
                            <For each={restaurants} key={(r) => r.id}>
                                {(r) => (
                                    <div
                                        class="res-card"
                                        onClick={() => {
                                            void router.go(
                                                `${ROUTES.restaurant}?id=${encodeURIComponent(String(r.id))}`,
                                            );
                                        }}
                                    >
                                        <img
                                            class="res-card__rect"
                                            src={r.logo_url}
                                            alt={r.name}
                                            onerror={`this.src='https://placehold.co/400x225/png?text=${encodeURIComponent(r.name)}'`}
                                        />
                                        <div class="res-card__info">
                                            <span class="res-card__name">{r.name}</span>
                                            <span class="res-card__desc">{r.description ?? 'Вкусная еда'}</span>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>

                        <Show when={() => restaurants().length === 0}>
                            <div class="res-empty" style="display: flex">
                                <p class="res-empty__text">Ничего не найдено 😔</p>
                                <p class="res-empty__hint">Попробуйте изменить запрос или выбрать другую категорию</p>
                            </div>
                        </Show>
                    </div>
                </main>

                <aside class="side-column side-column_right">
                    <Show when={() => user() !== null}>
                        <div class="card card_streak_points">
                            <Streak />
                        </div>
                    </Show>

                    <div class="card card_cart">
                        <div class="cart-slot">
                            <CartWidget />
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
