import './restaurant.scss';
import { Component } from '@shared/lib/component';
import { ROUTES } from '@shared/config/routes';
import { Popup } from '@shared/ui/popup';
import { getQueryParam } from '@shared/lib/url/searchParams';
import { restaurantApi, type Restaurant, type Dish } from '@entities/restaurant';
import { userStore } from '@entities/user';
import { cartStore, fromMicros } from '@entities/cart';
import { addToCart } from '@features/cart/add-to-cart';
import { Header } from '@widgets/header';
import { CartWidget } from '@widgets/cart-widget';
import { restaurantPageTemplate } from './restaurant.tmpl.js';

interface DishView extends Dish {
    price_rub: number;
}

interface RestaurantPageProps {
    restaurant: Restaurant;
    dishes: DishView[];
}

const PAGE_SIZE = 20;
const TABLET_BREAKPOINT = 1200;
const MOBILE_BREAKPOINT = 900;

const FALLBACK_RESTAURANT: Restaurant = {
    id: 0,
    name: 'Ресторан недоступен (оффлайн)',
    logo_url: '',
};

const toView = (d: Dish): DishView => ({ ...d, price_rub: fromMicros(d.price) });

export class RestaurantPage extends Component<RestaurantPageProps> {
    private restaurantId = 0;
    private offset = 0;
    private hasMore = true;
    private isFetching = false;
    private pageEl: HTMLElement | null = null;

    constructor() {
        super(restaurantPageTemplate);
    }

    protected slots = {
        header: '.js-header-slot',
        cart: '.js-cart-slot',
    };

    static async load(): Promise<RestaurantPageProps> {
        const idParam = getQueryParam('id');
        if (!idParam) {
            return { restaurant: FALLBACK_RESTAURANT, dishes: [] };
        }

        try {
            await userStore.loadCurrent();
        } catch (e) {
            console.warn('restaurant: loadCurrent failed', e);
        }

        const isAuth = userStore.getState().user !== null;
        const aux: Promise<unknown>[] = [];
        if (isAuth) {
            aux.push(cartStore.load());
        }
        await Promise.all(aux);

        const [brandRes, dishesRes] = await Promise.allSettled([
            restaurantApi.getBrand(idParam),
            restaurantApi.listDishes(idParam, PAGE_SIZE, 0),
        ]);

        const restaurant =
            brandRes.status === 'fulfilled' ? brandRes.value : FALLBACK_RESTAURANT;
        const dishes =
            dishesRes.status === 'fulfilled' ? dishesRes.value.map(toView) : [];

        return { restaurant, dishes };
    }

