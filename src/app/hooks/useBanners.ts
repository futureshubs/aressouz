import { useState, useEffect } from 'react';
import { publicAnonKey } from '../../../utils/supabase/info';
import { edgeFunctionBaseUrl } from '../utils/edgeFunctionBaseUrl';

export interface Banner {
  id: string;
  branchId: string;
  category: 'market' | 'shop' | 'foods' | 'rentals' | 'car' | 'house' | 'services';
  name: string;
  image: string;
  description: string;
  link?: string;
  promoCode?: string;
  region: string;
  district: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export function useBanners(
  category?: Banner['category'],
  region?: string,
  district?: string
) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBanners = async (retryCount = 0) => {
      // Don't load if no location selected
      if (!region || !district) {
        setBanners([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Build URL with filters
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        
        const url = `${edgeFunctionBaseUrl()}/banners?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        });

        if (!response.ok) {
          await response.text();

          // Retry up to 3 times with exponential backoff
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            setTimeout(() => loadBanners(retryCount + 1), delay);
            return;
          }
          
          throw new Error('Failed to load banners');
        }

        const result = await response.json();

        if (result.success) {
          const allBanners = result.data as Banner[];

          // Filter by region and district on frontend
          const filteredBanners = allBanners.filter(banner => {
            // Case-insensitive comparison
            const regionMatch = banner.region.toLowerCase() === region.toLowerCase();
            const districtMatch = banner.district.toLowerCase() === district.toLowerCase();

            return regionMatch && districtMatch;
          });

          setBanners(filteredBanners);
          setIsLoading(false);
        } else {
          throw new Error(result.error || 'Failed to load banners');
        }
      } catch (err) {
        // Retry on network error
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => loadBanners(retryCount + 1), delay);
        } else {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    loadBanners();
  }, [category, region, district]); // Dependencies are correct

  return { banners, isLoading, error };
}