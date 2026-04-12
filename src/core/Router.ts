import { Component } from './Component';

/**
 * Роутер для сопоставления URL с компонентами.
 * Управляет навигацией и переключением страниц без перезагрузки.
 * 
 * @class Router
 * @param {HTMLElement} root - DOM-элемент, в который будет рендериться контент.
 */
export class Router {
    /** 
     * Корневой элемент приложения.
     * @type {HTMLElement} 
     */
    public root: HTMLElement;

    /** 
     * Объект-карта маршрутов, где ключ — путь, а значение — экземпляр компонента.
     * @type {Object<string, Component>} 
     */
    public routes: Record<string, Component | (() => Promise<Component>)>;

    constructor(root: HTMLElement) {
        this.root = root;
        this.routes = {};

        document.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('.router-link');
            if (link) {
                e.preventDefault();
                const path = link.getAttribute('href');
                if (path) {
                    this.go(path);
                }
            }
        });

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
    public register(path: string, component: Component | (() => Promise<Component>)): this {
        this.routes[path] = component;
        return this;
    }

    /**
     * Осуществляет переход на указанный путь.
     * @param {string} path - Путь для перехода.
     * @returns {void}
     */
    public go(path: string): void {
        window.history.pushState(null, '', path);
        this.render(path.split('?')[0]);
    }

    /**
     * Отрисовывает компонент, соответствующий переданному пути.
     * @param {string} path - Путь для отрисовки.
     * @returns {void}
     */
    public async render(path: string): Promise<void> {
        let entry = this.routes[path] || this.routes['/404'];

        if (typeof entry === 'function') {
            const componentInstance = await entry();
            this.routes[path] = componentInstance;
            componentInstance.mount(this.root);
        } else if (entry) {
            entry.mount(this.root);
        }
    }
}
