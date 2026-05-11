/**
 * Публичный барель виджета OrderStatusModal.
 *
 * Точка входа разрешается webpack-ом в `./ui/OrderStatusModal.tsx` (новый
 * функциональный компонент Unit 11b), потому что `resolve.extensions`
 * начинается с `.tsx`. Старый файл `./ui/OrderStatusModal.ts` остаётся в
 * репозитории до Unit 15 как опорный образец миграции, но через барель уже
 * не доступен.
 */

export { OrderStatusModal } from './ui/OrderStatusModal';
export type {
    OrderStatusModalProps,
    OrderStatusModalController,
    OrderStatusModalOpenOptions,
} from './ui/OrderStatusModal';
