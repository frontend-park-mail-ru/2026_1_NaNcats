import { httpClient } from '@shared/api/http';

export const initCsrf = async (): Promise<void> => {
    try {
        await httpClient.fetchCsrf();
    } catch (e) {
        console.warn('csrfProvider: fetchCsrf failed', e);
    }
};
