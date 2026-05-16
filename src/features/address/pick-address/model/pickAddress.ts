import { addressStore, addressApi, type AddressDetails, type Coordinates } from '@entities/address';
import { userStore } from '@entities/user';

/**
 * Входные данные для выбора адреса доставки.
 */
export interface PickAddressInput {
    /** Человекочитаемое представление адреса. */
    text: string;
    /** Географические координаты выбранной точки. */
    coords: Coordinates;
    /** Дополнительные поля адреса (квартира, подъезд, этаж, домофон, комментарий курьеру). */
    details?: AddressDetails;
    /** Идентификатор существующего сохранённого адреса для обновления; при отсутствии создаётся новый. */
    addressId?: string | null;
}

/**
 * Устанавливает текущий адрес доставки и сохраняет его в профиле пользователя.
 *
 * Текущий адрес обновляется в хранилище в любом случае. Если пользователь
 * авторизован, дополнительно создаётся новый сохранённый адрес или
 * обновляется существующий по переданному идентификатору, после чего
 * перезагружается список сохранённых адресов.
 *
 * @param input Параметры выбора адреса.
 */
export const pickAddress = async ({ text, coords, details, addressId }: PickAddressInput) => {
    addressStore.setCurrent({ text, coords });

    const { user } = userStore.getState();
    if (!user) return;

    const payload = {
        address_text: text,
        lat: coords[0],
        lon: coords[1],
        ...(details ?? {}),
        label: details?.label ?? 'Дом',
    };

    if (addressId) {
        await addressApi.patch(addressId, payload);
    } else {
        await addressApi.create(payload);
    }
    await addressStore.loadSaved();
};
