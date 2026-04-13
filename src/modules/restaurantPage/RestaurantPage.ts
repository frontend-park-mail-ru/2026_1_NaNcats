import './restaurantPage.scss';
import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import { restaurantPageTemplate } from './restaurantPage.tmpl.js';
import { Cart } from '../cart/Cart';

/**
 * Интерфейс для объекта блюда
 */
interface Dish {
    id: number;
    name: string;
    price: number;
    image_url: string;
    description?: string;
    price_formatted?: number;
}

/**
 * Интерфейс для информации о ресторане
 */
interface RestaurantInfo {
    id?: number;
    name: string;
    logo_url?: string;
}

interface UserProfile {
    avatar_url?: string;
}

/**
 * Компонент страницы ресторана с товарами
 * 
 * @class RestaurantPage
 * @extends Component
 */
export class RestaurantPage extends Component {
    private limit: number = 20;
    private offset: number = 0;
    private isFetching: boolean = false;
    private hasMore: boolean = true;
    private cart: Cart;
    private user: UserProfile | null = null;

    constructor() {
        super(restaurantPageTemplate);
        this.cart = new Cart();
    }

    /**
     * Выполняет первичную загрузку данных пользователя и списка позиций.
     * @param {HTMLElement} container - Элемент, в который будет вставлен список.
     * @override
     * @returns {Promise<void>}
     */
    public async mount(container: HTMLElement): Promise<void> {
        this.element = container;
        this.user = null;
        this.offset = 0;
        this.hasMore = true;
        
        const restId = this.getRestaurantId();
        
        let dishes: Dish[] = [];
        let restaurantInfo: RestaurantInfo = { name: 'Ресторан недоступен (оффлайн)' };

        try {
            const results = await Promise.allSettled([
                Ajax.get('/auth/me'),
                this.fetchDishes(),
                Ajax.get(`/restaurants/brands/${restId}`)
            ]);

            if (results[0].status === 'fulfilled' && results[0].value.ok) {
                this.user = await results[0].value.json();
            }
            
            if (results[1].status === 'fulfilled') {
                dishes = results[1].value as Dish[];
            }

            if (results[2].status === 'fulfilled' && results[2].value.ok) {
                restaurantInfo = await results[2].value.json();
            }

        } catch (e) {
            console.warn("Ошибка в mount:", e);
        }

        // Безопасное форматирование цен
        const formattedDishes = (dishes || []).map(d => ({
            ...d, 
            price_formatted: (d.price || 0) / 1000000
        }));

        super.mount(container, { 
            dishes: formattedDishes, 
            user: this.user,
            restaurant: restaurantInfo 
        });
    }

    /**
     * Возвращает айдишник ресторана из URL
     * @returns {string|null}
     */
    private getRestaurantId(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    /**
     * Запрашивает порцию данных о блюдах ресторана.
     * @async
     * @returns {Promise<Dish[]>} Массив объектов блюд.
     */
    private async fetchDishes(): Promise<Dish[]> {
        if (this.isFetching || !this.hasMore) return [];

        const id = this.getRestaurantId();
        if (!id) return [];

        this.isFetching = true;
        try {
            const resResponse = await Ajax.get(`/restaurants/brands/${id}/dishes?limit=${this.limit}&offset=${this.offset}`);
            if (resResponse.ok) {
                const data = await resResponse.json();
                const newDishes: Dish[] = data.dishes || [];
                
                if (newDishes.length < this.limit) {
                    this.hasMore = false;
                }
                
                this.offset += this.limit;
                return newDishes;
            }
        } catch (e) {
            console.error("Ошибка при подгрузке блюд:", e);
        } finally {
            this.isFetching = false;
        }
        return [];
    }

    private handleBack(): void {
        window.router.go('/');
    }

    /**
     * Выполняет выход пользователя из системы
     */
    private async handleLogout(): Promise<void> {
        const res = await Ajax.post('/auth/logout');
        if (res.ok) {
            window.router.go('/');
        }
    }

    private handleLoginRedirect(): void {
        window.router.go('/login');
    }

    private handleRegisterRedirect(): void {
        window.router.go('/register');
    }

    /**
     * Установка обработчиков событий
     * @override
     */
    public afterRender(): void {
        if (!this.element) return;

        const backBtn = document.getElementById('header__back-btn');
        backBtn?.addEventListener('click', () => this.handleBack());

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.handleLogout();
        }

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = () => this.handleLoginRedirect();
        }

        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.onclick = () => this.handleRegisterRedirect();
        }

        const cartContainer = document.getElementById('restaurant-cart-container');
        if (cartContainer) {
            this.cart.mount(cartContainer);
        }

        const addButtons = this.element.querySelectorAll('.js-add-to-cart');
        const restIdStr = this.getRestaurantId();
        const restId = restIdStr ? parseInt(restIdStr, 10) : 0;

        addButtons.forEach(btn => {
            const htmlBtn = btn as HTMLElement;
            htmlBtn.addEventListener('click', () => {
                if (!this.user) {
                    window.router.go('/login');
                    return;
                }

                const dish = {
                    id: parseInt(htmlBtn.dataset.id || '0', 10),
                    name: htmlBtn.dataset.name || '',
                    price: parseInt(htmlBtn.dataset.price || '0', 10),
                    image_url: htmlBtn.dataset.image || ''
                };

                this.cart.addDish(dish, restId);
            });
        });
    }
}
