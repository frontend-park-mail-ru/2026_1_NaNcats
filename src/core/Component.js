/**
 * @module Component
 */

/**
 * Базовый класс для создания UI-компонентов.
 * @class Component
 */
export class Component {
    /**
     * Создает экземпляр компонента.
     * @param {string} templateString - Строка шаблона в формате doT.js.
     */
    constructor(templateString) {
        /** @type {Function} Функция рендеринга doT */
        this.renderFunc = window.doT.template(templateString);
        /** @type {HTMLElement|null} Корневой элемент компонента в DOM */
        this.element = null;
    }

    /**
     * Отрисовывает компонент в указанный контейнер.
     * @param {HTMLElement} container - DOM-элемент, в который будет вставлен компонент.
     * @param {Object} [data={}] - Данные для шаблонизатора.
     * @returns {void}
     */
    mount(container, data = {}) {
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