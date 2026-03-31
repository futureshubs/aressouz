import { useEffect } from 'react';
import {
  isMarketplaceNativeApp,
  marketplaceNativeSetBadge,
} from '../utils/marketplaceNativeBridge';

/**
 * Expo / RN WebView qobig‘ida ilova ikonkasidagi badge = savatdagi jami pozitsiya soni.
 */
export function useMarketplaceNativeCartBadge(totalCount: number): void {
  useEffect(() => {
    if (!isMarketplaceNativeApp()) return;
    marketplaceNativeSetBadge(totalCount);
  }, [totalCount]);
}
