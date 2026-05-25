import { httpClient } from '@shared/api/http';
import type { Achievement, AchievementsResponse } from '../model/types';

export const achievementsApi = {
    async list(): Promise<Achievement[]> {
        const data = await httpClient.getJson<AchievementsResponse>('/profile/achievements');
        return data.items ?? [];
    },
};
