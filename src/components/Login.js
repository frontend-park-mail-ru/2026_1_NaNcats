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
        document.querySelector('.nav-arrow.prev')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo - 1 + this.promoData.length) % this.promoData.length;
            this.updatePromo();
        });

        document.querySelector('.nav-arrow.next')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo + 1) % this.promoData.length;
            this.updatePromo();
        });
    }

    /**
     * Обработка формы
     * @param {HTMLFormElement} form 
     */
    async handleSubmit(form) {
        const email = form.email.value;
        const password = form.password.value;

        // Валидация
        if (!validateEmail(email)) {
            document.getElementById('email-error').innerText = 'Некорректный email';
            return;
        }

        try {
            const response = await Ajax.post('/api/login', { email, password });
            if (response.ok) {
                // Переход на главную (SPA Router)
                window.router.go('/');
            } else {
                alert('Ошибка входа');
            }
        } catch (err) {
            console.error(err);
        }
    }
}