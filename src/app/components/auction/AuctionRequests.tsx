import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  FileText, 
  Check, 
  X, 
  Eye,
  Clock,
  User,
  Phone,
  DollarSign,
  MessageSquare,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface AuctionRequestsProps {
  branchId: string;
}

interface AuctionRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  productName: string;
  productDescription: string;
  images: string[];
  category: string;
  estimatedPrice: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export function AuctionRequests({ branchId }: AuctionRequestsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [requests, setRequests] = useState<AuctionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<AuctionRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadRequests();
  }, [filter, visibilityRefetchTick]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      console.log('📦 Loading auction requests');

      const statusParam = filter === 'all' ? '' : `?status=${filter}`;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auction-requests${statusParam}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setRequests(data.requests || []);
        console.log('✅ Requests loaded:', data.requests.length);
      } else {
        toast.error(data.error || 'Arizalarni yuklashda xatolik');
      }
    } catch (error) {
      console.error('❌ Error loading requests:', error);
      toast.error('Arizalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      setUpdating(true);
      console.log('🔄 Updating request status:', requestId, status);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auction-requests/${requestId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status,
            adminNote: adminNote || undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Ariza yangilandi');
        setSelectedRequest(null);
        setAdminNote('');
        loadRequests();
      } else {
        toast.error(data.error || 'Arizani yangilashda xatolik');
      }
    } catch (error) {
      console.error('❌ Error updating request:', error);
      toast.error('Arizani yangilashda xatolik');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'approved':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      default:
        return accentColor.color;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Kutilmoqda';
      case 'approved':
        return 'Tasdiqlangan';
      case 'rejected':
        return 'Rad etilgan';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="p-6 rounded-3xl border"
        style={{
          background: isDark
            ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
            : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
          borderColor: `${accentColor.color}33`,
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-6 h-6" style={{ color: accentColor.color }} />
          <h2 className="text-2xl font-bold">Auksion Arizalari</h2>
        </div>
        <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          Foydalanuvchilar yuborgan auksion arizalarini ko'ring va boshqaring
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {[
          { id: 'all' as const, label: 'Barchasi' },
          { id: 'pending' as const, label: 'Kutilmoqda' },
          { id: 'approved' as const, label: 'Tasdiqlangan' },
          { id: 'rejected' as const, label: 'Rad etilgan' },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-4 py-2 rounded-xl transition-all whitespace-nowrap"
              style={{
                background: isActive
                  ? accentColor.gradient
                  : isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.03)',
                color: isActive
                  ? '#ffffff'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.8)'
                  : '#111827',
                borderWidth: '1px',
                borderColor: isActive ? accentColor.color : 'transparent',
              }}
            >
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-3xl border animate-pulse"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                className="h-6 rounded-lg mb-3"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  width: '60%',
                }}
              />
              <div
                className="h-4 rounded-lg mb-2"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  width: '80%',
                }}
              />
              <div
                className="h-4 rounded-lg"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  width: '40%',
                }}
              />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div
          className="p-12 rounded-3xl border text-center"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            className="inline-flex p-4 rounded-2xl mb-4"
            style={{ background: `${accentColor.color}20` }}
          >
            <FileText className="w-8 h-8" style={{ color: accentColor.color }} />
          </div>
          <h3 className="text-lg font-bold mb-2">Arizalar topilmadi</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Hozircha arizalar yo'q
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-6 rounded-3xl border"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold">{request.productName}</h3>
                    <span
                      className="px-2 py-1 rounded-lg text-xs font-medium"
                      style={{
                        background: `${getStatusColor(request.status)}20`,
                        color: getStatusColor(request.status),
                      }}
                    >
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  <p
                    className="text-sm mb-3"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    {request.productDescription}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span className="text-sm">{request.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span className="text-sm">{request.userPhone || 'Telefon ko\'rsatilmagan'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span className="text-sm">
                        {request.estimatedPrice ? `${request.estimatedPrice.toLocaleString()} so'm` : 'Narx ko\'rsatilmagan'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span className="text-sm">
                        {new Date(request.createdAt).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>
                  </div>

                  {request.images && request.images.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span className="text-sm">{request.images.length} ta rasm</span>
                    </div>
                  )}

                  {request.adminNote && (
                    <div
                      className="p-3 rounded-xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span className="text-xs font-medium">Admin izohi:</span>
                      </div>
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        {request.adminNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {request.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    <span className="font-medium text-sm">Ko'rib chiqish</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => !updating && setSelectedRequest(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4">Arizani Ko'rib Chiqish</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium block mb-1">Mahsulot nomi</label>
                <p className="text-lg">{selectedRequest.productName}</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Ta'rif</label>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  {selectedRequest.productDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Foydalanuvchi</label>
                  <p>{selectedRequest.userName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Telefon</label>
                  <p>{selectedRequest.userPhone || 'Ko\'rsatilmagan'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Taxminiy narx</label>
                  <p>
                    {selectedRequest.estimatedPrice 
                      ? `${selectedRequest.estimatedPrice.toLocaleString()} so'm` 
                      : 'Ko\'rsatilmagan'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Kategoriya</label>
                  <p>{selectedRequest.category}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Admin izohi</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  disabled={updating}
                  placeholder="Izoh qoldiring..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border outline-none disabled:opacity-60"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void updateRequestStatus(selectedRequest.id, 'approved')}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                }}
              >
                {updating ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <Check className="w-5 h-5 shrink-0" />}
                <span className="font-medium">Tasdiqlash</span>
              </button>
              <button
                type="button"
                onClick={() => void updateRequestStatus(selectedRequest.id, 'rejected')}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                }}
              >
                {updating ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <X className="w-5 h-5 shrink-0" />}
                <span className="font-medium">Rad etish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
