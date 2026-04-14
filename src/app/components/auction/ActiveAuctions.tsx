import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { Clock, Users, TrendingUp, Eye, Trash2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuctionDetail } from './AuctionDetail';
import { regionsList, getDistricts } from '../../data/regions';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface ActiveAuctionsProps {
  branchId: string;
}

export function ActiveAuctions({ branchId }: ActiveAuctionsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [auctions, setAuctions] = useState<any[]>([]);
  const [filteredAuctions, setFilteredAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [deletingAuctionId, setDeletingAuctionId] = useState<string | null>(null);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadAuctions();
  }, [branchId, filter, visibilityRefetchTick]);

  const loadAuctions = async (retryCount = 0) => {
    try {
      setLoading(true);
      console.log('📦 Loading auctions for branch:', branchId, 'filter:', filter, 'retry:', retryCount);
      
      // DEBUG: First check what's in KV store
      if (retryCount === 0) {
        const debugUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/debug/auctions?branchId=${branchId}`;
        console.log('🔍 DEBUG: Checking KV store directly...');
        try {
          const debugResponse = await fetch(debugUrl, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          });
          
          console.log('🔍 DEBUG Response status:', debugResponse.status);
          const debugText = await debugResponse.text();
          console.log('🔍 DEBUG Response text:', debugText);
          
          if (debugResponse.ok) {
            try {
              const debugData = JSON.parse(debugText);
              console.log('🔍 DEBUG KV Store Data:', debugData);
            } catch (e) {
              console.error('🔍 DEBUG: Failed to parse debug response as JSON');
            }
          }
        } catch (debugError) {
          console.error('🔍 DEBUG Error:', debugError);
        }
      }
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions?branchId=${branchId}&status=${filter}`;
      console.log('🌐 Request URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      console.log('📊 Response status:', response.status);
      console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

      // Get response as text first to see what we're getting
      const responseText = await response.text();
      console.log('📊 Response text (first 500 chars):', responseText.substring(0, 500));

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${responseText}`);
      }

      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('❌ Response was:', responseText);
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }

      console.log('📦 Loaded auctions:', data);
      console.log('📊 Total auctions returned:', data.auctions?.length || 0);
      
      if (data.auctions && data.auctions.length > 0) {
        console.log('📋 First auction:', data.auctions[0]);
      }

      if (data.success) {
        setAuctions(data.auctions || []);
        
        // If we got empty results on first try, retry once more after a delay
        if (data.auctions.length === 0 && retryCount === 0) {
          console.log('⚠️ No auctions found, will retry once after 1 second...');
          setTimeout(() => {
            loadAuctions(1);
          }, 1000);
        }
      } else {
        console.error('❌ Server error:', data.error);
        toast.error(data.error || 'Xatolik yuz berdi');
        setAuctions([]);
      }
    } catch (error) {
      console.error('❌ Error loading auctions:', error);
      toast.error('Auksionlarni yuklashda xatolik');
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteAuction = async (auctionId: string) => {
    if (!confirm('Auksionni o\'chirmoqchimisiz?')) return;

    setDeletingAuctionId(auctionId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${auctionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Auksion o\'chirildi');
        loadAuctions();
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error deleting auction:', error);
      toast.error('Auksionni o\'chirishda xatolik');
    } finally {
      setDeletingAuctionId(null);
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Tugagan';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} kun ${hours} soat`;
    if (hours > 0) return `${hours} soat ${minutes} daqiqa`;
    return `${minutes} daqiqa`;
  };

  const filterAuctions = () => {
    let filtered = auctions;

    if (selectedRegion) {
      filtered = filtered.filter(auction => auction.region === selectedRegion);
    }

    if (selectedDistrict) {
      filtered = filtered.filter(auction => auction.district === selectedDistrict);
    }

    setFilteredAuctions(filtered);
  };

  useEffect(() => {
    filterAuctions();
  }, [auctions, selectedRegion, selectedDistrict]);

  if (selectedAuction) {
    return (
      <AuctionDetail
        auction={selectedAuction}
        onClose={() => {
          setSelectedAuction(null);
          loadAuctions();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Hammasi' },
          { id: 'active', label: 'Faol' },
          { id: 'ended', label: 'Tugagan' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className="px-4 py-2 rounded-xl transition-all text-sm font-medium"
            style={{
              background: filter === tab.id
                ? accentColor.gradient
                : isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.03)',
              color: filter === tab.id
                ? '#ffffff'
                : isDark
                  ? 'rgba(255, 255, 255, 0.8)'
                  : '#111827',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Region and District Filters */}
      <div className="flex gap-4">
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="px-4 py-2 rounded-xl transition-all text-sm font-medium"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#111827',
          }}
        >
          <option value="">Viloyatni tanlang</option>
          {regionsList.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="px-4 py-2 rounded-xl transition-all text-sm font-medium"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#111827',
          }}
        >
          <option value="">Tumanni tanlang</option>
          {selectedRegion && getDistricts(selectedRegion).map(district => (
            <option key={district} value={district}>{district}</option>
          ))}
        </select>
      </div>

      {/* Auctions Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-3xl border gap-3" style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          background: isDark
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
        }}>
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: accentColor.color }} />
          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Auksionlar yuklanmoqda…
          </p>
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div
          className="rounded-3xl border p-12 text-center"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            className="inline-flex p-6 rounded-3xl mb-4"
            style={{ background: `${accentColor.color}20` }}
          >
            <div className="text-4xl">🎯</div>
          </div>
          <h3 className="text-xl font-bold mb-2">Auksionlar mavjud emas</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Birinchi auksioningizni yarating
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAuctions.map((auction) => {
            const timeRemaining = getTimeRemaining(auction.endDate);
            const isEnded = new Date(auction.endDate) <= new Date() || auction.status === 'ended';

            return (
              <div
                key={auction.id}
                className="rounded-3xl border overflow-hidden transition-all hover:scale-[1.02] relative group"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={auction.images[0]}
                    alt={auction.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Status Badge */}
                  <div
                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                    style={{
                      background: isEnded
                        ? 'rgba(239, 68, 68, 0.8)'
                        : 'rgba(34, 197, 94, 0.8)',
                      color: '#ffffff',
                    }}
                  >
                    {isEnded ? 'Tugagan' : 'Faol'}
                  </div>

                  {/* Actions */}
                  <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setSelectedAuction(auction)}
                      disabled={deletingAuctionId !== null}
                      className="p-2 rounded-xl backdrop-blur-sm disabled:opacity-50"
                      style={{
                        background: 'rgba(20, 184, 166, 0.9)',
                        color: '#ffffff',
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAuction(auction.id)}
                      disabled={deletingAuctionId !== null}
                      className="p-2 rounded-xl backdrop-blur-sm disabled:opacity-50 inline-flex items-center justify-center min-w-[36px] min-h-[36px]"
                      style={{
                        background: 'rgba(239, 68, 68, 0.9)',
                        color: '#ffffff',
                      }}
                    >
                      {deletingAuctionId === auction.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-lg mb-1 line-clamp-1">{auction.name}</h3>
                    <p
                      className="text-sm line-clamp-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {auction.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div
                    className="p-3 rounded-2xl"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <p className="text-xs mb-1" style={{ color: accentColor.color }}>
                      Joriy narx
                    </p>
                    <p className="text-xl font-bold" style={{ color: accentColor.color }}>
                      {auction.currentPrice.toLocaleString()} so'm
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      className="p-2 rounded-xl text-center"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <Clock className="w-4 h-4 mx-auto mb-1" style={{ color: accentColor.color }} />
                      <p className="text-xs font-medium">{timeRemaining}</p>
                    </div>
                    <div
                      className="p-2 rounded-xl text-center"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <Users className="w-4 h-4 mx-auto mb-1" style={{ color: accentColor.color }} />
                      <p className="text-xs font-medium">{auction.totalParticipants || 0}</p>
                    </div>
                    <div
                      className="p-2 rounded-xl text-center"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <TrendingUp className="w-4 h-4 mx-auto mb-1" style={{ color: accentColor.color }} />
                      <p className="text-xs font-medium">{auction.totalBids || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}