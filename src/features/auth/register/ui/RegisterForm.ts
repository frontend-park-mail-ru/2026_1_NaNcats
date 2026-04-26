import { Component } from '@shared/lib/component';
import { FormErrors } from '@shared/lib/formErrors';
import { validateEmail, validateName, validatePassword } from '@shared/lib/validation';
import { ApiError } from '@shared/api/http';
import { registerFormTemplate } from './registerForm.tmpl.js';
import { registerAction } from '../model/registerAction';

export interface RegisterFormProps {
    onSuccess?: () => void;
}

export class RegisterForm extends Component<RegisterFormProps> {
    private formErrors: FormErrors | null = null;

    constructor() {
        super(registerFormTemplate);
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

        const data = {
            name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
            email: (form.elements.namedItem('email') as HTMLInputElement).value.trim(),
            password: (form.elements.namedItem('password') as HTMLInputElement).value,
            repeatPassword: (form.elements.namedItem('repeatPassword') as HTMLInputElement).value,
        };

        if (!data.name || !data.email || !data.password || !data.repeatPassword) {
            if (!data.name) this.formErrors.setError('name', 'Введите имя');
            if (!data.email) this.formErrors.setError('email', 'Введите почту');
            if (!data.password) this.formErrors.setError('password', 'Введите пароль');
            if (!data.repeatPassword) this.formErrors.setError('repeatPassword', 'Повторите пароль');
            return;
        }

        let isValid = true;
        if (!validateName(data.name)) {
            this.formErrors.setError('name', 'Имя должно быть от 4 до 30 символов');
            isValid = false;
        }
        if (!validateEmail(data.email)) {
            this.formErrors.setError('email', 'Неверный формат почты');
            isValid = false;
        }
        if (!validatePassword(data.password)) {
            this.formErrors.setError('password', 'Пароль от 8 символов без пробелов');
            isValid = false;
        }
        if (data.password !== data.repeatPassword) {
            this.formErrors.setError('repeatPassword', 'Пароли не совпадают');
            isValid = false;
        }
        if (!isValid) return;

        try {
            await registerAction({ name: data.name, email: data.email, password: data.password });
            this.props.onSuccess?.();
        } catch (e) {
            if (e instanceof ApiError) {
                if (e.status === 409) {
                    this.formErrors.setError('email', 'Эта почта уже зарегистрирована');
                } else {
                    this.formErrors.setError('name', 'Ошибка регистрации: ' + e.message);
                }
            } else {
                this.formErrors.setError('name', 'Ошибка сети');
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
