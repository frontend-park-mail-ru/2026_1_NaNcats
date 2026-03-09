import { Component } from '../../core/Component.js';

export class AuthComponent extends Component {
    constructor(template) {
        super(template);
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
            const img = side.querySelector('.promo-image');
            const title = side.querySelector('.promo-text h2');
            const p = side.querySelector('.promo-text p');
            if (img) img.src = data.img;
            if (title) title.innerText = data.title;
            if (p) p.innerText = data.text;
        }
    }

    clearErrors() {
        document.querySelectorAll('.error-msg').forEach(span => span.innerText = '');
    }

    setError(fieldId, message) {
        const element = document.getElementById(`${fieldId}-error`);
        if (element) element.innerText = message;
    }

    initPromoEvents() {
        document.querySelector('.nav-arrow_prev')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo - 1 + this.promoData.length) % this.promoData.length;
            this.updatePromo();
        });

        document.querySelector('.nav-arrow_next')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo + 1) % this.promoData.length;
            this.updatePromo();
        });
    }
}
