import './promoSlider.css';
import { Component } from '../../core/Component.js';
import { promoSliderTemplate } from './promoSlider.tmpl.js';

/**
 * Компонент для отображения "красивых картинок".
 * Управляет состоянием текущего слайда и логикой переключения.
 * @class PromoSlider
 * @extends Component
 */
export class PromoSlider extends Component {
    constructor() {
        super(promoSliderTemplate);

        /** 
         * Массив данных для слайдов.
         * @type {Array<{img: string, title: string, text: string}>} 
         */
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

        /** 
         * Индекс текущего активного промо-слайда.
         * @type {number} 
         */
        this.currentPromo = 0;
    }

    /**
     * Отрисовывает слайдер в указанный контейнер, передавая данные текущего слайда.
     * @override
     * @param {HTMLElement} container - Контейнер для вставки компонента.
     * @returns {void}
     */
    mount(container) {
        super.mount(container, { current: this.promoData[this.currentPromo] });
    }

    /**
     * Настраивает обработчики событий для стрелок навигации после рендеринга.
     * @override
     * @returns {void}
     */
    afterRender() {
        this.element.querySelector('.nav-arrow_prev')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo - 1 + this.promoData.length) % this.promoData.length;
            this.update();
        });

        this.element.querySelector('.nav-arrow_next')?.addEventListener('click', () => {
            this.currentPromo = (this.currentPromo + 1) % this.promoData.length;
            this.update();
        });
    }

    /**
     * Перерисовывает компонент слайдера при смене текущего слайда.
     * @returns {void}
     */
    update() {
        this.mount(this.element);
    }
}
