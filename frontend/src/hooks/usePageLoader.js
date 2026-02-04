// src/hooks/usePageLoader.js
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function usePageLoader() {
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // Initial page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500); // Show for 1.5 seconds on initial load

    return () => clearTimeout(timer);
  }, []);

  // Show loader on route change
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800); // Show for 0.8 seconds on route change

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return loading;
}
