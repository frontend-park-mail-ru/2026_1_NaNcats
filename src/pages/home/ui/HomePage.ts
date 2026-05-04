import './home.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { getQueryParam } from '@shared/lib/url/searchParams';
import { restaurantApi, type Restaurant, type Category } from '@entities/restaurant';
import { userStore } from '@entities/user';
import { addressStore } from '@entities/address';
import { cartStore } from '@entities/cart';
import { Header } from '@widgets/header';
import { Streak } from '@widgets/streak';
import { CartWidget } from '@widgets/cart-widget';
import { AddressPicker } from '@widgets/address-picker';
import { homePageTemplate } from './home.tmpl.js';

interface HomePageProps {
    restaurants: Restaurant[];
    categories: Category[];
    activeCategory: string;
    searchQuery: string;
}

const PAGE_SIZE = 20;
const TABLET_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 900;

export class HomePage extends Component<HomePageProps> {
    private offset = 0;
    private hasMore = true;
    private isFetching = false;
    private pageEl: HTMLElement | null = null;
    private activeCategory = '';
    private searchQuery = '';

    constructor() {
        super(homePageTemplate);
    }

    protected slots = {
        header: '.js-header-slot',
        streak: '.js-streak-slot',
        cart: '.js-cart-slot',
    };

    static async load(): Promise<HomePageProps> {
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
            (initialQuery
                ? restaurantApi.search(initialQuery, PAGE_SIZE)
                : restaurantApi.listBrands(PAGE_SIZE, 0)
            )
                .then((r) => { restaurants = r; })
                .catch((e) => console.warn('home: initial brands fetch failed', e)),
            restaurantApi.listCategories()
                .then((c) => { categories = c; })
                .catch((e) => console.warn('home: listCategories failed', e)),
        ]);

        return { restaurants, categories, activeCategory: '', searchQuery: initialQuery };
    }

    protected onMount(): void {
        this.pageEl = this.root?.querySelector('.js-home-page') as HTMLElement | null;

        this.offset = this.props.restaurants.length;
        this.hasMore = this.props.restaurants.length === PAGE_SIZE;
        this.activeCategory = this.props.activeCategory ?? '';
        this.searchQuery = this.props.searchQuery ?? '';

        const user = userStore.getState().user;
        const streakWeeks = (user?.streak_weeks ?? 6) as number;
        const currentAddress = addressStore.getState().current?.text ?? '';

        this.mountChild('header', new Header(), {
            user,
            searchQuery: this.searchQuery,
            onLogin: () => window.router.go(ROUTES.login),
            onRegister: () => window.router.go(ROUTES.register),
            onLoggedOut: () => window.router.go(ROUTES.home),
            onSearchSubmit: (q: string) => void this.applySearch(q),
            onMountAddressSlot: (slot) => {
                const picker = new AddressPicker();
                picker.mount(slot, { currentAddress });
            },
        });

        if (user) {
            this.mountChild('streak', new Streak(), Streak.buildProps(streakWeeks, 6));
        } else {
            const streakSlot = this.root?.querySelector('.js-streak-slot') as HTMLElement | null;
            if (streakSlot) streakSlot.style.display = 'none';
        }
        this.mountChild('cart', new CartWidget(), CartWidget.buildProps(cartStore.getState().items));

        const grid = this.root?.querySelector('.js-res-grid');
        if (grid) {
            this.on(grid, 'click', (e) => {
                const card = (e.target as HTMLElement).closest('.res-card') as HTMLElement | null;
                if (!card?.dataset.id) return;
                window.router.go(`${ROUTES.restaurant}?id=${encodeURIComponent(card.dataset.id)}`);
            });
        }

        const scrollContainer = this.root?.querySelector('.center-column');
        if (scrollContainer) {
            this.on(scrollContainer, 'scroll', () => void this.handleScroll(scrollContainer as HTMLElement));
        }

        this.setupCategories();
        this.setupMobilePanels();
    }

    private setupCategories(): void {
        const categoriesList = this.root?.querySelector('.js-categories-list');
        if (!categoriesList) return;

        this.on(categoriesList, 'click', (e) => {
            const item = (e.target as HTMLElement).closest('[data-category-id]') as HTMLElement | null;
            if (!item) return;
            void this.selectCategory(item.dataset.categoryId ?? '');
            if (window.innerWidth <= MOBILE_BREAKPOINT) this.closePanels();
        });

        this.on(categoriesList, 'keydown', (e) => {
            const ke = e as KeyboardEvent;
            if (ke.key !== 'Enter' && ke.key !== ' ') return;
            const item = (e.target as HTMLElement).closest('[data-category-id]') as HTMLElement | null;
            if (!item) return;
            ke.preventDefault();
            void this.selectCategory(item.dataset.categoryId ?? '');
        });
    }

