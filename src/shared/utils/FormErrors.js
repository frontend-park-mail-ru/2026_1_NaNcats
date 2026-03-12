export class FormErrors {
    constructor(rootElement) {
        this.root = rootElement;
    }

    clearErrors() {
        this.root.querySelectorAll('.error-msg').forEach(span => span.innerText = '');
    }

    setError(fieldId, message) {
        const element = this.root.querySelector(`#${fieldId}-error`);
        if (element) element.innerText = message;
    }
}
