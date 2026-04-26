import './home.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { restaurantApi } from '@entities/restaurant';
import type { Restaurant } from '@entities/restaurant';
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

export class HomePage extends Component<HomePageProps> {
    private offset = 0;
    private hasMore = true;
    private isFetching = false;

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
        const tasks: Promise<unknown>[] = [cartStore.load()];
        if (isAuth) tasks.push(addressStore.loadSaved());
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
