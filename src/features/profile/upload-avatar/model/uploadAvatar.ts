import { userStore } from '@entities/user';
import type { User } from '@entities/user';

export const uploadAvatar = (file: File): Promise<User> => userStore.uploadAvatar(file);

export const deleteAvatar = (): Promise<User> => userStore.deleteAvatar();
