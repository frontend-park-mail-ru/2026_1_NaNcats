/**
 * Класс для управления отображением ошибок в формах.
 * Позволяет централизованно устанавливать и очищать сообщения об ошибках 
 * внутри определенного DOM-контейнера.
 * 
 * @class FormErrors
 * @param {HTMLElement} rootElement - Корневой элемент (обычно форма или компонент), 
 * внутри которого будет производиться поиск полей для ошибок.
 */
export class FormErrors {
    constructor(rootElement) {
        /** 
         * Контейнер для поиска элементов ошибок.
         * @type {HTMLElement} 
         * @private
         */
        this.root = rootElement;
    }

    /**
     * Очищает текст во всех элементах с классом .error-msg внутри корневого элемента.
     * @returns {void}
     */
    clearErrors() {
        this.root.querySelectorAll('.error-msg').forEach(span => span.innerText = '');
    }

    /**
     * Устанавливает текст ошибки для конкретного поля.
     * Ищет в DOM элемент с ID вида `${fieldId}-error`.
     * 
     * @param {string} fieldId - Идентификатор поля (например, 'email', 'password').
     * @param {string} message - Текст сообщения об ошибке.
     * @returns {void}
     * 
     * @example
     * // Ищет элемент с id="email-error" и ставит ему текст
     * formErrors.setError('email', 'Некорректный формат почты');
     */
    setError(fieldId, message) {
        const element = this.root.querySelector(`#${fieldId}-error`);
        if (element) {
            element.innerText = message;
        }
    }
}
