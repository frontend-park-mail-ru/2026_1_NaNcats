import { cardApi, cardStore } from '@entities/card';

export const bindNewCard = async (): Promise<void> => {
    const { confirmation_url } = await cardApi.bind();
    if (confirmation_url) {
        window.location.href = confirmation_url;
    }
};

export const removeCard = (id: string): Promise<void> => cardStore.remove(id);

export const setDefaultCard = (id: string): Promise<void> => cardStore.setDefault(id);
