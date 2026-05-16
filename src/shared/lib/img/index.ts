/**
 * Создаёт обработчик ошибки загрузки изображения: при сбое подменяет `src`
 * на запасную картинку.
 *
 * Нужен, потому что строковый атрибут `onerror="this.src=..."` в этом VDOM не
 * работает: проп с именем на `on*` трактуется как обработчик события и
 * отбрасывается, если его значение не функция. Поэтому фолбэк задаётся
 * функцией через проп `onError`.
 *
 * @param fallbackUrl Ссылка на запасное изображение.
 * @returns Обработчик для пропа `onError` у `<img>`.
 */
export function imageFallback(fallbackUrl: string): (event: Event) => void {
    return (event: Event) => {
        const img = event.target as HTMLImageElement | null;
        if (img && img.src !== fallbackUrl) {
            img.src = fallbackUrl;
        }
    };
}
