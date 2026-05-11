/**
 * Промо-карусель в виде функционального компонента VDOM/JSX.
 *
 * Поведение перенесено из старого `PromoSlider.ts` 1:1: фиксированный набор
 * слайдов, циклическое листание стрелками `prev`/`next` и автопрокрутка по
 * таймеру. Старый виджет автопрокрутку не делал; здесь она появилась по
 * плану юнита (см. Unit 11a). Таймер заводится через `onMount`, сбрасывается
 * через `onCleanup`: при размонтировании виджета (например, при переходе с
 * `/login` на `/`) интервал гарантированно очищается.
 *
 * Дисциплина реактивных выражений (см. JSDoc в `vdom/show.tsx` и `vdom/h.ts`).
 * Атрибуты, зависящие от текущего слайда (`src`, `title`, `text`),
 * передаются как inline-аксессоры `() => SLIDES[index()].img` и т.п.: это
 * единственный способ заставить VDOM реактивно патчить проп.
 */

import './promoSlider.scss';

import { onCleanup, signal } from '@shared/lib/signals';
import { onMount } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';

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
 * Фиксированный набор слайдов карусели.
 *
 * Список преднамеренно жёстко зашит: контент маркетинговый, меняется редко,
 * и тянуть его из стора или с бэкенда нецелесообразно. Если потребуется
 * динамика, проп `slides` можно ввести в {@link PromoSliderProps}.
 */
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

/**
 * Пропсы компонента {@link PromoSlider}.
 *
 * Сейчас компонент полностью без пропов: набор слайдов фиксирован, начальный
 * слайд это первый элемент {@link SLIDES}. Пустой интерфейс оставлен на
 * перспективу: если потребуется передавать слайды извне, поле появится здесь.
 */
export interface PromoSliderProps {
    /** Опциональный индекс начального слайда (по умолчанию 0). */
    initialIndex?: number;
}

/**
 * Функциональный компонент PromoSlider. Хранит индекс текущего слайда в
 * локальном сигнале, реагирует на клики стрелок и сам прокручивает слайды
 * по таймеру.
 *
 * @param props Пропсы виджета.
 * @returns VNode-дерево карусели.
 */
export function PromoSlider(props: PromoSliderProps = {}): VNode {
    const startIndex = ((props.initialIndex ?? 0) % SLIDES.length + SLIDES.length) % SLIDES.length;
    const index = signal<number>(startIndex);

    /**
     * Сдвигает текущий слайд на заданное смещение и циклически нормализует
     * индекс. Прибавление `SLIDES.length` нужно, чтобы корректно работать с
     * отрицательной дельтой (`-1` для стрелки `prev`).
     *
     * @param delta Смещение по индексу.
     */
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
