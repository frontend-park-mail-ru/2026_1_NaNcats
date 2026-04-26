import { OfflineBanner } from '@shared/ui/offline-banner';

export const initOnlineStatus = (): void => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    new OfflineBanner().mount(container, {});
};
