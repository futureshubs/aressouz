import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PlaceDetailModal } from '../components/PlaceDetailModal';
import { Place } from '../data/places';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { PlaceDetailPageSkeleton } from '../components/skeletons';
import { projectId, publicAnonKey, edgeFunctionSlug } from '../../../utils/supabase/info';
import { devLog } from '../utils/devLog';

export function SharePlacePage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const visibilityRefetchTick = useVisibilityTick();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlaceByShareCode = async () => {
      if (!shareCode) {
        setError('Share kod topilmadi');
        setLoading(false);
        return;
      }

      try {
        devLog('🔗 Fetching place by share code:', shareCode);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/${edgeFunctionSlug}/share/${shareCode}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Joy topilmadi');
        }

        const data = await response.json();
        devLog('✅ Place loaded:', data.place);
        
        setPlace(data.place);
      } catch (err: any) {
        console.error('❌ Error loading place:', err);
        setError(err.message || 'Joy yuklashda xatolik');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaceByShareCode();
  }, [shareCode, visibilityRefetchTick]);

  const handleClose = () => {
    navigate('/');
  };

  if (loading) {
    return <PlaceDetailPageSkeleton isDark={isDark} />;
  }

  if (error || !place) {
    return (
      <div
        className={`fixed inset-0 flex items-center justify-center ${isDark ? 'bg-[#0a0a0a]' : 'bg-background'}`}
      >
        <div className="text-center max-w-md px-6">
          <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-foreground'}`}>Joy topilmadi</h2>
          <p className={`mb-6 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            {error || 'Bu link yaroqsiz yoki muddati tugagan'}
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-3 rounded-xl bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white font-semibold transition-all active:scale-95"
          >
            Bosh sahifaga qaytish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 ${isDark ? 'bg-[#0a0a0a]' : 'bg-background'}`}>
      <PlaceDetailModal place={place} isOpen={true} onClose={handleClose} />
    </div>
  );
}
