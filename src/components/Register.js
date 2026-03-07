import { Component } from '../core/Component.js';
import { registerTemplate } from '../templates/register.tmpl.js';
import { Ajax } from '../core/Ajax.js';
import { validateEmail, validatePassword, validateName } from '../utils/validator.js';

/**
 * Компонент регистрации
 * @extends Component
 */
export class Register extends Component {
    constructor() {
        super(registerTemplate);
        this.promoData = [
            {
                img: 'https://img.freepik.com/free-photo/delicious-burger-with-fresh-ingredients_23-2150857908.jpg',
                title: 'Рядом с домом',
                text: 'Найдем самый близкий ресторан и доставим за считанные секунды'
            },
            {
                img: 'https://img.freepik.com/free-photo/top-view-pepperoni-pizza-with-mushroom-slices-and-cherry-tomatoes_141793-2157.jpg',
                title: 'Быстрая доставка',
                text: 'Наши курьеры доставят ваш заказ горячим в течение 30 минут'
            }
        ];
        this.currentPromo = 0;
    }

    clearErrors() {
        const errorSpans = document.querySelectorAll('.error-msg');
        errorSpans.forEach(span => span.innerText = '');
    }

    setError(fieldId, message) {
        const element = document.getElementById(`${fieldId}-error`);
        if (element) {
            element.innerText = message;
        }
    }

    afterRender() {
        const form = document.getElementById('auth-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.onSubmit(form);
        });
        
        document.querySelector('.nav-arrow_next')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo + 1) % this.promoData.length;
            this.updatePromo();
        });
        
        document.querySelector('.nav-arrow_prev')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo - 1 + this.promoData.length) % this.promoData.length;
            this.updatePromo();
        });
    }

    updatePromo() {
        const data = this.promoData[this.currentPromo];
        document.querySelector('.promo-image').src = data.img;
        document.querySelector('.promo-text h2').innerText = data.title;
        document.querySelector('.promo-text p').innerText = data.text;
    }

    /**
     * Валидация и отправка формы
     * @param {HTMLFormElement} form
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

                if (errorMessage.includes("already exists")) {
                    this.setError('email', 'Эта почта уже зарегистрирована');
                } else if (errorMessage.includes("wrong email syntax")) {
                    this.setError('email', 'Сервер не принимает такую почту');
                } else {
                    this.setError('name', 'Ошибка регистрации: ' + errorMessage);
                }
            }
        } catch (err) {
            this.setError('name', 'Ошибка сети');
        }
    }
}