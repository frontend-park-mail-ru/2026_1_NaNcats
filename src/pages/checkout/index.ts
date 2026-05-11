/**
 * Публичный барель страницы оформления заказа.
 *
 * Экспортирует функциональный компонент {@link CheckoutPage} как default
 * (роутер достаёт компонент из `mod.default`) и loader {@link load}; роутер
 * обращается к ним через `(await import('@pages/checkout')).load()` и
 * динамический import-компонент. Тип `CheckoutPageProps` реэкспортирован
 * для тестов и внешних потребителей.
 */

import { CheckoutPage, load } from './ui/CheckoutPage';

export { CheckoutPage, load };
export type { CheckoutPageProps } from './ui/CheckoutPage';
export default CheckoutPage;
