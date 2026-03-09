import { Component } from '../../core/Component.js';
import { Ajax } from '../../core/Ajax.js';
import { restaurantsTemplate } from "./restaurants.tmpl.js"

/**
 * Компонент главной страницы со списком ресторанов.
 * @extends Component
 */
export class RestaurantList extends Component {
    /**
     * Создает экземпляр списка ресторанов.
     */
    constructor() {
        super(restaurantsTemplate);
    }

    /**
     * Загружает данные пользователя и список ресторанов перед рендерингом.
     * @param {HTMLElement} container - Элемент, в который будет вставлен список.
     * @override
     * @returns {Promise<void>} - Промис, завершающийся после отрисовки.
     */
    async mount(container) {
        let restaurants = [];
        let user = null;

        try {
            const userResponse = await Ajax.get('/auth/me');
            if (userResponse.ok) {
                user = await userResponse.json();
            }

            const resResponse = await Ajax.get('/restaurants/brands');
            if (resResponse.ok) {
                const data = await resResponse.json();
                restaurants = data.restaurants || [];
            }
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
    }
}