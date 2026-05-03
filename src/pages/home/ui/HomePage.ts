import './home.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { restaurantApi, type Restaurant } from '@entities/restaurant';
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
}

const PAGE_SIZE = 20;
const TABLET_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 900;

export class HomePage extends Component<HomePageProps> {
    private offset = 0;
    private hasMore = true;
    private isFetching = false;
    private pageEl: HTMLElement | null = null;

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

        let restaurants: Restaurant[] = [];
        try {
            restaurants = await restaurantApi.listBrands(PAGE_SIZE, 0);
        } catch (e) {
            console.warn('home: listBrands failed', e);
        }

        return { restaurants };
    }

    protected onMount(): void {
        this.pageEl = this.root?.querySelector('.js-home-page') as HTMLElement | null;

        this.offset = this.props.restaurants.length;
        this.hasMore = this.props.restaurants.length === PAGE_SIZE;

        const user = userStore.getState().user;
        const streakWeeks = (user?.streak_weeks ?? 6) as number;
        const currentAddress = addressStore.getState().current?.text ?? '';

        this.mountChild('header', new Header(), {
            user,
            onLogin: () => window.router.go(ROUTES.login),
            onRegister: () => window.router.go(ROUTES.register),
            onLoggedOut: () => window.router.go(ROUTES.home),
            onMountAddressSlot: (slot) => {
                const picker = new AddressPicker();
                picker.mount(slot, { currentAddress });
            },
        });

        this.mountChild('streak', new Streak(), Streak.buildProps(streakWeeks, 6));
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

        const openCategoriesBtns = this.root?.querySelectorAll('.js-open-categories') ?? [];
        const openCartSheetBtn = this.root?.querySelector('.js-open-cart-sheet');
        const overlay = this.root?.querySelector('.js-mobile-overlay');
        const closeBtns = this.root?.querySelectorAll('.js-close-panels') ?? [];
        const categoriesDrawer = this.root?.querySelector('.js-categories-drawer');

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

        if (categoriesDrawer) {
            this.on(categoriesDrawer, 'click', (e) => {
                const item = (e.target as HTMLElement).closest('.category-item');
                if (item && window.innerWidth <= MOBILE_BREAKPOINT) {
                    this.closePanels();
                }
            });
        }

        this.on(document, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePanels();
            }
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
        if (this.isFetching || !this.hasMore) return;

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
                    <span class="res-card__desc">Пицца, суши, роллы</span>
                </div>
            </div>`,
            )
            .join('');

        grid.insertAdjacentHTML('beforeend', html);
    }
}
