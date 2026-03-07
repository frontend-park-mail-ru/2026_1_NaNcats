import { Component } from '../core/Component.js';
import { loginTemplate } from '../templates/login.tmpl.js';
import { Ajax } from '../core/Ajax.js';
import { validateEmail } from '../utils/validator.js';

/**
 * Компонент страницы авторизации.
 * @extends Component
 */
export class Login extends Component {
    /**
     * Инициализирует компонент логина и данные промо-слайдера.
     */
    constructor() {
        super(loginTemplate);
        /** @type {Array<{img: string, title: string, text: string}>} Данные для слайдера */
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
        /** @type {number} Индекс текущего слайда */
        this.currentPromo = 0;
    }

    /**
     * Очищает все сообщения об ошибках в форме.
     * @returns {void}
     */
    clearErrors() {
        const errorSpans = document.querySelectorAll('.error-msg');
        errorSpans.forEach(span => {
            span.innerText = '';
        });
    }

    /**
     * Устанавливает текст ошибки для конкретного поля.
     * @param {string} fieldId - ID поля.
     * @param {string} message - Текст ошибки.
     * @returns {void}
     */
    setError(fieldId, message) {
        const element = document.getElementById(`${fieldId}-error`);
        if (element) {
            element.innerText = message;
        }
    }

    /**
     * Обновляет контент промо-слайдера в DOM.
     * @returns {void}
     */
    updatePromo() {
        const data = this.promoData[this.currentPromo];
        const side = document.querySelector('.auth-image-side');
        if (side) {
            const img = side.querySelector('.promo-image');
            const title = side.querySelector('.promo-text h2');
            const p = side.querySelector('.promo-text p');
            if (img) img.src = data.img;
            if (title) title.innerText = data.title;
            if (p) p.innerText = data.text;
        }
    }

    /**
     * Навешивает обработчики событий после рендеринга.
     * @override
     * @returns {void}
     */
    afterRender() {
        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(form);
            });
        }

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

                if (errorMessage.includes("user not found")) {
                    this.setError('email', 'Пользователь с такой почтой не найден');
                } else if (errorMessage.includes("hashedPassword")) {
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