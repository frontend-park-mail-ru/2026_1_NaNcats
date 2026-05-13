import { addressApi, addressStore } from '@entities/address';

/**
 * Удаляет сохранённый адрес и перезагружает список сохранённых адресов в
 * хранилище.
 *
 * @param id Идентификатор удаляемого адреса.
 */
export const removeAddress = async (id: string) => {
    await addressApi.remove(id);
    await addressStore.loadSaved();
};
