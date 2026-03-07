import { Component } from '../core/Component.js';
import { registerTemplate } from '../templates/register.tmpl.js';
import { Ajax } from '../core/Ajax.js';
import { validateEmail, validatePassword, validateName } from '../utils/validator.js';

/**
 * Компонент страницы регистрации пользователя.
 * @extends Component
 */
export class Register extends Component {
    /**
     * Создает компонент регистрации и инициализирует данные промо-блока.
     */
    constructor() {
        super(registerTemplate);
        /** @type {Array<{img: string, title: string, text: string}>} Список слайдов для промо-блока */
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
        /** @type {number} Индекс текущего активного слайда */
        this.currentPromo = 0;
    }

    /**
     * Скрывает все сообщения об ошибках валидации на странице.
     * @returns {void}
     */
    clearErrors() {
        const errorSpans = document.querySelectorAll('.error-msg');
        errorSpans.forEach(span => {
            span.innerText = '';
        });
    }

    /**
     * Отображает ошибку для конкретного поля формы.
     * @param {string} fieldId - Идентификатор поля (name, email, password и т.д.).
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
     * Настраивает обработчики событий (отправка формы, переключение слайдов).
     * @override
     * @returns {void}
     */
    afterRender() {
        const form = document.getElementById('auth-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.onSubmit(form);
            });
        }
        
        document.querySelector('.nav-arrow_next')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo + 1) % this.promoData.length;
            this.updatePromo();
        });
        
        document.querySelector('.nav-arrow_prev')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo - 1 + this.promoData.length) % this.promoData.length;
            this.updatePromo();
        });
    }

    /**
     * Обновляет изображение и текст в промо-блоке согласно текущему индексу.
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
            console.error(err);
            this.setError('name', 'Ошибка сети');
        }
    }
}