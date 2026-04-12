import './restaurantPage.scss';
import { Component } from '../../core/Component';
import { Ajax } from '../../core/Ajax';
import {restaurantPageTemplate} from './restaurantPage.tmpl.js'
import { Cart } from '../cart/Cart';

/**
 * Компонент страницы ресторана с товарами
 * 
 * @class RestaurantPage
 * @extends Component
 */
export class RestaurantPage extends Component {
    constructor() {
        super(restaurantPageTemplate);

        /**
         * Количество позиций ресторана, запрашиваемых за один раз
         * @type {number}
         */
        this.limit = 20;

        /** 
         * Смещение для пагинации данных.
         * @type {number} 
         */
        this.offset = 0;

        /**
         * Статус выполнения асинхронного запроса в данный момент
         * @type {boolean}
         */
        this.isFetching = false;

        /** 
         * Флаг наличия доступных данных для дальнейшей подгрузки.
         * @type {boolean} 
         */
        this.hasMore = true;

        this.cart = new Cart();
    }

    /**
     * Выполняет первичную загрузку данных пользователя и списка позиций.
     * @param {HTMLElement} container - Элемент, в который будет вставлен список.
     * @override
     * @returns {Promise<void>}
     */
    async mount(container) {
        this.user = null;
        this.offset = 0;
        this.hasMore = true;
        const restId = this.getRestaurantId();
        
        let dishes = [];
        let restaurantInfo = { name: 'Загрузка...' };

        try {
            const [userRes, dishesData, restRes] = await Promise.all([
                Ajax.get('/auth/me'),
                this.fetchDishes(),
                Ajax.get(`/restaurants/brands/${restId}`)
            ]);

            if (userRes.ok) this.user = await userRes.json();
            dishes = dishesData;
            if (restRes.ok) restaurantInfo = await restRes.json();

        } catch (e) {
            console.warn("Ошибка при получении данных:", e);
        }

        const formattedDishes = dishes.map(d => ({
            ...d, 
            price_formatted: d.price / 1000000
        }));

        super.mount(container, { 
            dishes: formattedDishes, 
            user: this.user,
            restaurant: restaurantInfo 
        });
    }

    /**
     * Возвращает айдишник ресторана
     * @returns {string|null}
     */
    getRestaurantId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    /**
     * Запрашивает порцию данных о блюдах ресторана.
     * @async
     * @returns {Promise<Array<Object>>} Массив объектов блюд.
     */
    async fetchDishes() {
        if (this.isFetching || !this.hasMore) return [];

        const id = this.getRestaurantId();
        if (!id) return [];

        this.isFetching = true;
        try {
            const resResponse = await Ajax.get(`/restaurants/brands/${id}/dishes?limit=${this.limit}&offset=${this.offset}`);
            if (resResponse.ok) {
                const data = await resResponse.json();
                const newDishes = data.dishes  || [];
                
                if (newDishes.length < this.limit) {
                    this.hasMore = false;
                }
                
                this.offset += this.limit;
                return newDishes;
            }
        } catch (e) {
            console.error("Ошибка при подгрузке ресторанов:", e);
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * Переход назад
     * @returns {void}
     */
    handleBack() {
        window.router.go('/');
    }

     /**
     * Выполняет выход пользователя из системы и перенаправляет на главную.
     * @returns {Promise<void>}
     */
    async handleLogout() {
        const res = await Ajax.post('/auth/logout');
        if (res.ok) {
            window.router.go('/');
        }
    }

    /**
     * Переход на страницу авторизации.
     * @returns {void}
     */
    handleLoginRedirect() {
        window.router.go('/login');
    }

    /**
     * Переход на страницу регистрации.
     * @returns {void}
     */
    handleRegisterRedirect() {
        window.router.go('/register');
    }

    /**
     * Установка обработчиков событий
     * @override
     * @returns {void}
     */
    afterRender() {
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
        const restId = parseInt(this.getRestaurantId(), 10);

        addButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.user) {
                    window.router.go('/login');
                    return;
                }

                // Собираем данные из data-атрибутов
                const dish = {
                    id: parseInt(btn.dataset.id, 10),
                    name: btn.dataset.name,
                    price: parseInt(btn.dataset.price, 10), // Берем оригинальную цену (в микроединицах)
                    image_url: btn.dataset.image
                };

                // Добавляем в корзину (там внутри есть проверка ресторана)
                this.cart.addDish(dish, restId);
            });
        });
    }
}
