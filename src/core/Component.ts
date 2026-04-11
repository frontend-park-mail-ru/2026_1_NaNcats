import doT from 'dot';

/**
 * Базовый класс для создания компонентов.
 * 
 * @abstract
 * @class Component
 * @param {string} templateString - Строка шаблона в формате doT.js.
 */
export abstract class Component {
    /** 
     * Подготовленная функция шаблонизатора doT.
     * @type {Function} 
     * @protected
     */
    protected renderFunc: (data: any) => string;
    /** 
     * Корневой HTML-элемент компонента в DOM. 
     * @type {HTMLElement|null} 
     */
    public element: HTMLElement | null;

    constructor(templateString: string) {
        this.renderFunc = doT.template(templateString);
        this.element = null;
    }

    /**
     * Отрисовывает компонент в указанный контейнер.
     * @param {HTMLElement} container - DOM-элемент, в который будет вставлен компонент.
     * @param {Object} [data={}] - Данные для шаблонизатора.
     * @returns {void}
     */
    public mount(container: HTMLElement, data: any = {}): void {
        this.element = container;
        container.innerHTML = this.renderFunc(data);
        this.afterRender();
    }

    /**
     * Метод жизненного цикла: вызывается автоматически после вставки в DOM.
     * Предназначен для навешивания обработчиков событий.
     * @returns {void}
     */
    public afterRender(): void {}
}
