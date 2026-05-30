/**
 * Блокировка фонового скролла на время показа модалок/оверлеев. Реализация
 * через `position: fixed` на body — это единственный способ, который надёжно
 * останавливает скролл и в Safari на iOS (там `overflow: hidden` на body
 * игнорируется). Счётчик ссылок позволяет вкладывать несколько оверлеев:
 * скролл разблокируется только когда закрыт последний.
 */

let lockCount = 0;
let savedScrollY = 0;

/** Блокирует скролл страницы. Идемпотентно по счётчику ссылок. */
export function lockScroll(): void {
    lockCount += 1;
    if (lockCount > 1) return;

    savedScrollY = window.scrollY;
    const { body } = document;
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
}

/** Снимает одну блокировку; при достижении нуля восстанавливает скролл. */
export function unlockScroll(): void {
    if (lockCount === 0) return;
    lockCount -= 1;
    if (lockCount > 0) return;

    const { body } = document;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
}
