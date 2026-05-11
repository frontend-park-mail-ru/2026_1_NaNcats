/**
 * Публичный барель страницы профиля.
 *
 * Экспортирует функциональный компонент {@link ProfilePage} как default
 * (роутер достаёт компонент из `mod.default`) и его loader {@link load},
 * как этого ждёт `RouteDescriptor.loader` (через
 * `(await import('@pages/profile')).load()`). Заодно реэкспортирует тип
 * `ProfilePageProps`, чтобы внешние модули могли описывать форму props.
 */

import { ProfilePage, load } from './ui/ProfilePage';

export { ProfilePage, load };
export type { ProfilePageProps } from './ui/ProfilePage';
export default ProfilePage;
