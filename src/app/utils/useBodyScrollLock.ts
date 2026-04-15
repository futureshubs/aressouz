import * as React from 'react';

let lockDepth = 0;

function applyLock() {
  if (typeof document === 'undefined') return;
  const savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const body = document.body;
  document.documentElement.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.dataset.appScrollLockY = String(savedScrollY);
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
}

function releaseLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const y = Number.parseInt(body.dataset.appScrollLockY || '0', 10) || 0;
  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  delete body.dataset.appScrollLockY;
  document.documentElement.style.overflow = '';
  window.scrollTo(0, y);
}

/**
 * Modal / mobil drawer ochilganda orqa fon scroll bo‘lmasin (iOS jumladan).
 * Bir nechta komponent bir vaqtda lock qilishi mumkin — hisoblagich bilan.
 */
export function useBodyScrollLock(locked: boolean) {
  /** `import * as React` — named `useEffect` import ba'zi chunk/HMR holatlarida muammo berishi mumkin */
  React.useEffect(() => {
    if (!locked) return;
    lockDepth += 1;
    if (lockDepth === 1) applyLock();
    return () => {
      lockDepth = Math.max(0, lockDepth - 1);
      if (lockDepth === 0) releaseLock();
    };
  }, [locked]);
}
