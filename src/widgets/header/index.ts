/**
 * Публичный барель виджета Header.
 *
 * Точка входа разрешается webpack-ом в `./ui/Header.tsx` (новый функциональный
 * компонент Unit 9), потому что `resolve.extensions` начинается с `.tsx`.
 * Старый файл `./ui/Header.ts` остаётся в репозитории до Unit 15 как опорный
 * образец миграции, но через барель уже не доступен.
 */

export { Header } from './ui/Header';
export type { HeaderProps, HeaderMode } from './ui/Header';
