/**
 * SPA Router
 */
export class Router {
    /**
     * @param {HTMLElement} root - Куда рендерить контент
     */
    constructor(root) {
        this.root = root;
        this.routes = {};

        // Слушаем клики по всему документу для перехвата ссылок
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.router-link');
            if (link) {
                e.preventDefault();
                const path = link.getAttribute('href');
                this.go(path);
            }
        });

        // Слушаем кнопку "Назад" в браузере
        window.addEventListener('popstate', () => {
            this.render(window.location.pathname);
        });
    }

    /**
     * Регистрация маршрута
     * @param {string} path 
     * @param {Object} component 
     */
    register(path, component) {
        this.routes[path] = component;
        return this;
    }

    /**
     * Переход на программном уровне
     * @param {string} path 
     */
    go(path) {
        window.history.pushState(null, '', path);
        this.render(path);
    }

    /**
     * Отрисовка компонента
     * @param {string} path 
     */
    render(path) {
        const component = this.routes[path];
        if (!component) {
            this.root.innerHTML = '<h1>404 Not Found</h1>';
            return;
        }
        
        // Вызываем метод mount у компонента
        component.mount(this.root);
    }
}