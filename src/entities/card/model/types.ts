export interface Card {
    id: string;
    last4: string;
    issuer_name?: string;
    card_type?: string;
    is_default: boolean;
}

export interface CardBindResponse {
    confirmation_url?: string;
}

export type CardStatus = 'idle' | 'loading' | 'syncing' | 'error';

export interface CardState {
    cards: Card[];
    status: CardStatus;
}
