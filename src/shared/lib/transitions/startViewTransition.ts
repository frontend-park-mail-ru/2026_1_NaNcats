/**
 * Обёртка над View Transitions API: запускает callback внутри document.startViewTransition,
 * если браузер поддерживает API, иначе вызывает callback напрямую.
 *
 * Назначение обёртки: дать роутеру единый способ обновлять DOM при смене роута,
 * не разбираясь каждый раз, доступна ли в текущем рантайме нативная анимация
 * переходов. Контракт: callback это атомарный коммит, выполняющий синхронные
 * set-операции над сигналами и провоцирующий патч DOM. Все наблюдаемые мутации
 * должны произойти внутри callback, иначе View Transitions API не сможет
 * захватить целевое состояние и анимация будет невалидной.
 *
 * Тонкость порядка: startViewTransition обязательно вызывается ПОСЛЕ того, как
 * route-loader разрешился. Если запустить обёртку до await loader, браузер
 * снимет snapshot с прежнего DOM, а до фактического коммита успеет смениться
 * содержимое страницы, и морф не сыграет. Эта инвариантность контролируется на
 * вызывающей стороне (Router.go), здесь обёртка лишь делегирует.
 *
 * Graceful fallback: если document.startViewTransition не определён (jsdom,
 * Firefox без флага, Safari старее 18.2), callback исполняется напрямую. Это
 * сохраняет рабочее приложение, отключая анимацию.
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
