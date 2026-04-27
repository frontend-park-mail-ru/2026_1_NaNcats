import { userApi, userStore } from '@entities/user';

export const loginAction = async (email: string, password: string): Promise<void> => {
    await userApi.login(email, password);
    await userStore.loadCurrent();
};
