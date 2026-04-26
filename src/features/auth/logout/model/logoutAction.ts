import { userStore } from '@entities/user';

export const logoutAction = async (): Promise<void> => {
    await userStore.logout();
};
