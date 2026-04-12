import './register.scss';
import { registerTemplate } from './register.tmpl.js';
import { Ajax } from '../../core/Ajax';
import { validateEmail, validatePassword, validateName } from '../../shared/utils/Validator';
import { Component } from '../../core/Component';
import { setupAuthView } from '../../shared/utils/AuthSetup';
import { FormErrors } from '../../shared/utils/FormErrors';

/**
 * Компонент страницы регистрации пользователя.
 * 
 * @class Register
 * @extends Component
 */
export class Register extends Component {
    /** 
     * Ошибки формы.
     * @type {FormErrors} 
     */
    private formErrors!: FormErrors;

    constructor() {
        super(registerTemplate);
    }

    /**
     * Настраивает обработчики событий (отправка формы, переключение слайдов).
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
     * Проверяет данные формы и отправляет запрос на регистрацию через API.
     * @param {HTMLFormElement} form - DOM-элемент формы регистрации.
     * @returns {Promise<void>}
     */
    private async onSubmit(form: HTMLFormElement): Promise<void> {
        this.formErrors.clearErrors();

        const nameInput = form.elements.namedItem('name') as HTMLInputElement;
        const emailInput = form.elements.namedItem('email') as HTMLInputElement;
        const passwordInput = form.elements.namedItem('password') as HTMLInputElement;
        const repeatPasswordInput = form.elements.namedItem('repeatPassword') as HTMLInputElement;

        const data = {
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value,
            repeatPassword: repeatPasswordInput.value
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

                if (resp.status === 409) {
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
