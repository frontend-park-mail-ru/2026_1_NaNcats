/**
 * Публичный барель фичи register.
 *
 * Точка входа `./ui/RegisterForm` разрешается сборщиком в
 * `./ui/RegisterForm.tsx` (новая функциональная реализация на VDOM/JSX).
 * Старый файл `./ui/RegisterForm.ts` остаётся в репозитории до Unit 15 как
 * опорный пример миграции и пока не подключается.
 */
export { RegisterForm } from './ui/RegisterForm';
export type { RegisterFormProps } from './ui/RegisterForm';
export { registerAction } from './model/registerAction';
