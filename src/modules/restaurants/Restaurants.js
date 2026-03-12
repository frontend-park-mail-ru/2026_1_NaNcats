import { Component } from '../../core/Component.js';
import { Ajax } from '../../core/Ajax.js';
import { restaurantsTemplate } from "./restaurants.tmpl.js"

/**
 * Компонент главной страницы со списком ресторанов.
 * @extends Component
 */
export class Restaurants extends Component {
    /**
     * Создает экземпляр списка ресторанов.
     */
    constructor() {
        super(restaurantsTemplate);
        this.limit = 20;
        this.offset = 0;
        this.isFetching = false;
        this.hasMore = true;
        
        this.handleScroll = this.handleScroll.bind(this);
    }

    /**
     * Загружает данные пользователя и список ресторанов перед рендерингом.
     * @param {HTMLElement} container - Элемент, в который будет вставлен список.
     * @override
     * @returns {Promise<void>} - Промис, завершающийся после отрисовки.
     */
    async mount(container) {
        this.offset = 0;
        this.hasMore = true;
        let restaurants = [];
        let user = null;

        try {
            const userResponse = await Ajax.get('/auth/me');
            if (userResponse.ok) {
                user = await userResponse.json();
            }

            const data = await this.fetchRestaurants();
            restaurants = data;
        } catch (e) {
            console.warn("Ошибка при получении данных:", e);
        }

        super.mount(container, { restaurants, user });
    }

    /**
     * Обработчик выхода пользователя из системы.
     * @returns {Promise<void>} - Промис завершения запроса выхода.
     */
    async handleLogout() {
        const res = await Ajax.post('/auth/logout');
        if (res.ok) {
            window.router.go('/');
        }
    }

    /**
     * Переход на страницу логина.
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

    async fetchRestaurants() {
        if (this.isFetching || !this.hasMore) return [];
        
        this.isFetching = true;
        try {
            const resResponse = await Ajax.get(`/restaurants/brands?limit=${this.limit}&offset=${this.offset}`);
            if (resResponse.ok) {
                const data = await resResponse.json();
                const newRestaurants = data.restaurants || [];
                
                if (newRestaurants.length < this.limit) {
                    this.hasMore = false;
                }
                
                this.offset += this.limit;
                return newRestaurants;
            }
        } catch (e) {
            console.error("Ошибка при подгрузке ресторанов:", e);
        } finally {
            this.isFetching = false;
        }
        return [];
    }

    async handleScroll() {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        if (scrollHeight - scrollTop - clientHeight < 200) {
            const newRestaurants = await this.fetchRestaurants();
            if (newRestaurants.length > 0) {
                this.appendRestaurants(newRestaurants);
            }
        }
    }

    appendRestaurants(restaurants) {
        const grid = document.querySelector('.res-grid');
        if (!grid) return;

        restaurants.forEach(res => {
            const cardHtml = `
                <div class="res-card">
                    <img class="res-rect" src="${res.logo_url}" alt="${res.name}"
                    onerror="this.src='https://placehold.co/400x225/png?text=${res.name}'">
                    <div class="res-info">
                        <span class="res-name">${res.name}</span>
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    /**
     * Настраивает обработчики событий после рендеринга.
     * @override
     * @returns {void}
     */
    afterRender() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            /**
             *
             */
            logoutBtn.onclick = () => this.handleLogout();
        }

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            /**
             *
             */
            loginBtn.onclick = () => this.handleLoginRedirect();
        }

        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            /**
             *
             */
            registerBtn.onclick = () => this.handleRegisterRedirect();
        }

        const scrollContainer = document.querySelector('.center-column');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', this.handleScroll);
        }
    }
}