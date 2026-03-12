import { registerTemplate } from './register.tmpl.js';
import { Ajax } from '../../core/Ajax.js';
import { validateEmail, validatePassword, validateName } from '../../core/validator.js';
import { Component } from '../../core/Component.js';
import { setupAuthView } from '../../shared/utils/AuthSetup.js';

/**
 * Компонент страницы регистрации пользователя.
 * @extends Component
 */
export class Register extends Component {
    constructor() {
        super(registerTemplate);
    }

    /**
     * Настраивает обработчики событий (отправка формы, переключение слайдов).
     * @override
     * @returns {void}
     */
    afterRender() {
        const { errors } = setupAuthView(this, this.onSubmit);
        this.formErrors = errors;
    }

    /**
     * Проверяет данные формы и отправляет запрос на регистрацию через API.
     * @param {HTMLFormElement} form - DOM-элемент формы регистрации.
     * @returns {Promise<void>}
     */
    async onSubmit(form) {
        this.formErrors.clearErrors();

        const data = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            password: form.password.value,
            repeatPassword: form.repeatPassword.value
        };

        let isValid = true;

        if (!data.name || !data.email || !data.password || !data.repeatPassword) {
            if (!data.name) this.formErrors.setError('name', 'Введите имя');
            if (!data.email) this.formErrors.setError('email', 'Введите почту');
            if (!data.password) this.formErrors.setError('password', 'Введите пароль');
            if (!data.repeatPassword) this.formErrors.setError('repeatPassword', 'Повторите пароль');
            return;
        }

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
            const resp = await Ajax.post('/auth/register', {
                name: data.name,
                email: data.email,
                password: data.password
            });

            if (resp.ok) {
                window.router.go('/');
            } else {
                const errData = await resp.json();
                const errorMessage = errData.message || '';

                if (errorMessage === "user with this email already exists") {
                    this.formErrors.setError('email', 'Эта почта уже зарегистрирована');
                } else {
                    this.formErrors.setError('name', 'Ошибка регистрации: ' + errorMessage);
                }
            }
        } catch (err) {
            console.error(err);
            this.formErrors.setError('name', 'Ошибка сети');
        }
    }
}