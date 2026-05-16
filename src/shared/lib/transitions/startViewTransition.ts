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
        const transition = doc.startViewTransition(cb) as
            | { updateCallbackDone?: Promise<unknown>; ready?: Promise<unknown>; finished?: Promise<unknown> }
            | undefined;
        // Промисы View Transition штатно реджектятся: при быстрой повторной
        // навигации переход прерывается следующим, при долгом DOM-апдейте
        // срабатывает таймаут. DOM к этому моменту уже обновлён колбэком,
        // страдает только анимация. Гасим реджекты, иначе они всплывают как
        // Uncaught (in promise) и показываются пользователю как runtime-ошибка.
        const swallow = () => {};
        transition?.updateCallbackDone?.catch(swallow);
        transition?.ready?.catch(swallow);
        transition?.finished?.catch(swallow);
    } else {
        void cb();
    }
}
