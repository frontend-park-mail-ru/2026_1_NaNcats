import { Component } from '@shared/lib/component';

const TEMPLATE = `<div class="offline-banner-text">Нет интернета. Приложение работает в автономном режиме.</div>`;

export class OfflineBanner extends Component<object> {
    constructor() {
        super(TEMPLATE);
    }

    protected onMount(): void {
        if (this.root) {
            this.root.classList.add('offline-banner');
        }
        this.on(window, 'online', () => this.refresh());
        this.on(window, 'offline', () => this.refresh());
        this.refresh();
    }

    private refresh(): void {
        if (!this.root) return;
        if (navigator.onLine) {
            this.root.classList.remove('offline-banner_active');
        } else {
            this.root.classList.add('offline-banner_active');
        }
    }
}
