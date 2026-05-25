/**
 * Скелетоны под конкретные страницы: повторяют каркас реальной верстки
 * (сайдбар, карусели, корзина, форма), чтобы момент подгрузки чанка/loader-а
 * был визуально близок к итоговому экрану и не вызывал layout shift.
 */

import './pageSkeletons.scss';
import type { VNode } from '@shared/lib/vdom';

/** Скелетон главной: сайдбар категорий + карусель «Вы заказывали»/«Попробуйте» + сетка ресторанов. */
export function HomePageSkeleton(): VNode {
    return (
        <div class="page-skel" aria-busy="true" aria-live="polite">
            <div class="page-skel__col page-skel__col_sidebar">
                <div class="page-skel__line page-skel__line_lg" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
            </div>
            <div class="page-skel__col page-skel__col_main">
                <div class="page-skel__line page-skel__line_lg" />
                <div class="page-skel__grid page-skel__grid_carousel">
                    <div class="page-skel__tile page-skel__tile_sm" />
                    <div class="page-skel__tile page-skel__tile_sm" />
                    <div class="page-skel__tile page-skel__tile_sm" />
                    <div class="page-skel__tile page-skel__tile_sm" />
                </div>
                <div class="page-skel__line page-skel__line_lg" />
                <div class="page-skel__grid">
                    <div class="page-skel__tile" />
                    <div class="page-skel__tile" />
                    <div class="page-skel__tile" />
                    <div class="page-skel__tile" />
                    <div class="page-skel__tile" />
                    <div class="page-skel__tile" />
                </div>
            </div>
        </div>
    );
}

/** Скелетон ресторана: меню-сайдбар + большая шапка с логотипом + список блюд + правая колонка корзины. */
export function RestaurantPageSkeleton(): VNode {
    return (
        <div class="page-skel" aria-busy="true" aria-live="polite">
            <div class="page-skel__col page-skel__col_sidebar">
                <div class="page-skel__line page-skel__line_lg" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
            </div>
            <div class="page-skel__col page-skel__col_main">
                <div class="page-skel__box page-skel__box_hero" />
                <div class="page-skel__box page-skel__box_strip" />
                <div class="page-skel__line page-skel__line_lg" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
            </div>
            <div class="page-skel__col page-skel__col_aside">
                <div class="page-skel__box page-skel__box_card" />
                <div class="page-skel__box page-skel__box_card" />
            </div>
        </div>
    );
}

/** Скелетон профиля: сайдбар с аватаром/строками + main с карточками адресов/карт/истории. */
export function ProfilePageSkeleton(): VNode {
    return (
        <div class="page-skel" aria-busy="true" aria-live="polite">
            <div class="page-skel__col page-skel__col_sidebar">
                <div class="page-skel__tile page-skel__tile_avatar" />
                <div class="page-skel__box page-skel__box_card" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
                <div class="page-skel__row" />
            </div>
            <div class="page-skel__col page-skel__col_main">
                <div class="page-skel__box page-skel__box_card" />
                <div class="page-skel__box page-skel__box_card" />
                <div class="page-skel__box page-skel__box_card" />
            </div>
        </div>
    );
}

/** Скелетон оформления заказа: одна колонка с карточками адреса/состава/оплаты/промо/итога. */
export function CheckoutPageSkeleton(): VNode {
    return (
        <div class="page-skel" aria-busy="true" aria-live="polite" style="flex-direction: column;">
            <div class="page-skel__line page-skel__line_lg" />
            <div class="page-skel__box page-skel__box_card" />
            <div class="page-skel__box page-skel__box_card" />
            <div class="page-skel__box page-skel__box_card" />
            <div class="page-skel__box page-skel__box_strip" />
            <div class="page-skel__box page-skel__box_strip" />
        </div>
    );
}

/** Скелетон форм авторизации (login/register): центрированный блок с строками-инпутами. */
export function AuthPageSkeleton(): VNode {
    return (
        <div class="page-skel__auth" aria-busy="true" aria-live="polite">
            <div class="page-skel__line page-skel__line_lg" />
            <div class="page-skel__row" />
            <div class="page-skel__row" />
            <div class="page-skel__box page-skel__box_strip" />
        </div>
    );
}

/** Скелетон страницы 404: коротенький блок с заголовком и кнопкой. */
export function NotFoundPageSkeleton(): VNode {
    return (
        <div class="page-skel__notfound" aria-busy="true" aria-live="polite">
            <div class="page-skel__line page-skel__line_lg" />
            <div class="page-skel__line" />
            <div class="page-skel__box page-skel__box_strip" />
        </div>
    );
}
