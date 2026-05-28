/**
 * Лоадер-плейсхолдер страниц: крутящаяся пиццуля вместо скелетона. Показывается
 * Outlet-ом, пока loader роута и dynamic-import чанка страницы не разрешились.
 * Гифка предзагружается на старте приложения (см. preloadPizzulyaGifs), поэтому
 * появляется мгновенно. Статичен: ни сигналов, ни effect-ов.
 */

import './PizzaLoader.scss';
import type { VNode } from '@shared/lib/vdom';
import { PIZZULYA_LOADING_GIF } from '@shared/lib/img/pizzulya';

/**
 * Возвращает VNode крутящейся пиццули по центру экрана.
 *
 * @returns VNode лоадера.
 */
export function PizzaLoader(): VNode {
    return (
        <div class="pizza-loader" aria-busy="true" aria-live="polite">
            <img
                class="pizza-loader__img"
                src={PIZZULYA_LOADING_GIF}
                alt="Загрузка"
                onError={(e: Event) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const fallback = img.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                }}
            />
            <div class="pizza-loader__fallback">🍕</div>
            <div class="pizza-loader__caption">Готовим…</div>
        </div>
    );
}
