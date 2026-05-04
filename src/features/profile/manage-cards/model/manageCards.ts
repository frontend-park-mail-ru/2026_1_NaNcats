import { cardApi, cardStore } from '@entities/card';

/**
 * Запускает процедуру привязки новой банковской карты: получает у API ссылку
 * на страницу подтверждения и переводит пользователя на неё. Если URL не
 * получен, переход не выполняется.
 */
export const bindNewCard = async (): Promise<void> => {
    const { confirmation_url } = await cardApi.bind();
    if (confirmation_url) {
        window.location.href = confirmation_url;
    }
};

/**
 * Удаляет привязанную карту через хранилище.
 *
 * @param id Идентификатор удаляемой карты.
 */
export const removeCard = (id: string): Promise<void> => cardStore.remove(id);

/**
 * Делает указанную карту картой по умолчанию через хранилище.
 *
 * @param id Идентификатор карты, назначаемой по умолчанию.
 */
export const setDefaultCard = (id: string): Promise<void> => cardStore.setDefault(id);
