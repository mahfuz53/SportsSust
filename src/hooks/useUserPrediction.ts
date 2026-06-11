import { useCallback, useEffect, useState } from 'react';
import { fetchMyPrediction } from '../lib/predictionsApi';
import type { MatchPrediction } from '../lib/predictionTypes';

export function useUserPrediction(matchId: string, userId: string | null, refreshKey = 0) {
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId));

  const reload = useCallback(async () => {
    if (!matchId || !userId) {
      setPrediction(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchMyPrediction(matchId);
      setPrediction(data);
    } catch (err) {
      console.error('[Predictions] load error:', err);
      setPrediction(null);
    } finally {
      setIsLoading(false);
    }
  }, [matchId, userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  return { prediction, isLoading, reload };
}
