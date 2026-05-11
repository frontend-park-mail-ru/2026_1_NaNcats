/**
 * Публичный барель фичи edit-profile.
 *
 * Точка входа `./ui/EditProfileForm` разрешается сборщиком в
 * `./ui/EditProfileForm.tsx` (новая функциональная реализация на VDOM/JSX).
 * Старый файл `./ui/EditProfileForm.ts` остаётся в репозитории до Unit 15
 * как опорный пример миграции и пока не подключается.
 */
export { EditProfileForm } from './ui/EditProfileForm';
export type { EditProfileFormProps } from './ui/EditProfileForm';
export { editProfile } from './model/editProfile';
