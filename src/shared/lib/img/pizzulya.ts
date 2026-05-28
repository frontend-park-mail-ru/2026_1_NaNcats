/**
 * Гифки-стикеры маскота «пиццуля». Хранятся на внешнем CDN. Собраны в одном
 * месте, чтобы их можно было переиспользовать (модалка колеса, лоадер) и
 * предзагрузить одним вызовом.
 */

/** Обычная пиццуля (стикер по умолчанию в колесе). */
export const PIZZULYA_DEFAULT_GIF = 'https://cdn.dprofile.ru/public/60222/109261/5023ee194828983.6606f5d69fbe5.gif';

/** Пиццуля «в нокауте» — показывается на короткое время по клику. */
export const PIZZULYA_KNOCKOUT_GIF = 'https://cdn.dprofile.ru/public/60222/109261/9ceb9c194828983.6606f5d6a066e.gif';

/** Крутящаяся пиццуля — индикатор загрузки вместо скелетона. */
export const PIZZULYA_LOADING_GIF = 'https://cdn.dprofile.ru/public/60222/109261/32517c194828983.6606f5d69e146.gif';

/** Все гифки маскота — для предзагрузки. */
const ALL_PIZZULYA_GIFS = [PIZZULYA_DEFAULT_GIF, PIZZULYA_KNOCKOUT_GIF, PIZZULYA_LOADING_GIF];

let preloaded = false;

/**
 * Предзагружает все гифки пиццули в кэш браузера. Вызывается один раз при
 * старте приложения, чтобы анимации появлялись мгновенно (особенно лоадер и
 * стикер «в нокауте» по клику). Повторные вызовы игнорируются.
 */
export function preloadPizzulyaGifs(): void {
    if (preloaded || typeof Image === 'undefined') return;
    preloaded = true;
    for (const url of ALL_PIZZULYA_GIFS) {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
    }
}
