import { Component } from '@shared/lib/component';
import type { AddressDetails, Coordinates } from '@entities/address';
import { pickAddress } from '../model/pickAddress';
import { pickAddressFormTemplate } from './pickAddressForm.tmpl.js';

export interface PickAddressFormProps {
    text: string;
    coords: Coordinates;
    initial?: AddressDetails;
    addressId?: string | null;
    onSaved?: () => void;
}

export class PickAddressForm extends Component<PickAddressFormProps> {
    constructor() {
        super(pickAddressFormTemplate);
    }

    protected onMount(): void {
        if (!this.root) return;

        const display = this.root.querySelector('#display-address-text') as HTMLInputElement | null;
        if (display) display.value = this.props.text;

        const initial = this.props.initial ?? {};
        const fields: (keyof AddressDetails)[] = ['apartment', 'entrance', 'floor', 'door_code', 'courier_comment'];
        fields.forEach((name) => {
            const el = this.root?.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
            if (el) el.value = (initial[name] as string | undefined) ?? '';
        });

        const form = this.root.querySelector('#address-full-form') as HTMLFormElement | null;
        if (form) {
            this.on(form, 'submit', (e) => {
                e.preventDefault();
                void this.submit(form);
            });
        }
    }

    private async submit(form: HTMLFormElement): Promise<void> {
        const fd = new FormData(form);
        const details: AddressDetails = {
            apartment: fd.get('apartment')?.toString() ?? '',
            entrance: fd.get('entrance')?.toString() ?? '',
            floor: fd.get('floor')?.toString() ?? '',
            door_code: fd.get('door_code')?.toString() ?? '',
            courier_comment: fd.get('courier_comment')?.toString() ?? '',
        };
        await pickAddress({
            text: this.props.text,
            coords: this.props.coords,
            details,
            addressId: this.props.addressId ?? null,
        });
        this.props.onSaved?.();
    }
}