    protected onMount(): void {
        this.pageEl = this.root?.querySelector('.js-restaurant-page') as HTMLElement | null;

        const idParam = getQueryParam('id');
        this.restaurantId = idParam ? parseInt(idParam, 10) : 0;
        this.offset = this.props.dishes.length;
        this.hasMore = this.props.dishes.length === PAGE_SIZE;

        const user = userStore.getState().user;

        this.mountChild('header', new Header(), {
            user,
            mode: 'back',
            onBack: () => window.router.go(ROUTES.home),
            onLogin: () => window.router.go(ROUTES.login),
            onRegister: () => window.router.go(ROUTES.register),
            onLoggedOut: () => window.router.go(ROUTES.home),
        });

        this.mountChild(
            'cart',
            new CartWidget(),
            CartWidget.buildProps(cartStore.getState().items),
        );

        const grid = this.root?.querySelector('.js-dish-grid');
        if (grid) {
            this.on(grid, 'click', (e) => {
                const btn = (e.target as HTMLElement).closest('.js-add-to-cart') as HTMLElement | null;
                if (!btn) return;
                void this.handleAdd(btn);
            });
        }

        const scrollContainer = this.root?.querySelector('.center-column');
        if (scrollContainer) {
            this.on(scrollContainer, 'scroll', () =>
                void this.handleScroll(scrollContainer as HTMLElement),
            );
        }

        const openMenuBtns = this.root?.querySelectorAll('.js-open-menu-drawer') ?? [];
        const openCartBtns = this.root?.querySelectorAll('.js-open-cart-sheet') ?? [];
        const overlay = this.root?.querySelector('.js-mobile-overlay');
        const closeBtns = this.root?.querySelectorAll('.js-close-panels') ?? [];
        const menuDrawer = this.root?.querySelector('.js-menu-drawer');

        openMenuBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.openMenuDrawer());
        });

        openCartBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.openCartSheet());
        });

        if (overlay) {
            this.on(overlay, 'click', () => this.closePanels());
        }

        closeBtns.forEach((btn) => {
            this.on(btn, 'click', () => this.closePanels());
        });

        if (menuDrawer) {
            this.on(menuDrawer, 'click', (e) => {
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
                this.pageEl?.classList.remove('restaurant-details-page_drawer-menu');
            }
        });
    }

    private openMenuDrawer(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.add('restaurant-details-page_drawer-menu');
        this.pageEl.classList.remove('restaurant-details-page_sheet-cart');
    }

    private openCartSheet(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.add('restaurant-details-page_sheet-cart');
        this.pageEl.classList.remove('restaurant-details-page_drawer-menu');
    }

    private closePanels(): void {
        if (!this.pageEl) return;
        this.pageEl.classList.remove('restaurant-details-page_drawer-menu');
        this.pageEl.classList.remove('restaurant-details-page_sheet-cart');
    }

    private async handleAdd(btn: HTMLElement): Promise<void> {
        if (!userStore.getState().user) {
            window.router.go(ROUTES.login);
            return;
        }

        const dish = {
            id: parseInt(btn.dataset.id || '0', 10),
            name: btn.dataset.name || '',
            price: parseInt(btn.dataset.price || '0', 10),
            image_url: btn.dataset.image || '',
        };

        try {
            await addToCart(dish, this.restaurantId, () =>
                Popup.confirm(
                    'В корзине уже есть блюда из другого ресторана. Очистить и добавить новое?',
                ),
            );
        } catch (e) {
            console.error('restaurant: addToCart failed', e);
            await Popup.alert('Не удалось добавить блюдо. Попробуйте ещё раз.');
        }
    }

    private async handleScroll(container: HTMLElement): Promise<void> {
        if (this.isFetching || !this.hasMore || !this.restaurantId) return;

        const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distance > 200) return;

        this.isFetching = true;
        try {
            const next = await restaurantApi.listDishes(
                this.restaurantId,
                PAGE_SIZE,
                this.offset,
            );
            this.appendDishes(next.map(toView));
            this.offset += next.length;
            if (next.length < PAGE_SIZE) this.hasMore = false;
        } catch (e) {
            console.error('restaurant: paginate failed', e);
        } finally {
            this.isFetching = false;
        }
    }

    private appendDishes(items: DishView[]): void {
        const grid = this.root?.querySelector('.js-dish-grid');
        if (!grid) return;

        const html = items
            .map(
                (d) => `
            <div class="dish-card">
                <img class="dish-card__img" src="${d.image_url}" alt="${d.name}"
                    onerror="this.src='https://nancats-bucket.storage.yandexcloud.net/foods/default-food-logo.webp'">
                <div class="dish-card__prices">
                    <div class="dish-card__price">${d.price_rub.toFixed(2)} ₽</div>
                </div>
                <div class="dish-card__title">${d.name}</div>
                <div class="dish-card__desc">${d.description || 'Описание появится позже'}</div>
                <button class="button js-add-to-cart dish-card__add-btn" type="button"
                    data-id="${d.id}" data-name="${d.name}" data-price="${d.price}" data-image="${d.image_url}">
                    В корзину
                </button>
            </div>`,
            )
            .join('');

        grid.insertAdjacentHTML('beforeend', html);
    }
}
