import { OfflineBanner } from '@shared/ui/offline-banner';

/**
 * Монтирует баннер сетевого статуса в конец `body`.
 *
 * Баннер сам подписывается на события `online`/`offline` и решает, показывать
 * ли себя; провайдер только обеспечивает ему собственный контейнер, чтобы
 * баннер не зависел от разметки страницы и переживал смену роутов.
 */
export const initOnlineStatus = (): void => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    new OfflineBanner().mount(container, {});
};
