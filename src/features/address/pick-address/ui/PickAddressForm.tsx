import type { AddressDetails, Coordinates } from '@entities/address';
import { signal } from '@shared/lib/signals';
import type { VNode } from '@shared/lib/vdom';

import { pickAddress } from '../model/pickAddress';

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

export function PickAddressForm(props: PickAddressFormProps): VNode {
    const initial = props.initial ?? {};
    const apartment = signal<string>(initial.apartment ?? '');
    const entrance = signal<string>(initial.entrance ?? '');
    const floor = signal<string>(initial.floor ?? '');
    const doorCode = signal<string>(initial.door_code ?? '');
    const courierComment = signal<string>(initial.courier_comment ?? '');
    const submitting = signal<boolean>(false);

    const handleSubmit = async (event: Event): Promise<void> => {
        event.preventDefault();
        if (submitting.peek()) return;

        const details: AddressDetails = {
            apartment: apartment.peek(),
            entrance: entrance.peek(),
            floor: floor.peek(),
            door_code: doorCode.peek(),
            courier_comment: courierComment.peek(),
        };

        submitting.set(true);
        try {
            await pickAddress({
                text: props.text,
                coords: props.coords,
                details,
                addressId: props.addressId ?? null,
            });
            props.onSaved?.();
        } finally {
            submitting.set(false);
        }
    };

    return (
        <form
            id="address-full-form"
            class="address-form"
            onSubmit={(e: Event): void => {
                void handleSubmit(e);
            }}
        >
            <div class="input-group">
                <label for="display-address-text">Адрес</label>
                <input
                    id="display-address-text"
                    name="display_address_text"
                    class="input-field"
                    type="text"
                    value={props.text}
                    readonly
                />
            </div>

            <div class="address-form__grid">
                <div class="input-group">
                    <label for="apartment">Квартира</label>
                    <input
                        id="apartment"
                        name="apartment"
                        class="input-field"
                        type="text"
                        value={apartment.peek()}
                        onInput={(e: Event): void => {
                            apartment.set((e.target as HTMLInputElement).value);
                        }}
                    />
                </div>
                <div class="input-group">
                    <label for="entrance">Подъезд</label>
                    <input
                        id="entrance"
                        name="entrance"
                        class="input-field"
                        type="text"
                        value={entrance.peek()}
                        onInput={(e: Event): void => {
                            entrance.set((e.target as HTMLInputElement).value);
                        }}
                    />
                </div>
                <div class="input-group">
                    <label for="floor">Этаж</label>
                    <input
                        id="floor"
                        name="floor"
                        class="input-field"
                        type="text"
                        value={floor.peek()}
                        onInput={(e: Event): void => {
                            floor.set((e.target as HTMLInputElement).value);
                        }}
                    />
                </div>
                <div class="input-group">
                    <label for="door_code">Код двери</label>
                    <input
                        id="door_code"
                        name="door_code"
                        class="input-field"
                        type="text"
                        value={doorCode.peek()}
                        onInput={(e: Event): void => {
                            doorCode.set((e.target as HTMLInputElement).value);
                        }}
                    />
                </div>
            </div>

            <div class="input-group">
                <label for="courier_comment">Комментарий курьеру</label>
                <input
                    id="courier_comment"
                    name="courier_comment"
                    class="input-field"
                    type="text"
                    value={courierComment.peek()}
                    onInput={(e: Event): void => {
                        courierComment.set((e.target as HTMLInputElement).value);
                    }}
                />
            </div>

            <button type="submit" class="button button_primary" disabled={submitting}>
                Сохранить
            </button>
        </form>
    ) as VNode;
}
