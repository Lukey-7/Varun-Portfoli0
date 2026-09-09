import { useEffect, useState } from 'react';

/**
 * True only for devices with a precise pointing device (mouse / trackpad).
 * Touch screens report false, which is how we keep the custom cursor and the
 * mouse-follow background off phones and tablets.
 */
export function useFinePointer() {
  const [isFine, setIsFine] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setIsFine(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isFine;
}

/**
 * True when the visitor has asked the OS to minimise motion. Used to drop the
 * heavier ambient animations rather than fight the preference.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
