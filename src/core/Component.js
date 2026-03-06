/**
 * @class Base Component
 */
export class Component {
    /**
     * @param {string} templateString - Строка шаблона doT
     */
    constructor(templateString) {
        this.renderFunc = window.doT.template(templateString);
        this.element = null;
    }

    /**
     * Метод отрисовки
     * @param {HTMLElement} container 
     * @param {Object} data 
     */
    mount(container, data = {}) {
        container.innerHTML = this.renderFunc(data);
        this.afterRender();
    }

    /**
     * Жизненный цикл: навешивание событий после вставки в DOM
     */
    afterRender() {}
}