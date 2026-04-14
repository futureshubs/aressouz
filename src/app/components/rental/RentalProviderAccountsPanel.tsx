import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { KeyRound, Plus, Trash2, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

type ProviderRow = {
  id: string;
  login: string;
  displayName: string;
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
  const [saving, setSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [patchBusyId, setPatchBusyId] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      toast.error('Login va parol majburiy');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/branch/rental-providers`, {
        method: 'POST',
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          login: login.trim(),
          password,
          displayName: displayName.trim() || login.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Ijara beruvchi akkaunti yaratildi');
        setLogin('');
        setPassword('');
        setDisplayName('');
        await load();
      } else {
        toast.error(data.error || 'Yaratishda xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="space-y-6">
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
            Alohida login va parol bilan ijara paneliga kirish. Havola:{' '}
            <code className="text-xs rounded px-1 py-0.5 bg-black/10">/ijara-panel</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving || deleteBusyId !== null || patchBusyId !== null}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
            }}
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            Yangilash
          </button>
          <button
            type="button"
            onClick={() => navigate('/ijara-panel')}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
            style={{ background: accentColor.color, color: '#fff' }}
          >
            <ExternalLink className="w-4 h-4" />
            Ijara paneli
          </button>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl p-5 space-y-4 border"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <p className="font-semibold flex items-center gap-2">
          <Plus className="w-5 h-5" style={{ color: accentColor.color }} />
          Yangi akkaunt
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
            placeholder="Ko‘rinadigan ism (ixtiyoriy)"
            className="px-4 py-3 rounded-xl outline-none disabled:opacity-60"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          />
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            disabled={saving}
            placeholder="Login *"
            required
            autoComplete="username"
            className="px-4 py-3 rounded-xl outline-none disabled:opacity-60"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
            placeholder="Parol *"
            required
            autoComplete="new-password"
            className="px-4 py-3 rounded-xl outline-none disabled:opacity-60"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: accentColor.color, color: '#fff' }}
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
          {saving ? 'Saqlanmoqda…' : 'Qo‘shish'}
        </button>
      </form>

      <div>
        <h3 className="text-lg font-semibold mb-3">Mavjud akkauntlar</h3>
        {loading ? (
          <p className="text-sm opacity-60">Yuklanmoqda…</p>
        ) : providers.length === 0 ? (
          <p className="text-sm opacity-60">Hali akkaunt yo‘q</p>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 border"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div>
                  <p className="font-medium">{p.displayName || p.login}</p>
                  <p className="text-sm opacity-60 font-mono">{p.login}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResetPassword(p.id)}
                    disabled={patchBusyId !== null || deleteBusyId !== null || saving}
                    className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                    }}
                  >
                    {patchBusyId === p.id ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : null}
                    Parol
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.id)}
                    disabled={deleteBusyId !== null || patchBusyId !== null || saving}
                    className="px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                  >
                    {deleteBusyId === p.id ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Trash2 className="w-4 h-4 shrink-0" />
                    )}
                    O‘chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
