import './promoSlider.scss';
import { Component } from '@shared/lib/component';
import { promoSliderTemplate } from './promoSlider.tmpl.js';

interface PromoSlide {
    img: string;
    title: string;
    text: string;
}

interface PromoProps {
    current: PromoSlide;
}

const SLIDES: PromoSlide[] = [
    {
        img: 'https://img.freepik.com/free-photo/view-delicious-food-assortment_23-2149598944.jpg?t=st=1773128362~exp=1773131962~hmac=7bec2e7e3a0c83384b1d0c94ea34b424b6f853b3884fb061d43e8cda28d6a753&w=2000',
        title: 'Рядом с домом',
        text: 'Найдем самый близкий ресторан и доставим за считанные секунды',
    },
    {
        img: 'https://img.freepik.com/free-photo/high-angle-hand-holding-slice_23-2149598997.jpg?t=st=1773129815~exp=1773133415~hmac=cac80d908ffaa63f4c94cff8cbaa02a3090ca7e922d861df784cf2039d2b04f3&w=2000',
        title: 'Быстрая доставка',
        text: 'Наши курьеры доставят ваш заказ горячим в течение 30 минут',
    },
];

export class PromoSlider extends Component<PromoProps> {
    private index = 0;

    constructor() {
        super(promoSliderTemplate);
    }

    static initialProps(): PromoProps {
        return { current: SLIDES[0] };
    }

    protected onMount(): void {
        const prev = this.root?.querySelector('.js-nav-prev');
        const next = this.root?.querySelector('.js-nav-next');
        if (prev) this.on(prev, 'click', () => this.go(-1));
        if (next) this.on(next, 'click', () => this.go(1));
    }

    private go(delta: number): void {
        this.index = (this.index + delta + SLIDES.length) % SLIDES.length;
        this.update({ current: SLIDES[this.index] });
    }
}
