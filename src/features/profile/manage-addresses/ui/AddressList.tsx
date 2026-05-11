import { useStoreSignal } from '@shared/lib/signals';
import { Show, For } from '@shared/lib/vdom';
import type { VNode } from '@shared/lib/vdom';
import { Popup } from '@shared/ui/popup';
import { addressStore, type Address } from '@entities/address';
import { removeAddress } from '../model/manageAddresses';

/**
 * Параметры списка сохранённых адресов.
 */
export interface AddressListProps {
    /** Колбэк, вызываемый при клике по кнопке редактирования адреса; получает идентификатор адреса. */
    onEdit?: (id: string) => void;
}

/**
 * Список сохранённых адресов пользователя в профиле.
 *
 * Подписан на хранилище адресов через useStoreSignal: при каждом изменении
 * хранилища компонент перерисовывает только нужные узлы списка. Клик по
 * иконке удаления спрашивает подтверждение через Popup и вызывает action
 * removeAddress; клик по иконке редактирования передаёт идентификатор
 * родителю через onEdit.
 *
 * @param props Параметры с колбэком редактирования.
 * @returns VNode корня списка.
 */
export function AddressList(props: AddressListProps): VNode {
    const addresses = useStoreSignal(addressStore, (s) => s.saved);

    const handleDelete = async (id: string): Promise<void> => {
        const ok = await Popup.confirm('Удалить этот адрес?');
        if (!ok) return;
        await removeAddress(id);
    };

    /**
     * Собирает текст адреса вместе с квартирой, подъездом и этажом для
     * отображения в одной строке.
     *
     * @param addr Адрес из хранилища.
     * @returns Готовая строка для отображения.
     */
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