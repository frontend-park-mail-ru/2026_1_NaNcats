import { Component } from '@shared/lib/component';
import type { AddressDetails, Coordinates } from '@entities/address';
import { pickAddress } from '../model/pickAddress';
import { pickAddressFormTemplate } from './pickAddressForm.tmpl.js';

/**
 * Параметры формы уточнения адреса.
 */
export interface PickAddressFormProps {
    /** Текстовое представление выбранного адреса для отображения. */
    text: string;
    /** Координаты выбранной точки. */
    coords: Coordinates;
    /** Начальные значения полей формы при редактировании сохранённого адреса. */
    initial?: AddressDetails;
    /** Идентификатор сохранённого адреса для обновления; при отсутствии создаётся новый. */
    addressId?: string | null;
    /** Колбэк, вызываемый после успешного сохранения адреса. */
    onSaved?: () => void;
}

/**
 * Форма ввода дополнительных полей адреса (квартира, подъезд, этаж, домофон,
 * комментарий курьеру) и его сохранения через {@link pickAddress}.
 */
export class PickAddressForm extends Component<PickAddressFormProps> {
    constructor() {
        super(pickAddressFormTemplate);
    }

    /**
     * Заполняет поля формы начальными значениями и подписывается на отправку.
     */
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

    /**
     * Собирает значения дополнительных полей и сохраняет адрес.
     *
     * @param form Элемент формы, из которого читаются значения.
     */
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
