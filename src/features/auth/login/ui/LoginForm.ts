import { Component } from '@shared/lib/component';
import { FormErrors } from '@shared/lib/formErrors';
import { validateEmail } from '@shared/lib/validation';
import { ApiError } from '@shared/api/http';
import { loginFormTemplate } from './loginForm.tmpl.js';
import { loginAction } from '../model/loginAction';

export interface LoginFormProps {
    onSuccess?: () => void;
}

export class LoginForm extends Component<LoginFormProps> {
    private formErrors: FormErrors | null = null;

    constructor() {
        super(loginFormTemplate);
    }

    protected onMount(): void {
        if (!this.root) return;
        this.formErrors = new FormErrors(this.root);

        const form = this.root.querySelector('#auth-form') as HTMLFormElement | null;
        if (form) {
            this.on(form, 'submit', (e) => {
                e.preventDefault();
                void this.submit(form);
            });
        }

        this.root.querySelectorAll('.js-password-toggle').forEach((node) => {
            const icon = node as HTMLElement;
            this.on(icon, 'click', () => togglePasswordVisibility(icon));
        });
    }

    private async submit(form: HTMLFormElement): Promise<void> {
        if (!this.formErrors) return;
        this.formErrors.clearErrors();

        const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;

        if (!email || !password) {
            if (!email) this.formErrors.setError('email', 'Введите почту');
            if (!password) this.formErrors.setError('password', 'Введите пароль');
            return;
        }
        if (!validateEmail(email)) {
            this.formErrors.setError('email', 'Некорректный формат почты');
            return;
        }

        try {
            await loginAction(email, password);
            this.props.onSuccess?.();
        } catch (e) {
            if (e instanceof ApiError) {
                if (e.message === 'Invalid email or password') {
                    this.formErrors.setError('password', 'Неверная почта или пароль');
                } else {
                    this.formErrors.setError('password', 'Ошибка входа: ' + e.message);
                }
            } else {
                this.formErrors.setError('email', 'Проблема с соединением');
            }
        }
    }
}

function togglePasswordVisibility(icon: HTMLElement): void {
    const input = icon.parentElement?.querySelector('input') as HTMLInputElement | null;
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.add('password-wrapper__icon_visible');
    } else {
        input.type = 'password';
        icon.classList.remove('password-wrapper__icon_visible');
    }
}
