import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { FileText, CheckCircle, XCircle, Clock, Phone, Mail, MapPin } from 'lucide-react';
import { projectId } from '../../../../utils/supabase/info';
import { buildRentalPanelHeaders } from '../../utils/requestAuth';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

export function RentalApplicationsView({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadApplications();
  }, [branchId, visibilityTick]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/applications/${branchId}`,
        {
          headers: buildRentalPanelHeaders(),
        }
      );

      const data = await response.json();
      if (data.success) {
        setApplications(data.applications);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
      toast.error('Arizalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, status: 'approved' | 'rejected') => {
    try {
      const notes = status === 'rejected' 
        ? prompt('Rad etish sababini kiriting:') 
        : undefined;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/applications/${applicationId}`,
        {
          method: 'PUT',
          headers: buildRentalPanelHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            branchId,
            status,
            notes
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success(status === 'approved' ? 'Ariza tasdiqlandi' : 'Ariza rad etildi');
        loadApplications();
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('Holatni yangilashda xatolik');
    }
  };

  const filteredApplications = filter === 'all' 
    ? applications 
    : applications.filter(app => app.status === filter);

  const stats = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5" style={{ color: '#f59e0b' }} />;
      case 'approved': return <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />;
      case 'rejected': return <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Kutilmoqda';
      case 'approved': return 'Tasdiqlandi';
      case 'rejected': return 'Rad etildi';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" 
               style={{ 
                 borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                 borderTopColor: accentColor.color 
               }}
          />
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Arizalar</h2>
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Foydalanuvchilardan kelgan ijaraga berish arizalari
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'Hammasi', count: stats.all },
          { key: 'pending', label: 'Kutilmoqda', count: stats.pending },
          { key: 'approved', label: 'Tasdiqlandi', count: stats.approved },
          { key: 'rejected', label: 'Rad etildi', count: stats.rejected },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as any)}
            className="px-4 py-2 rounded-2xl font-medium whitespace-nowrap transition-all"
            style={{
              background: filter === item.key 
                ? accentColor.color 
                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: filter === item.key ? '#ffffff' : undefined,
            }}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-xl font-bold mb-2">Arizalar yo'q</h3>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            {filter === 'all' ? 'Hali arizalar yo\'q' : `${getStatusText(filter)} arizalar yo'q`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredApplications.map((application) => (
            <div
              key={application.id}
              className="rounded-3xl p-6 border"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(application.status)}
                  <div>
                    <h3 className="text-lg font-bold">{application.name}</h3>
                    <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      {new Date(application.createdAt).toLocaleString('uz-UZ')}
                    </p>
                  </div>
                </div>
                <div 
                  className="px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{ 
                    background: `${getStatusColor(application.status)}20`,
                    color: getStatusColor(application.status)
                  }}
                >
                  {getStatusText(application.status)}
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {application.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">{application.phone}</span>
                  </div>
                )}
                {application.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">{application.email}</span>
                  </div>
                )}
                {application.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">{application.location}</span>
                  </div>
                )}
              </div>

              {/* Product Details */}
              {application.productName && (
                <div 
                  className="p-4 rounded-2xl mb-4"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                >
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Mahsulot
                  </p>
                  <p className="font-semibold">{application.productName}</p>
                  {application.category && (
                    <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      {application.category}
                    </p>
                  )}
                </div>
              )}

              {/* Message */}
              {application.message && (
                <div 
                  className="p-4 rounded-2xl mb-4"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                >
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Xabar
                  </p>
                  <p className="text-sm">{application.message}</p>
                </div>
              )}

              {/* Notes (if rejected) */}
              {application.notes && (
                <div 
                  className="p-4 rounded-2xl mb-4"
                  style={{ background: 'rgba(239,68,68,0.1)' }}
                >
                  <p className="text-sm mb-1" style={{ color: '#ef4444' }}>
                    Rad etish sababi
                  </p>
                  <p className="text-sm">{application.notes}</p>
                </div>
              )}

              {/* Actions */}
              {application.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateApplicationStatus(application.id, 'approved')}
                    className="flex-1 px-4 py-2 rounded-xl font-medium transition-all"
                    style={{ 
                      background: 'rgba(16,185,129,0.1)',
                      color: '#10b981'
                    }}
                  >
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Tasdiqlash
                  </button>
                  <button
                    onClick={() => updateApplicationStatus(application.id, 'rejected')}
                    className="flex-1 px-4 py-2 rounded-xl font-medium transition-all"
                    style={{ 
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444'
                    }}
                  >
                    <XCircle className="w-4 h-4 inline mr-2" />
                    Rad etish
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
