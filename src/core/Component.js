/**
 * Базовый класс для создания компонентов.
 * 
 * @abstract
 * @class Component
 * @param {string} templateString - Строка шаблона в формате doT.js.
 */
export class Component {
    constructor(templateString) {
        /** 
         * Подготовленная функция шаблонизатора doT.
         * @type {Function} 
         * @protected
         */
        this.renderFunc = window.doT.template(templateString);
        /** 
         * Корневой HTML-элемент компонента в DOM. 
         * @type {HTMLElement|null} 
         */
        this.element = null;
    }

    /**
     * Отрисовывает компонент в указанный контейнер.
     * @param {HTMLElement} container - DOM-элемент, в который будет вставлен компонент.
     * @param {Object} [data={}] - Данные для шаблонизатора.
     * @returns {void}
     */
    mount(container, data = {}) {
        this.element = container;
        container.innerHTML = this.renderFunc(data);
        this.afterRender();
    }

    /**
     * Метод жизненного цикла: вызывается автоматически после вставки в DOM.
     * Предназначен для навешивания обработчиков событий.
     * @returns {void}
     */
    afterRender() {}
}
