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
    /** 
     * Контейнер для поиска элементов ошибок.
     * @type {HTMLElement} 
     * @private
     */
    private root: HTMLElement;

    constructor(rootElement: HTMLElement) {
        this.root = rootElement;
    }

    /**
     * Очищает текст во всех элементах с классом .error-msg внутри корневого элемента.
     * @returns {void}
     */
    public clearErrors(): void {
        this.root.querySelectorAll('.error-msg').forEach((span: Element) => {
            (span as HTMLElement).innerText = '';
        });
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
    public setError(fieldId: string, message: string): void {
        const element = this.root.querySelector(`#${fieldId}-error`) as HTMLElement | null;
        if (element) {
            element.innerText = message;
        }
    }
}
