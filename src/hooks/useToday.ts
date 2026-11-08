import { useEffect, useState } from 'react';
import { todayIso } from '@/core/dates';

export const useToday = (): string => {
  const [today, setToday] = useState(todayIso);
  useEffect(() => {
    const update = () => setToday(todayIso());
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        update();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
};
