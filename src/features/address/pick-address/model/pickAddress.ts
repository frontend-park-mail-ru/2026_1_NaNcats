import { addressStore, addressApi, type AddressDetails, type Coordinates } from '@entities/address';
import { userStore } from '@entities/user';

export interface PickAddressInput {
    text: string;
    coords: Coordinates;
    details?: AddressDetails;
    addressId?: string | null;
}

export const pickAddress = async ({ text, coords, details, addressId }: PickAddressInput): Promise<void> => {
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
