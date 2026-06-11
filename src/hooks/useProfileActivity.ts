import { useCallback, useEffect, useState } from 'react';
import {
  fetchUserProfileActivity,
  type UserProfileActivity,
} from '../lib/profileActivityApi';

export function useProfileActivity(userId: string | null | undefined) {
  const [activity, setActivity] = useState<UserProfileActivity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setActivity(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfileActivity();
      setActivity(data);
    } catch (err) {
      console.error('[Profile] activity load error:', err);
      setActivity(null);
      setError(err instanceof Error ? err.message : 'Failed to load profile activity.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { activity, isLoading, error, reload };
}
