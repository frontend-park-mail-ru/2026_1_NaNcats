import { loginTemplate } from './login.tmpl.js';
import { Ajax } from '../../core/Ajax.js';
import { validateEmail } from '../../shared/utils/Validator.js';
import { Component } from '../../core/Component.js';
import { setupAuthView } from '../../shared/utils/AuthSetup.js';

/**
 * Компонент страницы авторизации.
 * 
 * @class Login
 * @extends Component
 */
export class Login extends Component {
    constructor() {
        super(loginTemplate);
    }

    /**
     * Навешивает обработчики событий после рендеринга.
     * @override
     * @returns {void}
     */
    afterRender() {
        const { errors } = setupAuthView(this, this.onSubmit);
        this.formErrors = errors;
    }

    /**
     * Обрабатывает отправку формы логина.
     * @param {HTMLFormElement} form - Элемент формы.
     * @returns {Promise<void>}
     */
    async onSubmit(form) {
        this.formErrors.clearErrors();
        
        const email = form.email.value.trim();
        const password = form.password.value;
        let isValid = true;

        if (!email || !password) {
            if (!email) this.formErrors.setError('email', 'Введите почту');
            if (!password) this.formErrors.setError('password', 'Введите пароль');
            return;
        }

        if (!validateEmail(email)) {
            this.formErrors.setError('email', 'Некорректный формат почты');
            isValid = false;
        }

        if (!password) {
            this.formErrors.setError('password', 'Введите пароль');
            isValid = false;
        }

        if (!isValid) return;

        try {
            const response = await Ajax.post('/auth/login', { login: email, password });
            
            if (response.ok) {
                window.router.go('/');
            } else {
                const errData = await response.json();
                const errorMessage = errData.message || '';

                if (errorMessage === "Invalid email or password") {
                    this.formErrors.setError('password', 'Неверная почта или пароль');
                } else {
                    this.formErrors.setError('password', 'Ошибка входа: ' + errorMessage);
                }
            }
        } catch (err) {
            console.error('Network error:', err);
            this.formErrors.setError('email', 'Проблема с соединением');
        }
    }
}
