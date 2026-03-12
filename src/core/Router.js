/**
 * Роутер для сопоставления URL с компонентами.
 * Управляет навигацией и переключением страниц без перезагрузки.
 * 
 * @class Router
 * @param {HTMLElement} root - DOM-элемент, в который будет рендериться контент.
 */
export class Router {
    constructor(root) {
        /** 
         * Корневой элемент приложения.
         * @type {HTMLElement} 
         */
        this.root = root;

        /** 
         * Объект-карта маршрутов, где ключ — путь, а значение — экземпляр компонента.
         * @type {Object<string, Component>} 
         */
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
     * @param {Component} component - Экземпляр компонента для этого пути.
     * @returns {Router} Текущий экземпляр роутера для цепочки вызовов.
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
        let component = this.routes[path];
        if (!component) {
            component = this.routes['/404'];
        }
        component.mount(this.root);
    }
}
