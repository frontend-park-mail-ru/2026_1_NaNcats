/**
 * Хелпер для отображения ошибок валидации формы в её разметке.
 *
 * Работает по соглашению: рядом с каждым полем, у которого id равно X, в
 * шаблоне есть элемент с классом error-msg и id вида "X-error". Хелпер
 * пишет в его innerText сообщение об ошибке либо очищает все такие элементы
 * сразу. Сама валидация и привязка к input-событиям остаются на стороне
 * вызывающей формы.
 */
export class FormErrors {
    private readonly root: HTMLElement;

    /**
     * @param rootElement Корневой элемент формы, внутри которого ищутся
     *   контейнеры ошибок.
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
     * Выводит сообщение об ошибке для конкретного поля.
     *
     * Если контейнер с id "<fieldId>-error" не найден, метод тихо ничего не
     * делает; это даёт устойчивость к опечаткам в шаблоне без падения формы.
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
