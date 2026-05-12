import { useStoreSignal } from '@shared/lib/signals';
import { Show, For } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';
import { addressStore, type Address } from '@entities/address';
import { removeAddress } from '../model/manageAddresses';

export interface AddressListProps {
    /** Вызывается при клике по кнопке редактирования адреса, получает его идентификатор. */
    onEdit?: (id: string) => void;
}

export function AddressList(props: AddressListProps): VNode {
    const addresses = useStoreSignal(addressStore, (s) => s.saved);

    const handleDelete = async (id: string): Promise<void> => {
        const ok = await Popup.confirm('Удалить этот адрес?');
        if (!ok) return;
        await removeAddress(id);
    };

    // Текст адреса с квартирой, подъездом и этажом в одной строке.
    const formatLine = (addr: Address): string => {
        const text = addr.location.address_text;
        const ap = addr.apartment ? `, кв. ${addr.apartment}` : '';
        const ent = addr.entrance ? `, под. ${addr.entrance}` : '';
        const fl = addr.floor ? `, эт. ${addr.floor}` : '';
        return `${text}${ap}${ent}${fl}`;
    };

    return (
        <div class="address-list" id="profile-address-list">
            <Show
                when={(): boolean => addresses().length > 0}
                fallback={<div class="empty-text">У вас пока нет сохраненных адресов</div>}
            >
                <For each={addresses} key={(a): string => a.id}>
                    {(addr: Address): VNode => (
                        <div class="address-row" data-id={addr.id}>
                            <span class="address-row__text">{formatLine(addr)}</span>
                            <div class="address-row__actions">
                                <div
                                    class="edit-icon-orange edit-addr-btn"
                                    onClick={(): void => props.onEdit?.(addr.id)}
                                />
                                <div
                                    class="delete-icon-orange delete-addr-btn"
                                    onClick={(): void => {
                                        void handleDelete(addr.id);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </For>
            </Show>
        </div>
    );
}