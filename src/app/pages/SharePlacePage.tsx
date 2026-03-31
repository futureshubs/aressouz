import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PlaceDetailModal } from '../components/PlaceDetailModal';
import { Place } from '../data/places';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { PlaceDetailPageSkeleton } from '../components/skeletons';

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
        const projectId = 'wnondmqmuvjugbomyolz';
        const publicAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTE3NzQsImV4cCI6MjA4ODQ4Nzc3NH0.7CJOTYZ-NhI9XiyWEGpcBxORx4mmM7jxx0MIJ-lQYSc';

        console.log('🔗 Fetching place by share code:', shareCode);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/share/${shareCode}`,
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
        console.log('✅ Place loaded:', data.place);
        
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
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center max-w-md px-6">
          <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Joy topilmadi</h2>
          <p className="text-white/60 mb-6">{error || 'Bu link yaroqsiz yoki muddati tugagan'}</p>
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
    <div className="fixed inset-0 bg-[#0a0a0a]">
      <PlaceDetailModal place={place} isOpen={true} onClose={handleClose} />
    </div>
  );
}
