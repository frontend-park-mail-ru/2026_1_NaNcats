/**
 * Публичный барель фичи pick-address.
 *
 * Точка входа `./ui/PickAddressForm` разрешается сборщиком в
 * `./ui/PickAddressForm.tsx` (новая функциональная реализация на VDOM/JSX).
 * Старый файл `./ui/PickAddressForm.ts` остаётся в репозитории до Unit 15
 * как опорный пример миграции и пока не подключается.
 */
export { PickAddressForm } from './ui/PickAddressForm';
export type { PickAddressFormProps } from './ui/PickAddressForm';
export { pickAddress } from './model/pickAddress';
export type { PickAddressInput } from './model/pickAddress';
