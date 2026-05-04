import { Component } from '@shared/lib/component';
import { Popup } from '@shared/ui/popup';
import { addressStore, type Address } from '@entities/address';
import { removeAddress } from '../model/manageAddresses';

export interface AddressListProps {
    onEdit?: (id: string) => void;
}

const TEMPLATE = `<div class="address-list" id="profile-address-list"></div>`;

export class AddressList extends Component<AddressListProps> {
    constructor() {
        super(TEMPLATE);
    }

    protected onMount(): void {
        const list = this.root?.querySelector('#profile-address-list') as HTMLElement | null;
        if (!list) return;

        this.useStore(
            addressStore,
            (s) => s.saved,
            (addresses) => this.render(list, addresses),
        );
        this.render(list, addressStore.getState().saved);

        this.on(list, 'click', (e) => {
            const target = e.target as HTMLElement;
            const btn = target.closest('[data-id]') as HTMLElement | null;
            const id = btn?.getAttribute('data-id');
            if (!id) return;
            if (target.classList.contains('delete-addr-btn')) void this.handleDelete(id);
            else if (target.classList.contains('edit-addr-btn')) this.props.onEdit?.(id);
        });
    }

    private render(list: HTMLElement, addresses: Address[]): void {
        if (addresses.length === 0) {
            list.innerHTML = '<div class="empty-text">У вас пока нет сохраненных адресов</div>';
            return;
        }
        list.innerHTML = addresses
            .map((addr) => {
                const text = addr.location.address_text;
                const ap = addr.apartment ? `, кв. ${addr.apartment}` : '';
                const ent = addr.entrance ? `, под. ${addr.entrance}` : '';
                const fl = addr.floor ? `, эт. ${addr.floor}` : '';
                return `
            <div class="address-row" data-id="${addr.id}">
                <span class="address-row__text">${text}${ap}${ent}${fl}</span>
                <div class="address-row__actions">
                    <div class="edit-icon-orange edit-addr-btn" data-id="${addr.id}"></div>
                    <div class="delete-icon-orange delete-addr-btn" data-id="${addr.id}"></div>
                </div>
            </div>`;
            })
            .join('');
    }

    private async handleDelete(id: string): Promise<void> {
        const ok = await Popup.confirm('Удалить этот адрес?');
        if (!ok) return;
        await removeAddress(id);
    }
}
