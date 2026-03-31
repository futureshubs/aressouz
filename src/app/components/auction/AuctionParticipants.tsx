import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { Users, Phone, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface AuctionParticipantsProps {
  branchId: string;
}

export function AuctionParticipants({ branchId }: AuctionParticipantsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<string>('all');
  const [auctions, setAuctions] = useState<any[]>([]);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadAuctions();
  }, [branchId, visibilityRefetchTick]);

  useEffect(() => {
    if (auctions.length > 0) {
      loadParticipants();
    }
  }, [selectedAuction, auctions, visibilityRefetchTick]);

  const loadAuctions = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions?branchId=${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setAuctions(data.auctions);
      }
    } catch (error) {
      console.error('Error loading auctions:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      setLoading(true);
      
      if (selectedAuction === 'all') {
        // Load all participants from all auctions
        const allParticipants: any[] = [];
        
        for (const auction of auctions) {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${auction.id}/participants`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );

          const data = await response.json();
          if (data.success) {
            data.participants.forEach((p: any) => {
              allParticipants.push({
                ...p,
                auctionName: auction.name,
              });
            });
          }
        }

        setParticipants(allParticipants);
      } else {
        // Load participants for selected auction
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${selectedAuction}/participants`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        const data = await response.json();
        if (data.success) {
          const auction = auctions.find(a => a.id === selectedAuction);
          setParticipants(
            data.participants.map((p: any) => ({
              ...p,
              auctionName: auction?.name || '',
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error loading participants:', error);
      toast.error('Ishtirokchilarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: 'short',
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
          <Users className="w-8 h-8" style={{ color: accentColor.color }} />
          <h2 className="text-2xl font-bold" style={{ color: accentColor.color }}>
            Ishtirokchilar
          </h2>
        </div>
        <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          Auksionlarda ishtirok etgan foydalanuvchilar
        </p>
      </div>

      {/* Filter */}
      <div>
        <label className="block text-sm font-medium mb-2">Auksion tanlash</label>
        <select
          value={selectedAuction}
          onChange={(e) => setSelectedAuction(e.target.value)}
          className="w-full sm:w-auto px-4 py-3 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDark ? '#ffffff' : '#000000',
          }}
        >
          <option value="all">Barcha auksionlar</option>
          {auctions.map((auction) => (
            <option key={auction.id} value={auction.id}>
              {auction.name}
            </option>
          ))}
        </select>
      </div>

      {/* Participants List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-3xl border p-4 animate-pulse"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex gap-4">
                <div
                  className="w-12 h-12 rounded-full"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 rounded-lg w-1/3"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                  />
                  <div
                    className="h-3 rounded-lg w-1/2"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : participants.length === 0 ? (
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
            <Users className="w-12 h-12" style={{ color: accentColor.color }} />
          </div>
          <h3 className="text-xl font-bold mb-2">Ishtirokchilar yo'q</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Hali hech kim ishtirok etmagan
          </p>
        </div>
      ) : (
        <div
          className="rounded-3xl border overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <th className="text-left px-6 py-4 font-medium text-sm">
                    #
                  </th>
                  <th className="text-left px-6 py-4 font-medium text-sm">
                    Ishtirokchi
                  </th>
                  <th className="text-left px-6 py-4 font-medium text-sm">
                    Telefon
                  </th>
                  {selectedAuction === 'all' && (
                    <th className="text-left px-6 py-4 font-medium text-sm">
                      Auksion
                    </th>
                  )}
                  <th className="text-left px-6 py-4 font-medium text-sm">
                    To'lov
                  </th>
                  <th className="text-left px-6 py-4 font-medium text-sm">
                    Sana
                  </th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant, index) => (
                  <tr
                    key={`${participant.auctionId}-${participant.userId}`}
                    className="border-t transition-colors"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <td className="px-6 py-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                          background: `${accentColor.color}20`,
                          color: accentColor.color,
                        }}
                      >
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{participant.userName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span className="text-sm">{participant.userPhone || 'N/A'}</span>
                      </div>
                    </td>
                    {selectedAuction === 'all' && (
                      <td className="px-6 py-4">
                        <p className="text-sm">{participant.auctionName}</p>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span className="font-medium text-sm">
                          {participant.participationFee.toLocaleString()} so'm
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span className="text-xs">{formatDate(participant.paidAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div
            className="border-t p-4 flex items-center justify-between"
            style={{
              background: `${accentColor.color}10`,
              borderColor: `${accentColor.color}20`,
            }}
          >
            <p className="font-medium">Jami ishtirokchilar: {participants.length} kishi</p>
            <p className="font-bold" style={{ color: accentColor.color }}>
              Jami to'lov:{' '}
              {participants.reduce((sum, p) => sum + p.participationFee, 0).toLocaleString()} so'm
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
