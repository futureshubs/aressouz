import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { Trophy, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface AuctionWinsProps {
  branchId: string;
}

export function AuctionWins({ branchId }: AuctionWinsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [wins, setWins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadWins();
  }, [branchId, visibilityRefetchTick]);

  const loadWins = async () => {
    try {
      setLoading(true);
      
      // Get all auctions for this branch
      const auctionsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions?branchId=${branchId}&status=ended`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const auctionsData = await auctionsResponse.json();
      if (auctionsData.success) {
        const endedAuctions = auctionsData.auctions;
        const winsData = [];

        for (const auction of endedAuctions) {
          // Get bids for each auction
          const bidsResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${auction.id}/bids`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );

          const bidsData = await bidsResponse.json();
          if (bidsData.success && bidsData.bids.length > 0) {
            const highestBid = bidsData.bids[0];
            winsData.push({
              auction,
              bid: highestBid,
              wonAt: auction.endDate,
            });
          }
        }

        setWins(winsData);
      }
    } catch (error) {
      console.error('Error loading wins:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-3xl border p-6"
        style={{
          background: isDark
            ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
            : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
          borderColor: `${accentColor.color}33`,
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8" style={{ color: accentColor.color }} />
          <h2 className="text-2xl font-bold" style={{ color: accentColor.color }}>
            Yutib Olganlar
          </h2>
        </div>
        <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          G'oliblar va yutuq natijalar
        </p>
      </div>

      {/* Wins List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl border p-6 animate-pulse"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex gap-4">
                <div
                  className="w-24 h-24 rounded-2xl"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                />
                <div className="flex-1 space-y-3">
                  <div
                    className="h-6 rounded-lg w-1/3"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                  />
                  <div
                    className="h-4 rounded-lg w-1/2"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : wins.length === 0 ? (
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
            <Trophy className="w-12 h-12" style={{ color: accentColor.color }} />
          </div>
          <h3 className="text-xl font-bold mb-2">Hali yutuqlar yo'q</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Tugagan auksionlar yo'q yoki takliflar berilmagan
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wins.map((win, index) => (
            <div
              key={win.auction.id}
              className="rounded-3xl border overflow-hidden transition-all hover:scale-[1.01]"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex flex-col sm:flex-row gap-4 p-6">
                {/* Image */}
                <div className="relative">
                  <img
                    src={win.auction.images[0]}
                    alt={win.auction.name}
                    className="w-full sm:w-32 h-32 object-cover rounded-2xl"
                  />
                  <div
                    className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      background: accentColor.gradient,
                      color: '#ffffff',
                    }}
                  >
                    #{index + 1}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{win.auction.name}</h3>
                    <p
                      className="text-sm line-clamp-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {win.auction.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {/* Winner */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <Trophy className="w-4 h-4" style={{ color: accentColor.color }} />
                      <div>
                        <p className="text-xs" style={{ color: accentColor.color }}>
                          G'olib
                        </p>
                        <p className="font-medium text-sm">{win.bid.userName}</p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <DollarSign className="w-4 h-4" style={{ color: accentColor.color }} />
                      <div>
                        <p
                          className="text-xs"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          Yutuq narxi
                        </p>
                        <p className="font-bold text-sm">{win.bid.amount.toLocaleString()} so'm</p>
                      </div>
                    </div>

                    {/* Date */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <Calendar className="w-4 h-4" style={{ color: accentColor.color }} />
                      <div>
                        <p
                          className="text-xs"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          Tugash vaqti
                        </p>
                        <p className="font-medium text-xs">{formatDate(win.wonAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
