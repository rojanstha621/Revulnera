// src/hooks/usePageLoader.js
import { useState, useEffect } from 'react';

export default function usePageLoader() {
  const [loading, setLoading] = useState(true);

  // Keep a very short splash only on first app load.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return loading;
}
