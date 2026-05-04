import { Component } from '@shared/lib/component';
import { FormErrors } from '@shared/lib/formErrors';
import { validateEmail, validateName, validatePassword } from '@shared/lib/validation';
import { ApiError } from '@shared/api/http';
import { registerFormTemplate } from './registerForm.tmpl.js';
import { registerAction } from '../model/registerAction';

/**
 * Параметры формы регистрации.
 */
export interface RegisterFormProps {
    /** Колбэк, вызываемый после успешной регистрации. */
    onSuccess?: () => void;
}

/**
 * Форма регистрации: проверяет имя, почту, пароль и его подтверждение,
 * отправляет данные через {@link registerAction} и отображает ошибки
 * валидации и сервера.
 */
export class RegisterForm extends Component<RegisterFormProps> {
    private formErrors: FormErrors | null = null;

    constructor() {
        super(registerFormTemplate);
    }

    /**
     * Инициализирует обработчик формы и переключатели видимости пароля.
     */
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

    /**
     * Валидирует значения полей и выполняет регистрацию.
     *
     * Пустые поля, некорректное имя, неверный формат почты, слабый пароль и
     * несовпадение подтверждения сообщаются через {@link FormErrors}. Конфликт
     * по почте (HTTP 409) отображается отдельным сообщением; прочие ошибки
     * сервера и сетевые сбои показываются у поля имени.
     *
     * @param form Элемент формы, из которого читаются значения.
     */
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

/**
 * Переключает тип поля ввода пароля между `password` и `text` и обновляет
 * визуальное состояние иконки.
 *
 * @param icon Элемент иконки-переключателя видимости пароля.
 */
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
