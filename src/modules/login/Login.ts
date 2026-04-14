import './login.scss';
import { loginTemplate } from './login.tmpl.js';
import { Ajax } from '../../core/Ajax';
import { validateEmail } from '../../shared/utils/Validator';
import { Component } from '../../core/Component';
import { setupAuthView } from '../../shared/utils/AuthSetup';
import { FormErrors } from '../../shared/utils/FormErrors';

/**
 * Компонент страницы авторизации.
 * 
 * @class Login
 * @extends Component
 */
export class Login extends Component {
    /** 
     * Ошибки формы.
     * @type {FormErrors} 
     */
    private formErrors!: FormErrors;

    constructor() {
        super(loginTemplate);
    }

    /**
     * Навешивает обработчики событий после рендеринга.
     * @override
     * @returns {void}
     */
    public afterRender(): void {
        const { errors } = setupAuthView(this, this.onSubmit.bind(this));
        this.formErrors = errors;
        this.setupPasswordToggle();
    }

    private setupPasswordToggle(): void {
        if (!this.element) return;

        const toggles = this.element.querySelectorAll('.js-password-toggle');
        
        toggles.forEach(element => {
            const icon = element as HTMLElement;
            
            icon.onclick = () => {
                const input = icon.parentElement?.querySelector('input') as HTMLInputElement | null;
                
                if (input) {
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon.classList.add('password-wrapper__icon_visible');
                    } else {
                        input.type = 'password';
                        icon.classList.remove('password-wrapper__icon_visible');
                    }
                }
            };
        });
    }

    /**
     * Обрабатывает отправку формы логина.
     * @param {HTMLFormElement} form - Элемент формы.
     * @returns {Promise<void>}
     */
    private async onSubmit(form: HTMLFormElement): Promise<void> {
        this.formErrors.clearErrors();
        
        const emailInput = form.elements.namedItem('email') as HTMLInputElement;
        const passwordInput = form.elements.namedItem('password') as HTMLInputElement;

        const email = emailInput.value.trim();
        const password = passwordInput.value;
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
                const data = await response.json();
                if (data.csrf_token) {
                    Ajax.setCsrfToken(data.csrf_token);
                }
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
