import { Component } from '../core/Component.js';
import { loginTemplate } from '../templates/login.tmpl.js';
import { Ajax } from '../core/Ajax.js';
import { validateEmail } from '../utils/validator.js';

/**
 * Компонент страницы логина
 */
export class Login extends Component {
    constructor() {
        super(loginTemplate);
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

    updatePromo() {
        const data = this.promoData[this.currentPromo];
        const side = document.querySelector('.auth-image-side');
        if (side) {
            side.querySelector('.promo-image').src = data.img;
            side.querySelector('.promo-text h2').innerText = data.title;
            side.querySelector('.promo-text p').innerText = data.text;
        }
    }


    afterRender() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(form);
        });

        // Обработчики для кнопок слайдера
        document.querySelector('.nav-arrow_prev')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo - 1 + this.promoData.length) % this.promoData.length;
            this.updatePromo();
        });

        document.querySelector('.nav-arrow_next')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo + 1) % this.promoData.length;
            this.updatePromo();
        });
    }

    /**
     * Обработка формы
     * @param {HTMLFormElement} form 
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

                if (errorMessage.includes("user not found")) {
                    this.setError('email', 'Пользователь с такой почтой не найден');
                } else if (errorMessage.includes("hashedPassword is not the hash of the given password")) {
                    this.setError('password', 'Неверный пароль');
                } else {
                    this.setError('email', 'Ошибка входа: ' + errorMessage);
                }
            }
        } catch (err) {
            console.error('Network error:', err);
            this.setError('email', 'Проблема с соединением');
        }
    }
}