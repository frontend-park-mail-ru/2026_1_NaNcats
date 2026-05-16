/**
 * Хелпер для вывода ошибок валидации в разметку формы. Соглашение: рядом с
 * полем id="X" есть элемент с классом error-msg и id="X-error", в его
 * innerText пишется сообщение.
 */
export class FormErrors {
    private readonly root: HTMLElement;

    /**
     * @param rootElement Корневой элемент формы, внутри которого ищутся контейнеры ошибок.
     */
    constructor(rootElement: HTMLElement) {
        this.root = rootElement;
    }

    /** Очищает текст у всех элементов с классом error-msg внутри формы. */
    clearErrors(): void {
        this.root.querySelectorAll('.error-msg').forEach((span) => {
            (span as HTMLElement).innerText = '';
        });
    }

    /**
     * Выводит сообщение об ошибке для поля. Если контейнер "<fieldId>-error"
     * не найден, метод ничего не делает.
     *
     * @param fieldId id поля, для которого показывается ошибка.
     * @param message Текст сообщения.
     */
    setError(fieldId: string, message: string): void {
        const element = this.root.querySelector(`#${fieldId}-error`) as HTMLElement | null;
        if (element) {
            element.innerText = message;
        }
    }
}
