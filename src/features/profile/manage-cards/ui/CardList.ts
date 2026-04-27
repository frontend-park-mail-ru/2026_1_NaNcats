import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { cardStore, type Card } from '@entities/card';
import { removeCard, setDefaultCard } from '../model/manageCards';

export interface CardListProps {
    onAdd?: () => void;
}

const TEMPLATE = `<div id="profile-cards-list" class="cards-list"></div>`;

export class CardList extends Component<CardListProps> {
    constructor() {
        super(TEMPLATE);
    }

    protected onMount(): void {
        const list = this.root?.querySelector('#profile-cards-list') as HTMLElement | null;
        if (!list) return;

        this.useStore(cardStore, (s) => s.cards, (cards) => this.render(list, cards));
        this.render(list, cardStore.getState().cards);

        this.on(list, 'click', (e) => {
            const target = e.target as HTMLElement;
            const id = target.getAttribute('data-id');
            if (!id) return;
            if (target.classList.contains('delete-card-btn')) void this.handleDelete(id);
            else if (target.classList.contains('set-default-card-btn')) void setDefaultCard(id);
        });
    }

    private render(list: HTMLElement, cards: Card[]): void {
        if (cards.length === 0) {
            list.innerHTML = '<div class="empty-text">Нет привязанных карт</div>';
            return;
        }
        list.innerHTML = cards.map((c) => `
            <div class="card-row">
                <span class="card-row__label">**** ${c.last4}${c.is_default ? ' (по умолчанию)' : ''}</span>
                <div class="card-row__actions">
                    ${c.is_default ? '' : `<button class="button button_link set-default-card-btn" data-id="${c.id}">Сделать основной</button>`}
                    <button class="button button_link delete-card-btn" data-id="${c.id}">Отвязать</button>
                </div>
            </div>
        `).join('');
    }

    private async handleDelete(id: string): Promise<void> {
        const ok = await Popup.confirm('Вы уверены, что хотите отвязать эту карту?');
        if (!ok) return;
        try {
            await removeCard(id);
        } catch {
            await Popup.alert('Не удалось удалить карту');
        }
    }
}
