import { Store } from '@shared/lib/store';
import { addressApi } from '../api/addressApi';
import type { Address, Coordinates } from './types';

const LS_TEXT_KEY = 'delivery_address';
const LS_COORDS_KEY = 'delivery_coords';

export interface CurrentAddress {
    text: string;
    coords: Coordinates;
}

export interface AddressStoreState {
    saved: Address[];
    current: CurrentAddress | null;
    status: 'idle' | 'loading' | 'error';
}

const readCurrentFromLS = (): CurrentAddress | null => {
    try {
        const text = localStorage.getItem(LS_TEXT_KEY);
        const coordsRaw = localStorage.getItem(LS_COORDS_KEY);
        if (!text) return null;
        const coords = coordsRaw ? (JSON.parse(coordsRaw) as Coordinates) : null;
        if (!coords || !Array.isArray(coords) || coords.length !== 2) {
            return { text, coords: [0, 0] };
        }
        return { text, coords };
    } catch {
        return null;
    }
};

class AddressStore extends Store<AddressStoreState> {
    constructor() {
        super({
            saved: [],
            current: readCurrentFromLS(),
            status: 'idle',
        });
    }

    setCurrent(current: CurrentAddress): void {
        try {
            localStorage.setItem(LS_TEXT_KEY, current.text);
            localStorage.setItem(LS_COORDS_KEY, JSON.stringify(current.coords));
        } catch (e) {
            console.warn('addressStore.setCurrent: localStorage write failed', e);
        }
        this.setState({ current });
    }

    async loadSaved(): Promise<void> {
        this.setState({ status: 'loading' });
        try {
            const saved = await addressApi.list();
            this.setState({ saved, status: 'idle' });
        } catch (e) {
            console.error('addressStore.loadSaved', e);
            this.setState({ status: 'error' });
        }
    }
}

export const addressStore = new AddressStore();
