import { Component } from '@shared/lib/component';

const TEMPLATE = `<div class="offline-banner-text">Нет интернета. Приложение работает в автономном режиме.</div>`;

/**
 * Баннер оффлайн-режима, который показывается поверх UI при потере сети.
 *
 * Реагирует на события window online/offline и переключает CSS-класс
 * offline-banner_active на корневом элементе в зависимости от значения
 * navigator.onLine. Видимостью управляют стили: компонент не удаляет себя
 * из DOM, чтобы не дёргать раскладку при каждом переходе.
 */
export class OfflineBanner extends Component<object> {
    constructor() {
        super(TEMPLATE);
    }

    /**
     * Подписывается на изменения статуса сети и сразу применяет текущий
     * статус к разметке.
     */
    protected onMount(): void {
        if (this.root) {
            this.root.classList.add('offline-banner');
        }
        this.on(window, 'online', () => this.refresh());
        this.on(window, 'offline', () => this.refresh());
        this.refresh();
    }

    /**
     * Сверяется с navigator.onLine и переключает CSS-класс активного
     * состояния на корневом элементе баннера.
     */
    private refresh(): void {
        if (!this.root) return;
        if (navigator.onLine) {
            this.root.classList.remove('offline-banner_active');
        } else {
            this.root.classList.add('offline-banner_active');
        }
    }
}
