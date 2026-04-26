import { userApi, userStore } from '@entities/user';

export const registerAction = async (payload: { name: string; email: string; password: string }): Promise<void> => {
    await userApi.register(payload);
    await userStore.loadCurrent();
};
