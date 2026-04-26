export class FormErrors {
    private readonly root: HTMLElement;

    constructor(rootElement: HTMLElement) {
        this.root = rootElement;
    }

    clearErrors(): void {
        this.root.querySelectorAll('.error-msg').forEach((span) => {
            (span as HTMLElement).innerText = '';
        });
    }

    setError(fieldId: string, message: string): void {
        const element = this.root.querySelector(`#${fieldId}-error`) as HTMLElement | null;
        if (element) {
            element.innerText = message;
        }
    }
}
