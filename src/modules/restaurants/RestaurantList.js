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
        let restaurants = [
            { id: 1, name: 'Вкусно и точка', description: 'Бургеры и картошка' },
            { id: 2, name: 'Пицца Хат', description: 'Лучшая пицца в городе' },
            { id: 3, name: 'Теремок', description: 'Блины с икрой' },
            { id: 4, name: 'Burger King', description: 'Воппер и фри' },
            { id: 5, name: 'Додо Пицца', description: 'Уютная доставка' },
            { id: 6, name: 'Шоколадница', description: 'Кофе и завтраки' },
            { id: 7, name: 'KFC', description: 'Острые крылышки и бургеры' },
            { id: 8, name: 'Суши Вок', description: 'Роллы, лапша и вок' },
            { id: 9, name: 'Papa Johns', description: 'Сырные бортики и соусы' },
            { id: 10, name: 'Чайхона №1', description: 'Плов, лагман и самса' },
            { id: 11, name: 'Starbucks', description: 'Кофе и десерты' },
            { id: 12, name: 'Вилка-Ложка', description: 'Бизнес-ланчи и салаты' },
            { id: 13, name: 'Subway', description: 'Свежие сэндвичи на любой вкус' },
            { id: 14, name: 'Кофе Хауз', description: 'Ароматный кофе и десерты' },
            { id: 15, name: 'IL Патио', description: 'Итальянская паста и пицца' },
            { id: 16, name: 'Макдональдс', description: 'Бигмак и картошка фри' }
        ];

        let user = null;

        try {
            const userResponse = await Ajax.get('/auth/me');
            if (userResponse.ok) {
                user = await userResponse.json();
            }

            const resResponse = await Ajax.get('/restaurants');
            if (resResponse.ok) {
                restaurants = await resResponse.json();
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