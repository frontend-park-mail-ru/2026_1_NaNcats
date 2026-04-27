import { userStore, type User } from '@entities/user';

export const editProfile = async (patch: { name: string; email: string }): Promise<User> => {
    return userStore.update(patch);
};
