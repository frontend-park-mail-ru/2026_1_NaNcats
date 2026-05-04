import { Store } from '@shared/lib/store';
import { addressApi } from '../api/addressApi';
import type { Address, Coordinates } from './types';

const LS_TEXT_KEY = 'delivery_address';
const LS_COORDS_KEY = 'delivery_coords';

/**
 * Текущий выбранный адрес доставки: текст плюс координаты. Хранится отдельно
 * от списка сохранённых адресов, потому что выбран может быть и адрес, не
 * сохранённый в профиле.
 */
export interface CurrentAddress {
    /** Текстовое представление адреса. */
    text: string;
    /** Координаты `[широта, долгота]`. */
    coords: Coordinates;
}

/**
 * Состояние стора адресов.
 */
export interface AddressStoreState {
    /** Список сохранённых адресов профиля. */
    saved: Address[];
    /** Текущий выбранный адрес доставки или `null`, если он не задан. */
    current: CurrentAddress | null;
    /** Состояние асинхронной загрузки сохранённых адресов. */
    status: 'idle' | 'loading' | 'error';
}

/**
 * Считывает текущий адрес из localStorage.
 *
 * Используется при инициализации стора, чтобы выбранный адрес переживал
 * перезагрузку страницы. При повреждённом JSON координат возвращает адрес с
 * нулевыми координатами; при пустом тексте или ошибке доступа возвращает
 * `null`.
 *
 * @returns Адрес из хранилища или `null`, если его нет либо чтение не удалось.
 */
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

/**
 * Стор адресов пользователя.
 *
 * Хранит список сохранённых адресов и текущий выбранный адрес доставки.
 * Текущий адрес дополнительно зеркалируется в localStorage, чтобы выбор
 * сохранялся между сессиями. Список сохранённых адресов подгружается лениво
 * через {@link loadSaved}.
 */
class AddressStore extends Store<AddressStoreState> {
    constructor() {
        super({
            saved: [],
            current: readCurrentFromLS(),
            status: 'idle',
        });
    }

    /**
     * Устанавливает текущий адрес доставки и пишет его в localStorage.
     *
     * Если запись в localStorage не удалась (например, режим инкогнито или
     * переполнение квоты), ошибка логируется, но состояние стора всё равно
     * обновляется.
     *
     * @param current Новый текущий адрес.
     */
    setCurrent(current: CurrentAddress): void {
        try {
            localStorage.setItem(LS_TEXT_KEY, current.text);
            localStorage.setItem(LS_COORDS_KEY, JSON.stringify(current.coords));
        } catch (e) {
            console.warn('addressStore.setCurrent: localStorage write failed', e);
        }
        this.setState({ current });
    }

    /**
     * Загружает сохранённые адреса с сервера и помещает их в состояние.
     *
     * При ошибке статус переводится в `error`, прежний список адресов
     * сохраняется без изменений.
     */
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
