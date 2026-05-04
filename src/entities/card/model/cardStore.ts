import { Store } from '@shared/lib/store';
import { cardApi } from '../api/cardApi';
import type { CardState } from './types';

/**
 * Стор привязанных банковских карт пользователя.
 *
 * Загружает список карт с сервера и поддерживает его в актуальном состоянии
 * после изменений (удаление, смена карты по умолчанию). Если после загрузки
 * у пользователя оказалась ровно одна карта, не помеченная как `is_default`,
 * стор автоматически делает её картой по умолчанию, чтобы UI всегда имел
 * выбранную карту для оплаты.
 */
class CardStore extends Store<CardState> {
    constructor() {
        super({ cards: [], status: 'idle' });
    }

    /**
     * Загружает список карт с сервера и обновляет состояние.
     *
     * После успешной загрузки выполняется попытка автоматического назначения
     * единственной карты картой по умолчанию через {@link promoteSoloCard}.
     * При ошибке статус переводится в `error`.
     */
    async load(): Promise<void> {
        this.setState({ status: 'loading' });
        try {
            const cards = await cardApi.list();
            this.setState({ cards, status: 'idle' });
            await this.promoteSoloCard();
        } catch (e) {
            console.error('cardStore.load', e);
            this.setState({ status: 'error' });
        }
    }

    /**
     * Назначает карту картой по умолчанию и перечитывает список с сервера.
     *
     * @param id Идентификатор карты.
     */
    async setDefault(id: string): Promise<void> {
        await cardApi.setDefault(id);
        await this.load();
    }

    /**
     * Удаляет карту и перечитывает список с сервера.
     *
     * @param id Идентификатор карты.
     */
    async remove(id: string): Promise<void> {
        await cardApi.remove(id);
        await this.load();
    }

    /**
     * Если в сторе ровно одна карта и она не помечена как `is_default`,
     * назначает её картой по умолчанию на сервере и обновляет локальное
     * состояние без повторной загрузки.
     *
     * Ошибка сети не считается фатальной: автопромоция логируется и
     * пропускается, состояние остаётся прежним.
     */
    private async promoteSoloCard(): Promise<void> {
        const { cards } = this.getState();
        if (cards.length !== 1 || cards[0].is_default) return;
        try {
            await cardApi.setDefault(cards[0].id);
            this.setState({
                cards: cards.map((c, i) => (i === 0 ? { ...c, is_default: true } : c)),
            });
        } catch (e) {
            console.warn('cardStore: failed to auto-promote sole card', e);
        }
    }
}

export const cardStore = new CardStore();
