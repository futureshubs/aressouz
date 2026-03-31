import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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

  // Log whenever hook is called
  console.log('🎨 useBanners hook called:', { category, region, district });

  useEffect(() => {
    console.log('🎨 useEffect triggered:', { category, region, district });
    
    const loadBanners = async (retryCount = 0) => {
      // Don't load if no location selected
      if (!region || !district) {
        console.log('⚠️ useBanners: No region/district selected');
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
        
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners?${params.toString()}`;

        console.log('🎨 ===== LOADING BANNERS =====');
        console.log('🎨 Category:', category);
        console.log('🎨 Region:', region);
        console.log('🎨 District:', district);
        console.log('🎨 URL:', url);
        console.log('🎨 Retry count:', retryCount);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });

        console.log('🎨 Response status:', response.status);
        console.log('🎨 Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Response error:', errorText);
          
          // Retry up to 3 times with exponential backoff
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`⚠️ Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`);
            setTimeout(() => loadBanners(retryCount + 1), delay);
            return;
          }
          
          throw new Error('Failed to load banners');
        }

        const result = await response.json();
        console.log('🎨 Backend response:', result);

        if (result.success) {
          const allBanners = result.data as Banner[];
          console.log('🎨 Total banners from backend:', allBanners.length);
          console.log('🎨 All banners:', allBanners);

          // Filter by region and district on frontend
          const filteredBanners = allBanners.filter(banner => {
            // Case-insensitive comparison
            const regionMatch = banner.region.toLowerCase() === region.toLowerCase();
            const districtMatch = banner.district.toLowerCase() === district.toLowerCase();
            
            console.log('🔍 Banner:', banner.name, {
              bannerRegion: banner.region,
              bannerDistrict: banner.district,
              filterRegion: region,
              filterDistrict: district,
              regionMatch,
              districtMatch,
              matched: regionMatch && districtMatch
            });
            
            return regionMatch && districtMatch;
          });

          console.log('✅ Filtered banners count:', filteredBanners.length);
          console.log('✅ Filtered banners:', filteredBanners);
          console.log('🎨 ===== END LOADING BANNERS =====\n');
          
          setBanners(filteredBanners);
          setIsLoading(false);
        } else {
          throw new Error(result.error || 'Failed to load banners');
        }
      } catch (err) {
        console.error('❌ Load banners error:', err);
        
        // Retry on network error
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`⚠️ Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => loadBanners(retryCount + 1), delay);
        } else {
          console.error('❌ All retry attempts failed');
          console.error('❌ This might be because:');
          console.error('   1. Backend server is not running');
          console.error('   2. Network connection issue');
          console.error('   3. CORS configuration problem');
          console.error('❌ Expected URL:', `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners`);
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    loadBanners();
  }, [category, region, district]); // Dependencies are correct

  return { banners, isLoading, error };
}