import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  KeyRound,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Loader2,
  Store,
  Clock,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { AddRentalProviderModal } from './AddRentalProviderModal';

type ProviderRow = {
  id: string;
  login: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  shopName?: string;
  workTime?: string;
  birthDate?: string;
  gender?: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
};

export function RentalProviderAccountsPanel({ branchId }: { branchId: string }) {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [patchBusyId, setPatchBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBaseUrl}/branch/rental-providers`, {
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.providers)) {
        setProviders(data.providers);
      } else {
        setProviders([]);
        if (!res.ok) {
          toast.error(data.error || 'Ro‘yxatni yuklashda xatolik');
        }
      }
    } catch {
      toast.error('Serverga ulanishda xatolik');
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [branchId, visibilityTick, apiBaseUrl]);

  const handleDelete = async (id: string) => {
    if (!confirm('Akkauntni o‘chirishni tasdiqlaysizmi?')) return;
    setDeleteBusyId(id);
    try {
      const res = await fetch(
        `${apiBaseUrl}/branch/rental-providers/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('O‘chirildi');
        await load();
      } else {
        toast.error(data.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    const np = prompt('Yangi parol:');
    if (!np?.trim()) return;
    setPatchBusyId(id);
    try {
      const res = await fetch(
        `${apiBaseUrl}/branch/rental-providers/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ password: np }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Parol yangilandi');
      } else {
        toast.error(data.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setPatchBusyId(null);
    }
  };

  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <div className="space-y-6">
      <AddRentalProviderModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void load()}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="w-7 h-7" style={{ color: accentColor.color }} />
            Ijara beruvchi akkauntlari
          </h2>
          <p
            className="text-sm mt-1 max-w-xl"
            style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
          >
            Har bir beruvchi alohida login bilan{' '}
            <code className="text-xs rounded px-1 py-0.5 bg-black/10">/ijara-panel</code> ga kiradi.
            Ish vaqtidan tashqarida buyurtma bloklanadi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || deleteBusyId !== null || patchBusyId !== null}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border disabled:opacity-50"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            Yangilash
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 text-white"
            style={{ background: accentColor.color }}
          >
            <Plus className="w-4 h-4" />
            Ijara beruvchi qo‘shish
          </button>
          <button
            type="button"
            onClick={() => navigate('/ijara-panel')}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}
          >
            <ExternalLink className="w-4 h-4" />
            Ijara paneli
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Mavjud akkauntlar</h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin opacity-50" style={{ color: accentColor.color }} />
          </div>
        ) : providers.length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{ borderColor: border }}
          >
            <p className="text-sm opacity-60 mb-4">Hali ijara beruvchi yo‘q</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="px-6 py-3 rounded-xl font-medium text-white inline-flex items-center gap-2"
              style={{ background: accentColor.color }}
            >
              <Plus className="w-5 h-5" />
              Birinchi beruvchini qo‘shish
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl p-4 border"
                style={{ borderColor: border }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-lg flex items-center gap-2">
                      <Store className="w-4 h-4 shrink-0" style={{ color: accentColor.color }} />
                      {p.shopName || p.displayName}
                    </p>
                    <p className="text-sm opacity-60 mt-0.5">
                      {p.firstName || ''} {p.lastName || ''} ·{' '}
                      <span className="font-mono">{p.login}</span>
                    </p>
                    {p.workTime ? (
                      <p className="text-xs mt-2 flex items-center gap-1.5 opacity-70">
                        <Clock className="w-3.5 h-3.5" />
                        Ochilish vaqti: {p.workTime}
                      </p>
                    ) : null}
                    {p.latitude != null && p.longitude != null ? (
                      <p className="text-xs mt-1 flex items-center gap-1.5 opacity-50 font-mono">
                        <MapPin className="w-3.5 h-3.5" />
                        {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleResetPassword(p.id)}
                      disabled={patchBusyId !== null || deleteBusyId !== null}
                      className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50 flex items-center gap-1"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
                    >
                      {patchBusyId === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      Parol
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      disabled={deleteBusyId !== null || patchBusyId !== null}
                      className="px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    >
                      {deleteBusyId === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      O‘chirish
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
