import { loginTemplate } from './login.tmpl.js';
import { Ajax } from '../../core/Ajax.js';
import { validateEmail } from '../../core/validator.js';
import { AuthComponent } from '../auth/AuthComponent.js';

/**
 * Компонент страницы авторизации.
 * @extends AuthComponent
 */
export class Login extends AuthComponent {
    /**
     * Инициализирует компонент логина и данные промо-слайдера.
     */
    constructor() {
        super(loginTemplate);
    }

    /**
     * Навешивает обработчики событий после рендеринга.
     * @override
     * @returns {void}
     */
    afterRender() {
        this.initPromoEvents();

        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(form);
            });
        }
    }

    /**
     * Обрабатывает отправку формы логина.
     * @param {HTMLFormElement} form - Элемент формы.
     * @returns {Promise<void>}
     */
    async handleSubmit(form) {
        this.clearErrors();
        
        const email = form.email.value.trim();
        const password = form.password.value;
        let isValid = true;

        if (!validateEmail(email)) {
            this.setError('email', 'Некорректный формат почты');
            isValid = false;
        }

        if (!password) {
            this.setError('password', 'Введите пароль');
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
                    this.setError('form', 'Неверная почта или пароль');
                } else {
                    this.setError('form', 'Ошибка входа: ' + errorMessage);
                }
            }
        } catch (err) {
            console.error('Network error:', err);
            this.setError('email', 'Проблема с соединением');
        }
    }
}