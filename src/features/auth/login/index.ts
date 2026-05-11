/**
 * Публичный барель фичи login.
 *
 * Точка входа `./ui/LoginForm` разрешается сборщиком в `./ui/LoginForm.tsx`
 * (новая функциональная реализация на VDOM/JSX). Старый файл
 * `./ui/LoginForm.ts` остаётся в репозитории до Unit 15 как опорный пример
 * миграции и пока не подключается.
 */
export { LoginForm } from './ui/LoginForm';
export type { LoginFormProps } from './ui/LoginForm';
export { loginAction } from './model/loginAction';
