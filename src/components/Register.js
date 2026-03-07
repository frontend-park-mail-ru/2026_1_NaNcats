import { Component } from '../core/Component.js';
import { registerTemplate } from '../templates/register.tmpl.js';
import { Ajax } from '../core/Ajax.js';
import { validateEmail, validatePassword } from '../utils/validator.js';

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
        const data = {
            name: form.name.value,
            email: form.email.value,
            password: form.password.value,
            repeatPassword: form.repeatPassword.value
        };

        // Сброс ошибок
        form.querySelectorAll('.error').forEach(el => el.innerText = '');

        let isValid = true;

        if (data.name.length < 2) {
            document.getElementById('name-error').innerText = 'Имя слишком короткое';
            isValid = false;
        }
        if (!validateEmail(data.email)) {
            document.getElementById('email-error').innerText = 'Неверный формат email';
            isValid = false;
        }
        if (!validatePassword(data.password)) {
            document.getElementById('password-error').innerText = 'Пароль должен быть > 6 символов';
            isValid = false;
        }
        if (data.password !== data.repeatPassword) {
            document.getElementById('repeatPassword-error').innerText = 'Пароли не совпадают';
            isValid = false;
        }

        if (!isValid) return;

        const payload = {
            name: data.name,
            email: data.email,
            password: data.password
        };

        const resp = await Ajax.post('/auth/register', payload);
        if (resp.ok) {
            window.router.go('/');
        } else {
            const errData = await resp.json();
            alert(`Ошибка регистрации: ${errData.error || 'Попробуйте позже'}`);
        }
    }
}