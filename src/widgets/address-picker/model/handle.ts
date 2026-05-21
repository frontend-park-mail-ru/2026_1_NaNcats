// Глобальный handle для императивного открытия модалки AddressPicker из любого
// места приложения. Сам AddressPicker монтируется один раз в RootLayout и при
// mount/unmount проставляет/снимает контроллер через `set`.
//
// Нужен, чтобы dropdown в хедере и кнопки в профиле дёргали один и тот же пикер
// без передачи ref-а через цепочку компонентов.

import type { AddressPickerController } from '../ui/AddressPicker';

let current: AddressPickerController | null = null;

export const addressPickerHandle = {
    /** Сохраняет ссылку на контроллер пикера; передавать null при unmount. */
    set(controller: AddressPickerController | null): void {
        current = controller;
    },
    /** Открывает модалку карты; молча игнорируется, если пикер ещё не смонтирован. */
    openMapModal(addressId?: string): void {
        void current?.openMapModal(addressId);
    },
};
