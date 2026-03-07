/**
 * @module Router
 * @description Модуль для управления навигацией в Single Page Application без перезагрузки страницы.
 */

/**
 * SPA Роутер для сопоставления путей (URL) с компонентами.
 * @class Router
 */
export class Router {
    /**
     * Создает экземпляр роутера.
     * @param {HTMLElement} root - DOM-элемент, в который будет рендериться контент.
     */
    constructor(root) {
        /** @type {HTMLElement} Корневой элемент приложения */
        this.root = root;
        /** @type {Object.<string, import('./Component.js').Component>} Объект карта маршрутов */
        this.routes = {};

        // Глобальный перехват кликов для навигации
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.router-link');
            if (link) {
                e.preventDefault();
                const path = link.getAttribute('href');
                if (path) {
                    this.go(path);
                }
            }
        });

        // Обработка кнопок "Назад/Вперед" в браузере
        window.addEventListener('popstate', () => {
            this.render(window.location.pathname);
        });
    }

    /**
     * Регистрирует новый маршрут.
     * @param {string} path - Путь (например, '/login').
     * @param {import('./Component.js').Component} component - Экземпляр компонента для этого пути.
     * @returns {Router} - Текущий экземпляр роутера для цепочки вызовов.
     */
    register(path, component) {
        this.routes[path] = component;
        return this;
    }

    /**
     * Осуществляет переход на указанный путь.
     * @param {string} path - Путь для перехода.
     * @returns {void}
     */
    go(path) {
        window.history.pushState(null, '', path);
        this.render(path);
    }

    /**
     * Отрисовывает компонент, соответствующий переданному пути.
     * @param {string} path - Путь для отрисовки.
     * @returns {void}
     */
    render(path) {
        const component = this.routes[path];
        if (!component) {
            this.root.innerHTML = '<h1>404 Not Found</h1>';
            return;
        }
        
        component.mount(this.root);
    }
}