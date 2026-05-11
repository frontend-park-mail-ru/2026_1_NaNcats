/**
 * Главная страница со списком ресторанов в виде функционального компонента VDOM/JSX.
 *
 * Поведение перенесено из старого `HomePage.ts` 1:1: загрузка первой страницы
 * ресторанов и категорий, фильтрация по категории, поиск по запросу из адресной
 * строки, постраничная подгрузка по скроллу, мобильные шторки категорий и
 * корзины. Шапка приложения здесь не рендерится: RootLayout уже держит её
 * выше по дереву и не пересоздаёт между переходами `/`, `/restaurant` и т.д.
 *
 * Реактивная дисциплина (см. JSDoc в `vdom/show.tsx` и `vdom/h.ts`). Все
 * динамические JSX-выражения передаются как функции-аксессоры (`<For each={restaurants}/>`,
 * `<Show when={() => restaurants().length === 0}/>`). Голые `restaurants()` в
 * JSX зафиксировались бы при монтировании и реактивно не обновлялись бы.
 *
 * Локальное состояние живёт в сигналах внутри тела `HomePage`: список
 * ресторанов, выбранная категория, текущий поисковый запрос, флаги пагинации.
 * Загрузка следующей страницы навешивается на window-scroll через `onMount` и
 * снимается в `onCleanup`, чтобы при переходе на другой роут слушатель не
 * висел.
 *
 * Подмена мобильных классов на корневом `<div>` сделана через реактивный
 * аксессор в проп `class`, а не прямой записью в `element.classList`: ядро
 * VDOM перепишет атрибут только при изменении возвращаемой строки.
 */

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

/**
 * Пропсы главной страницы.
 *
 * Совпадают по форме с возвращаемым типом `load()`: роутер вычисляет props на
 * этапе загрузки роута и передаёт их в компонент через Outlet.
 */
export interface HomePageProps {
    /** Список ресторанов первой страницы выдачи. */
    restaurants: Restaurant[];
    /** Список доступных категорий для фильтра. */
    categories: Category[];
    /** Идентификатор активной категории или пустая строка, если фильтр снят. */
    activeCategory: string;
    /** Текущий поисковый запрос (уже отформатированный без пробелов по краям). */
    searchQuery: string;
}

/** Размер одной страницы выдачи ресторанов. */
const PAGE_SIZE = 20;
/** Брейкпоинт планшета: выше него мобильные шторки автоматически закрываются. */
const TABLET_BREAKPOINT = 1200;
/** Брейкпоинт мобильного устройства: ниже него работают мобильные шторки. */
const MOBILE_BREAKPOINT = 900;

/**
 * Подготавливает пропсы главной страницы перед монтированием.
 *
 * Подгружает текущего пользователя (молча проглатывая ошибки сети), для
 * авторизованного дополнительно подтягивает корзину и сохранённые адреса.
 * Параллельно запрашивает первую страницу ресторанов (с учётом исходного
 * поискового запроса из адресной строки) и список категорий.
 *
 * @returns Промис с пропсами главной страницы.
 */
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
            .then((r): void => {
                restaurants = r;
            })
            .catch((e: unknown): void => console.warn('home: initial brands fetch failed', e)),
        restaurantApi
            .listCategories()
            .then((c): void => {
                categories = c;
            })
            .catch((e: unknown): void => console.warn('home: listCategories failed', e)),
    ]);

    return { restaurants, categories, activeCategory: '', searchQuery: initialQuery };
}

/**
 * Возвращает заголовок страницы по текущим фильтрам.
 *
 * - Активная категория: имя категории.
 * - Поиск без категории: фраза "Поиск".
 * - Без фильтров: "Рестораны".
 *
 * @param categories Полный список категорий (для поиска имени по id).
 * @param activeCategoryId Идентификатор активной категории либо пустая строка.
 * @param query Текущий поисковый запрос.
 * @returns Заголовок для отображения в шапке листинга.
 */
function buildTitle(categories: Category[], activeCategoryId: string, query: string): string {
    if (activeCategoryId) {
        return categories.find((c) => c.id === activeCategoryId)?.name ?? activeCategoryId;
    }
    if (query) return 'Поиск';
    return 'Рестораны';
}

