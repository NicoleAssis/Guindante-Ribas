import { useEffect, useState } from 'react';
import { db } from './localDb';

export function usePersistedState(name, initial) {
  const [state, setState] = useState(() => {
    const stored = db.get(name, null);
    return stored !== null ? stored : initial;
  });

  useEffect(() => {
    db.set(name, state);
  }, [name, state]);

  return [state, setState];
}