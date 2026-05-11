/**
 * Публичный барель виджета AddressPicker.
 *
 * Точка входа разрешается webpack-ом в `./ui/AddressPicker.tsx` (новый
 * функциональный компонент Unit 11b), потому что `resolve.extensions`
 * начинается с `.tsx`. Старый файл `./ui/AddressPicker.ts` остаётся в
 * репозитории до Unit 15 как опорный образец миграции, но через барель уже
 * не доступен.
 */

export { AddressPicker } from './ui/AddressPicker';
export type { AddressPickerProps, AddressPickerController } from './ui/AddressPicker';