private setupMobilePanels(): void {
        const openCategoriesBtns = this.root?.querySelectorAll('.js-open-categories') ?? [];
        const openCartSheetBtn = this.root?.querySelector('.js-open-cart-sheet');
        const overlay = this.root?.querySelector('.js-mobile-overlay');
        const closeBtns = this.root?.querySelectorAll('.js-close-panels') ?? [];

        openCategoriesBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.openCategoriesDrawer());
        });

        if (openCartSheetBtn) {
            this.on(openCartSheetBtn, 'click', () => this.openCartSheet());
        }

        if (overlay) {
            this.on(overlay, 'click', () => this.closePanels());
        }

        closeBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.closePanels());
        });

        this.on(document, 'keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Escape') this.closePanels();
        });

        this.on(window, 'resize', () => {
            const width = window.innerWidth;
            if (width > TABLET_BREAKPOINT) {
                this.closePanels();
                return;
            }
            if (width > MOBILE_BREAKPOINT) {
                this.pageEl?.classList.remove('home-page_drawer-categories');
            }
        });
    }

    private async applySearch(query: string): Promise<void> {
        this.searchQuery = query.trim();
        await this.refreshGrid();
    }

    private async selectCategory(id: string): Promise<void> {
        // Повторный клик по активной категории сбрасывает фильтр.
        if (id === '' || this.activeCategory === id) {
            this.activeCategory = '';
        } else {
            this.activeCategory = id;
        }
        this.updateActiveCategoryUI(this.activeCategory);
        await this.refreshGrid();
    }

    private async refreshGrid(): Promise<void> {
        const q = this.searchQuery;
        const cat = this.activeCategory;

        this.offset = 0;
        // Пагинация по скроллу включается только в "чистом" режиме (без фильтров).
        // Иначе offset смешается с клиентским filter и поведение поедет.
        this.hasMore = false;

        const label = this.root?.querySelector('.js-search-label') as HTMLElement | null;
        const title = this.root?.querySelector('.js-page-title') as HTMLElement | null;

        if (label) {
            if (q) {
                label.style.display = 'block';
                label.textContent = `Найдено по запросу «${q}»`;
            } else {
                label.style.display = 'none';
            }
        }

        if (title) {
            if (cat) {
                title.textContent = this.props.categories.find((c) => c.id === cat)?.name ?? cat;
            } else if (q) {
                title.textContent = 'Поиск';
            } else {
                title.textContent = 'Рестораны';
            }
        }

        let results: Restaurant[] = [];

        if (!q && !cat) {
            results = await restaurantApi.listBrands(PAGE_SIZE, 0).catch(() => [] as Restaurant[]);
            this.offset = results.length;
            this.hasMore = results.length === PAGE_SIZE;
        } else if (q && !cat) {
            results = await restaurantApi.search(q, PAGE_SIZE).catch(() => [] as Restaurant[]);
        } else if (!q && cat) {
            results = await restaurantApi.listBrandsByCategory(cat, PAGE_SIZE, 0).catch(() => [] as Restaurant[]);
        } else {
            // Бэк не умеет search+category одним запросом — берём по категории
            // с большим лимитом и фильтруем клиентом по подстроке в названии/описании.
            const COMBINED_LIMIT = 100;
            const inCat = await restaurantApi.listBrandsByCategory(cat, COMBINED_LIMIT, 0)
                .catch(() => [] as Restaurant[]);
            const needle = q.toLowerCase();
            results = inCat.filter((r) => {
                const name = (r.name ?? '').toLowerCase();
                const desc = (r.description ?? '').toLowerCase();
                return name.includes(needle) || desc.includes(needle);
            });
        }

        this.replaceGrid(results);
    }

    private updateActiveCategoryUI(activeId: string): void {
        const items = this.root?.querySelectorAll('[data-category-id]') ?? [];
        items.forEach((el) => {
            const id = (el as HTMLElement).dataset.categoryId ?? '';
            const shouldBeActive = activeId === '' ? id === '' : id === activeId;
            el.classList.toggle('category-item_active', shouldBeActive);
        });
    }

    private replaceGrid(items: Restaurant[]): void {
        const grid = this.root?.querySelector('.js-res-grid');
        const empty = this.root?.querySelector('.js-res-empty') as HTMLElement | null;

        if (!grid) return;

        if (empty) empty.style.display = items.length === 0 ? 'flex' : 'none';

        grid.innerHTML = items
            .map(
                (r) => `
                <div class="res-card" data-id="${r.id}">
                    <img class="res-card__rect" src="${r.logo_url}" alt="${r.name}"
                        onerror="this.src='https://placehold.co/400x225/png?text=${encodeURIComponent(r.name)}'">
                    <div class="res-card__info">
                        <span class="res-card__name">${r.name}</span>
                        <span class="res-card__desc">${r.description ?? 'Вкусная еда'}</span>
                    </div>
                </div>`,
            )
            .join('');
    }

    private openCategoriesDrawer(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.add('home-page_drawer-categories');
        this.pageEl.classList.remove('home-page_sheet-cart');
    }

    private openCartSheet(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.add('home-page_sheet-cart');
        this.pageEl.classList.remove('home-page_drawer-categories');
    }

    private closePanels(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.remove('home-page_drawer-categories');
        this.pageEl.classList.remove('home-page_sheet-cart');
    }

    private async handleScroll(container: HTMLElement): Promise<void> {
        if (this.isFetching || !this.hasMore || this.searchQuery || this.activeCategory) return;

        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom > 200) return;

        this.isFetching = true;
        try {
            const next = await restaurantApi.listBrands(PAGE_SIZE, this.offset);
            this.appendCards(next);
            this.offset += next.length;
            if (next.length < PAGE_SIZE) this.hasMore = false;
        } catch (e) {
            console.error('home: paginate failed', e);
        } finally {
            this.isFetching = false;
        }
    }

    private appendCards(items: Restaurant[]): void {
        const grid = this.root?.querySelector('.js-res-grid');
        if (!grid) return;

        const html = items
            .map(
                (r) => `
            <div class="res-card" data-id="${r.id}">
                <img class="res-card__rect" src="${r.logo_url}" alt="${r.name}"
                    onerror="this.src='https://placehold.co/400x225/png?text=${encodeURIComponent(r.name)}'">
                <div class="res-card__info">
                    <span class="res-card__name">${r.name}</span>
                    <span class="res-card__desc">${r.description ?? 'Вкусная еда'}</span>
                </div>
            </div>`,
            )
            .join('');

        grid.insertAdjacentHTML('beforeend', html);
    }
}