/**
 * Главная страница: список ресторанов с фильтрами и пагинацией.
 *
 * Внутри функции заводятся сигналы локального состояния и обработчики событий.
 * Возвращает VNode-дерево разметки страницы: сайдбар категорий, центральный
 * блок со списком и сайдбар со страйком и корзиной.
 *
 * @param props Пропсы страницы (результат `load()`).
 * @returns VNode-дерево разметки страницы.
 */
export function HomePage(props: HomePageProps): VNode {
    /** Текущий список ресторанов на странице. */
    const restaurants = signal<Restaurant[]>(props.restaurants);
    /** Идентификатор активной категории или пустая строка, если фильтр снят. */
    const activeCategory = signal<string>(props.activeCategory);
    /** Текущий поисковый запрос. */
    const searchQuery = signal<string>(props.searchQuery);
    /** Offset для пагинации (актуален только в режиме без фильтров). */
    const offset = signal<number>(props.restaurants.length);
    /** Флаг наличия следующей страницы (актуален только в режиме без фильтров). */
    const hasMore = signal<boolean>(props.restaurants.length === PAGE_SIZE);
    /** Идёт ли сейчас запрос следующей страницы. */
    const isFetching = signal<boolean>(false);
    /** Открыта ли мобильная шторка категорий. */
    const categoriesOpen = signal<boolean>(false);
    /** Открыт ли мобильный лист корзины. */
    const cartOpen = signal<boolean>(false);
    /** Реактивный аксессор пользователя: нужен, чтобы Streak показывался только для авторизованных. */
    const user = useStoreSignal(userStore, (s) => s.user);

    /**
     * Перезапрашивает выдачу ресторанов с учётом текущих фильтра по категории
     * и поискового запроса.
     *
     * Включает пагинацию только в "чистом" режиме (без фильтров): иначе offset
     * смешался бы с клиентским filter и поведение поехало бы. При комбинации
     * запроса и категории бэк отдельным эндпоинтом такое сочетание не умеет,
     * поэтому берётся выдача по категории с большим лимитом и фильтруется на
     * клиенте по подстроке в названии/описании.
     */
    const refreshGrid = async (): Promise<void> => {
        const q = searchQuery();
        const cat = activeCategory();

        offset.set(0);
        hasMore.set(false);

        let results: Restaurant[] = [];

        if (!q && !cat) {
            results = await restaurantApi.listBrands(PAGE_SIZE, 0).catch((): Restaurant[] => []);
            offset.set(results.length);
            hasMore.set(results.length === PAGE_SIZE);
        } else if (q && !cat) {
            results = await restaurantApi.search(q, PAGE_SIZE).catch((): Restaurant[] => []);
        } else if (!q && cat) {
            results = await restaurantApi.listBrandsByCategory(cat, PAGE_SIZE, 0).catch((): Restaurant[] => []);
        } else {
            const COMBINED_LIMIT = 100;
            const inCat = await restaurantApi
                .listBrandsByCategory(cat, COMBINED_LIMIT, 0)
                .catch((): Restaurant[] => []);
            const needle = q.toLowerCase();
            results = inCat.filter((r) => {
                const name = (r.name ?? '').toLowerCase();
                const desc = (r.description ?? '').toLowerCase();
                return name.includes(needle) || desc.includes(needle);
            });
        }

        restaurants.set(results);
    };

    /**
     * Переключает активную категорию: повторный клик по активной категории
     * сбрасывает фильтр.
     *
     * @param id Идентификатор категории либо пустая строка для сброса.
     */
    const selectCategory = async (id: string): Promise<void> => {
        if (id === '' || activeCategory() === id) {
            activeCategory.set('');
        } else {
            activeCategory.set(id);
        }
        await refreshGrid();
    };

    /**
     * Открывает шторку категорий и закрывает лист корзины.
     */
    const openCategoriesDrawer = (): void => {
        categoriesOpen.set(true);
        cartOpen.set(false);
    };

    /**
     * Открывает лист корзины и закрывает шторку категорий.
     */
    const openCartSheet = (): void => {
        cartOpen.set(true);
        categoriesOpen.set(false);
    };

    /**
     * Закрывает обе мобильные панели.
     */
    const closePanels = (): void => {
        categoriesOpen.set(false);
        cartOpen.set(false);
    };

    /**
     * Обработчик скролла окна: подгружает следующую страницу ресторанов при
     * приближении к низу. Игнорируется при активных фильтрах (поиск или
     * категория) и пока идёт предыдущий запрос либо больше нет данных.
     */
    const handleScroll = async (): Promise<void> => {
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

    /**
     * Document-level keydown: Escape закрывает мобильные панели.
     *
     * @param e Событие keydown.
     */
    const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') closePanels();
    };

    /**
     * Window resize: при росте ширины окна выше брейкпоинтов автоматически
     * скрываем открытые мобильные панели, чтобы они не остались висеть на
     * десктопе.
     */
    const handleResize = (): void => {
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
            class={(): string => {
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

            <button
                type="button"
                class="category-fab"
                aria-label="Открыть категории"
                onClick={openCategoriesDrawer}
            >
                <svg
                    class="category-fab__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
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
                    <path
                        d="M14.2 9.2H19.6"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M16.9 9.2L16.5 19.2C16.47 20.06 17.15 20.8 18.01 20.8C18.87 20.8 19.55 20.08 19.52 19.22L19.1 9.2"
                        stroke="#FFC1C1"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                </svg>
            </button>

            <button
                type="button"
                class="cart-fab"
                aria-label="Открыть корзину"
                onClick={openCartSheet}
            >
                <svg
                    class="cart-fab__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
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
                                class={(): string =>
                                    activeCategory() === ''
                                        ? 'category-item category-item_active'
                                        : 'category-item'
                                }
                                tabindex="0"
                                role="button"
                                onClick={(): void => {
                                    void selectCategory('');
                                    if (window.innerWidth <= MOBILE_BREAKPOINT) closePanels();
                                }}
                                onKeyDown={(e: Event): void => {
                                    const ke = e as KeyboardEvent;
                                    if (ke.key !== 'Enter' && ke.key !== ' ') return;
                                    ke.preventDefault();
                                    void selectCategory('');
                                }}
                            >
                                <span class="category-item__icon">🍽️</span>
                                <span class="category-item__name">Все рестораны</span>
                            </div>
                            <For each={(): readonly Category[] => props.categories} key={(c) => c.id}>
                                {(cat: Category): VNode => (
                                    <div
                                        class={(): string =>
                                            activeCategory() === cat.id
                                                ? 'category-item category-item_active'
                                                : 'category-item'
                                        }
                                        tabindex="0"
                                        role="button"
                                        onClick={(): void => {
                                            void selectCategory(cat.id);
                                            if (window.innerWidth <= MOBILE_BREAKPOINT) closePanels();
                                        }}
                                        onKeyDown={(e: Event): void => {
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
                                {(): string =>
                                    buildTitle(props.categories, activeCategory(), searchQuery())
                                }
                            </h1>
                        </div>

                        <Show when={(): boolean => searchQuery() !== ''}>
                            <div class="search-results-label" style="display: block">
                                {(): string => `Найдено по запросу «${searchQuery()}»`}
                            </div>
                        </Show>

                        <div class="res-grid">
                            <For
                                each={restaurants}
                                key={(r: Restaurant): string | number => r.id}
                            >
                                {(r: Restaurant): VNode => (
                                    <div
                                        class="res-card"
                                        onClick={(): void => {
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
                                            <span class="res-card__desc">
                                                {r.description ?? 'Вкусная еда'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>

                        <Show when={(): boolean => restaurants().length === 0}>
                            <div class="res-empty" style="display: flex">
                                <p class="res-empty__text">Ничего не найдено 😔</p>
                                <p class="res-empty__hint">
                                    Попробуйте изменить запрос или выбрать другую категорию
                                </p>
                            </div>
                        </Show>
                    </div>
                </main>

                <aside class="side-column side-column_right">
                    <Show when={(): boolean => user() !== null}>
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
    ) as VNode;
}
