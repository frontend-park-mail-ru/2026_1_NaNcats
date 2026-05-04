import './promoSlider.scss';
import { Component } from '@shared/lib/component';
import { promoSliderTemplate } from './promoSlider.tmpl.js';

/**
 * Один слайд промо-карусели.
 */
interface PromoSlide {
    /** URL изображения для фона слайда. */
    img: string;
    /** Заголовок слайда. */
    title: string;
    /** Подпись под заголовком. */
    text: string;
}

/**
 * Входные данные виджета {@link PromoSlider}.
 */
interface PromoProps {
    /** Слайд, отображаемый в данный момент. */
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

/**
 * Промо-карусель с фиксированным набором слайдов и кнопками переключения.
 *
 * Хранит индекс текущего слайда в локальном поле и обновляет пропс current
 * по нажатию кнопок навигации; листание циклично.
 */
export class PromoSlider extends Component<PromoProps> {
    private index = 0;

    constructor() {
        super(promoSliderTemplate);
    }

    /**
     * Возвращает начальные пропсы виджета: первый слайд из набора.
     *
     * @returns Пропсы для первичной отрисовки.
     */
    static initialProps(): PromoProps {
        return { current: SLIDES[0] };
    }

    /**
     * Подключает обработчики кнопок переключения слайдов после монтирования.
     */
    protected onMount(): void {
        const prev = this.root?.querySelector('.js-nav-prev');
        const next = this.root?.querySelector('.js-nav-next');
        if (prev) this.on(prev, 'click', () => this.go(-1));
        if (next) this.on(next, 'click', () => this.go(1));
    }

    /**
     * Сдвигает текущий слайд на заданное смещение и перерисовывает виджет.
     *
     * @param delta Смещение по индексу: положительное вперёд, отрицательное назад.
     */
    private go(delta: number): void {
        this.index = (this.index + delta + SLIDES.length) % SLIDES.length;
        this.update({ current: SLIDES[this.index] });
    }
}
