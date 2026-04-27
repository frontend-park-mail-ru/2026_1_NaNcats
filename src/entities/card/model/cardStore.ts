import { Store } from '@shared/lib/store';
import { cardApi } from '../api/cardApi';
import type { CardState } from './types';

class CardStore extends Store<CardState> {
    constructor() {
        super({ cards: [], status: 'idle' });
    }

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

    async setDefault(id: string): Promise<void> {
        await cardApi.setDefault(id);
        await this.load();
    }

    async remove(id: string): Promise<void> {
        await cardApi.remove(id);
        await this.load();
    }

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
