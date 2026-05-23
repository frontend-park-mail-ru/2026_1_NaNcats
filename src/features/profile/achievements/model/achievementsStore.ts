import { achievementsApi, type Achievement } from '@entities/achievement';
import { signal } from '@shared/lib/signals';

const items = signal<Achievement[]>([]);

let loaded = false;

export const achievementsAccessor = () => items();

export async function ensureLoaded(): Promise<void> {
    if (loaded) return;
    try {
        const list = await achievementsApi.list();
        items.set(list);
        loaded = true;
    } catch (e) {
        console.error('achievements: failed to load', e);
    }
}

export async function refresh(): Promise<void> {
    try {
        const list = await achievementsApi.list();
        items.set(list);
        loaded = true;
    } catch (e) {
        console.error('achievements: failed to refresh', e);
    }
}
