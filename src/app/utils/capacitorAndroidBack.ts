import { Capacitor } from '@capacitor/core';

/**
 * Android (Capacitor WebView): tizim orqaga tug‘masi brauzer tarixiga ulanadi —
 * React Router popstate bilan overlay/tab yopiladi.
 */
export function installCapacitorAndroidBackButton(): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let removed = false;
  let handle: { remove: () => Promise<void> } | undefined;

  void import('@capacitor/app').then(({ App }) => {
    if (removed) return;
    void App.addListener('backButton', () => {
      window.history.back();
    }).then((h) => {
      if (!removed) handle = h;
    });
  });

  return () => {
    removed = true;
    void handle?.remove();
  };
}
