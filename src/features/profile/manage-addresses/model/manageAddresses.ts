import { addressApi, addressStore } from '@entities/address';

export const removeAddress = async (id: string): Promise<void> => {
    await addressApi.remove(id);
    await addressStore.loadSaved();
};
