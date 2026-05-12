// Промо-карусель: фиксированный набор слайдов, листание стрелками и автопрокрутка по таймеру.

import './promoSlider.scss';

import { onCleanup, signal } from '@shared/lib/signals';
import { onMount } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

interface PromoSlide {
    img: string;
    title: string;
    text: string;
}

/** Слайды карусели (контент маркетинговый, меняется редко). */
const SLIDES: readonly PromoSlide[] = [
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

/** Интервал автопрокрутки слайдов в миллисекундах. */
const AUTOPLAY_INTERVAL_MS = 5000;

export interface PromoSliderProps {
    /** Индекс начального слайда (по умолчанию 0). */
    initialIndex?: number;
}

/** Промо-карусель: индекс слайда в сигнале, листание стрелками и по таймеру. */
export function PromoSlider(props: PromoSliderProps = {}): VNode {
    const startIndex = ((props.initialIndex ?? 0) % SLIDES.length + SLIDES.length) % SLIDES.length;
    const index = signal<number>(startIndex);

    // Циклический сдвиг слайда; +SLIDES.length для корректной работы с дельтой -1.
    const go = (delta: number): void => {
        index.set((prev) => (prev + delta + SLIDES.length) % SLIDES.length);
    };

    onMount(() => {
        const timerId = setInterval(() => {
            go(1);
        }, AUTOPLAY_INTERVAL_MS);
        onCleanup(() => {
            clearInterval(timerId);
        });
    });

    return (
        <div class="auth-image-side promo-slider">
            <img
                src={(): string => SLIDES[index()].img}
                alt="Food"
                class="promo-image"
            />
            <div class="promo-text">
                <h2 class="promo-text__title">{(): string => SLIDES[index()].title}</h2>
                <p>{(): string => SLIDES[index()].text}</p>
            </div>
            <div class="promo-nav">
                <div
                    class="promo-nav__arrow promo-nav__arrow_prev js-nav-prev"
                    onClick={(): void => go(-1)}
                />
                <div
                    class="promo-nav__arrow promo-nav__arrow_next js-nav-next"
                    onClick={(): void => go(1)}
                />
            </div>
        </div>
    ) as VNode;
}
