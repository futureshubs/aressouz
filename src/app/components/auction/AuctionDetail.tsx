import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { ArrowLeft, Clock, Users, TrendingUp, Gavel, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface AuctionDetailProps {
  auction: any;
  onClose: () => void;
}

export function AuctionDetail({ auction, onClose }: AuctionDetailProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [bids, setBids] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadDetails();
  }, [auction.id, visibilityRefetchTick]);

  const loadDetails = async () => {
    try {
      setLoading(true);

      // Load bids
      const bidsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${auction.id}/bids`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const bidsData = await bidsResponse.json();
      if (bidsData.success) {
        setBids(bidsData.bids);
      }

      // Load participants
      const participantsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${auction.id}/participants`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const participantsData = await participantsResponse.json();
      if (participantsData.success) {
        setParticipants(participantsData.participants);
      }
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const end = new Date(auction.endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Tugagan';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} kun ${hours} soat`;
    if (hours > 0) return `${hours} soat ${minutes} daqiqa`;
    return `${minutes} daqiqa`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isEnded = new Date(auction.endDate) <= new Date() || auction.status === 'ended';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-2 rounded-xl transition-all active:scale-95"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">{auction.name}</h2>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {isEnded ? 'Tugagan' : 'Faol'} auksion
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Images and Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          <div
            className="rounded-3xl border overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="aspect-video relative">
              <img
                src={auction.images[selectedImage]}
                alt={auction.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                style={{
                  background: isEnded ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)',
                  color: '#ffffff',
                }}
              >
                {isEnded ? 'Tugagan' : 'Faol'}
              </div>
            </div>
            
            {auction.images.length > 1 && (
              <div className="flex gap-2 p-4 overflow-x-auto">
                {auction.images.map((img: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all"
                    style={{
                      borderColor: selectedImage === index ? accentColor.color : 'transparent',
                    }}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 className="text-lg font-bold mb-3">Ta'rif</h3>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
              {auction.description}
            </p>
          </div>

          {/* Bids History */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 className="text-lg font-bold mb-4">Takliflar tarixi</h3>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
                <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}>
                  Takliflar yuklanmoqda…
                </p>
              </div>
            ) : bids.length === 0 ? (
              <p
                className="text-center py-8"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                Hali takliflar yo'q
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {bids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className="p-4 rounded-2xl flex items-center justify-between"
                    style={{
                      background: index === 0
                        ? `${accentColor.color}20`
                        : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                        style={{
                          background: index === 0 ? accentColor.gradient : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          color: index === 0 ? '#ffffff' : 'inherit',
                        }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{bid.userName}</p>
                        <p
                          className="text-xs"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                        >
                          {formatDate(bid.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg" style={{ color: index === 0 ? accentColor.color : 'inherit' }}>
                        {bid.amount.toLocaleString()} so'm
                      </p>
                      {index === 0 && (
                        <p className="text-xs" style={{ color: accentColor.color }}>
                          Eng yuqori taklif
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Stats and Info */}
        <div className="space-y-6">
          {/* Current Price */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
                : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
              borderColor: `${accentColor.color}33`,
            }}
          >
            <p className="text-sm mb-2" style={{ color: accentColor.color }}>
              Joriy narx
            </p>
            <p className="text-3xl font-bold mb-4" style={{ color: accentColor.color }}>
              {auction.currentPrice.toLocaleString()} so'm
            </p>
            <div
              className="h-px mb-4"
              style={{ background: `${accentColor.color}33` }}
            />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Boshlang'ich:
                </span>
                <span className="font-medium">{auction.startPrice.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Maksimal:
                </span>
                <span className="font-medium">{auction.maxPrice.toLocaleString()} so'm</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 className="font-bold mb-4">Statistika</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <Clock className="w-5 h-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p
                    className="text-xs"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Qolgan vaqt
                  </p>
                  <p className="font-medium">{getTimeRemaining()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <Users className="w-5 h-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p
                    className="text-xs"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Ishtirokchilar
                  </p>
                  <p className="font-medium">{participants.length} kishi</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <TrendingUp className="w-5 h-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p
                    className="text-xs"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Takliflar soni
                  </p>
                  <p className="font-medium">{bids.length} ta</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <Gavel className="w-5 h-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p
                    className="text-xs"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Qatnashish to'lovi
                  </p>
                  <p className="font-medium">{auction.participationFee.toLocaleString()} so'm</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p
                    className="text-xs"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Joylashuv
                  </p>
                  <p className="font-medium">{auction.region}, {auction.district}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 className="font-bold mb-4">Qoidalar</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg">📌</span>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  Har bir taklif oldingi taklifdan <strong>{auction.bidIncrementPercent}%</strong> ko'p bo'lishi kerak
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">⏰</span>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  Auksion <strong>{formatDate(auction.endDate)}</strong> da tugaydi
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">🏆</span>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  Eng yuqori taklif bergan ishtirokchi g'olib bo'ladi
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}