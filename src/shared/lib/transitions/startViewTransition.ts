/**
 * Обёртка над View Transitions API: запускает callback внутри
 * document.startViewTransition, если он есть, иначе вызывает callback напрямую.
 * callback должен атомарно выполнить все наблюдаемые DOM-мутации, иначе API не
 * захватит целевое состояние. Вызывать обёртку нужно после того, как
 * route-loader разрешился (за этим следит вызывающая сторона).
 *
 * @param cb Колбэк, выполняющий синхронный коммит DOM-мутаций.
 */
export function startViewTransition(cb: () => void | Promise<void>): void {
    const doc = document as Document & {
        startViewTransition?: (cb: () => void | Promise<void>) => unknown;
    };
    if (typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(cb);
    } else {
        void cb();
    }
}
