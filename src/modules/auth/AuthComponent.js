import { Component } from '../../core/Component.js';

export class AuthComponent extends Component {
    constructor(template) {
        super(template);
        this.promoData = [
            {
                img: 'https://img.freepik.com/free-photo/view-delicious-food-assortment_23-2149598944.jpg?t=st=1773128362~exp=1773131962~hmac=7bec2e7e3a0c83384b1d0c94ea34b424b6f853b3884fb061d43e8cda28d6a753&w=2000',
                title: 'Рядом с домом',
                text: 'Найдем самый близкий ресторан и доставим за считанные секунды'
            },
            {
                img: 'https://img.freepik.com/free-photo/high-angle-hand-holding-slice_23-2149598997.jpg?t=st=1773129815~exp=1773133415~hmac=cac80d908ffaa63f4c94cff8cbaa02a3090ca7e922d861df784cf2039d2b04f3&w=2000',
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
