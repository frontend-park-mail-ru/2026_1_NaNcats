import { registerTemplate } from './register.tmpl.js';
import { Ajax } from '../../core/Ajax.js';
import { validateEmail, validatePassword, validateName } from '../../core/validator.js';
import { AuthComponent } from '../auth/AuthComponent.js';

/**
 * Компонент страницы регистрации пользователя.
 * @extends AuthComponent
 */
export class Register extends AuthComponent {
    /**
     * Создает компонент регистрации и инициализирует данные промо-блока.
     */
    constructor() {
        super(registerTemplate);
    }

    /**
     * Настраивает обработчики событий (отправка формы, переключение слайдов).
     * @override
     * @returns {void}
     */
    afterRender() {
        this.initPromoEvents();

        const form = document.getElementById('auth-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.onSubmit(form);
            });
        }
    }

    /**
     * Проверяет данные формы и отправляет запрос на регистрацию через API.
     * @param {HTMLFormElement} form - DOM-элемент формы регистрации.
     * @returns {Promise<void>}
     */
    async onSubmit(form) {
        this.clearErrors();

        const data = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            password: form.password.value,
            repeatPassword: form.repeatPassword.value
        };

        let isValid = true;

        if (!data.name || !data.email || !data.password || !data.repeatPassword) {
            if (!data.name) this.setError('name', 'Введите имя');
            if (!data.email) this.setError('email', 'Введите почту');
            if (!data.password) this.setError('password', 'Введите пароль');
            if (!data.repeatPassword) this.setError('repeatPassword', 'Повторите пароль');
            return;
        }

        if (!validateName(data.name)) {
            this.setError('name', 'Имя должно быть от 4 до 30 символов');
            isValid = false;
        }
        
        if (!validateEmail(data.email)) {
            this.setError('email', 'Неверный формат почты');
            isValid = false;
        }

        if (!validatePassword(data.password)) {
            this.setError('password', 'Пароль от 8 символов без пробелов');
            isValid = false;
        }

        if (data.password !== data.repeatPassword) {
            this.setError('repeatPassword', 'Пароли не совпадают');
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
                    this.setError('email', 'Эта почта уже зарегистрирована');
                } else {
                    this.setError('name', 'Ошибка регистрации: ' + errorMessage);
                }
            }
        } catch (err) {
            console.error(err);
            this.setError('name', 'Ошибка сети');
        }
    }
}