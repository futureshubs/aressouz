import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';
import { useBodyScrollLock } from '../../utils/useBodyScrollLock';
import {
  UserPlus,
  Users,
  Store,
  Package,
  TrendingUp,
  Wallet,
  RefreshCw,
  Loader2,
  X,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createAdminDiller,
  fetchAdminDillerDetail,
  fetchAdminDillers,
  type AdminDillerRow,
  type CreateDillerInput,
} from '../../utils/adminDillersApi';

const formatSum = (n: number) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.max(0, n));

const emptyForm = (): CreateDillerInput => ({
  fullName: '',
  phone: '',
  address: '',
  passportSeries: '',
  gender: 'male',
  birthDate: '',
  startDate: new Date().toISOString().slice(0, 10),
  login: '',
  password: '',
});

export default function AdminDillersView() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [dealers, setDealers] = useState<AdminDillerRow[]>([]);
  const [totals, setTotals] = useState({
    sales: 0,
    products: 0,
    stores: 0,
    firms: 0,
    totalSalesAmount: 0,
    totalDebtAmount: 0,
  });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateDillerInput>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<{
    dealer: AdminDillerRow;
    stats: AdminDillerRow['stats'];
    recentSales: Array<Record<string, unknown>>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminDillers();
    setLoading(false);
    if (!res.success) {
      toast.error(res.error || 'Dillerlar yuklanmadi');
      return;
    }
    setDealers(res.dealers);
    setTotals(res.totals);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    const res = await fetchAdminDillerDetail(id);
    setDetailLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDetail({
      dealer: res.dealer as AdminDillerRow,
      stats: res.stats as AdminDillerRow['stats'],
      recentSales: Array.isArray(res.recentSales) ? res.recentSales : [],
    });
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.login.trim() || form.password.length < 4) {
      toast.error('Ism, login va parol (kamida 4 belgi) kiriting');
      return;
    }
    setSaving(true);
    const res = await createAdminDiller(form);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Diller qo‘shildi');
    setShowForm(false);
    setForm(emptyForm());
    void load();
  };

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  };

  const modalPanelStyle = {
    background: isDark ? '#0a0a0a' : '#ffffff',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
  };

  const modalOpen = showForm || Boolean(selectedId);
  useBodyScrollLock(modalOpen);

  const renderModal = (content: ReactNode, onClose: () => void) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div
        className="fixed inset-0 app-safe-pad z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.78)' }}
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()}>{content}</div>
      </div>,
      document.body,
    );
  };

  const statsCards = [
    { label: 'Dillerlar', value: dealers.length, icon: Users, color: '#14b8a6' },
    { label: 'Sotuvlar', value: totals.sales, icon: TrendingUp, color: '#3b82f6' },
    { label: 'Do‘konlar', value: totals.stores, icon: Store, color: '#f59e0b' },
    { label: 'Mahsulotlar', value: totals.products, icon: Package, color: '#8b5cf6' },
    { label: 'Jami savdo', value: `${formatSum(totals.totalSalesAmount)} so‘m`, icon: BarChart3, color: '#10b981' },
    { label: 'Qarz', value: `${formatSum(totals.totalDebtAmount)} so‘m`, icon: Wallet, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Dillerlar</h2>
          <p className="text-sm opacity-70 mt-1">
            Yangi diller qo‘shing — u o‘z login/paroli bilan /diller ga kiradi
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-medium"
            style={cardStyle}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Yangilash
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl font-bold text-slate-900 flex items-center gap-2 text-sm"
            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}
          >
            <UserPlus className="w-4 h-4" />
            Diller qo‘shish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {statsCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 rounded-2xl border" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="text-xs opacity-70">{s.label}</span>
              </div>
              <div className="text-lg font-bold tabular-nums">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin opacity-50" />
          </div>
        ) : dealers.length === 0 ? (
          <div className="p-12 text-center opacity-70">
            Hali diller yo‘q — «Diller qo‘shish» tugmasini bosing
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: cardStyle.borderColor }}>
                  <th className="text-left p-4 font-semibold">Ism</th>
                  <th className="text-left p-4 font-semibold">Telefon</th>
                  <th className="text-left p-4 font-semibold">Login</th>
                  <th className="text-right p-4 font-semibold">Sotuv</th>
                  <th className="text-right p-4 font-semibold">Savdo</th>
                  <th className="text-right p-4 font-semibold">Qarz</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {dealers.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b hover:bg-white/5 cursor-pointer"
                    style={{ borderColor: cardStyle.borderColor }}
                    onClick={() => void openDetail(d.id)}
                  >
                    <td className="p-4 font-medium">{d.fullName}</td>
                    <td className="p-4">{d.phone || '—'}</td>
                    <td className="p-4 font-mono text-xs">{d.login}</td>
                    <td className="p-4 text-right tabular-nums">{d.stats.sales}</td>
                    <td className="p-4 text-right tabular-nums">
                      {formatSum(d.stats.totalSalesAmount)}
                    </td>
                    <td className="p-4 text-right tabular-nums text-red-400">
                      {formatSum(d.stats.totalDebtAmount)}
                    </td>
                    <td className="p-4 text-right text-xs opacity-60">
                      {d.startDate || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm &&
        renderModal(
          <div
            className="w-full max-w-lg rounded-3xl border p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={modalPanelStyle}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Yangi diller</h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 opacity-60" />
              </button>
            </div>
            <form onSubmit={submitForm} className="space-y-3">
              {(
                [
                  ['fullName', 'Ism familiya', 'text'],
                  ['phone', 'Telefon', 'tel'],
                  ['address', 'Manzil', 'text'],
                  ['passportSeries', 'Pasport seriyasi', 'text'],
                  ['birthDate', 'Tug‘ilgan kun', 'date'],
                  ['startDate', 'Ish boshlagan kun', 'date'],
                  ['login', 'Login (/diller uchun)', 'text'],
                  ['password', 'Parol', 'password'],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1 opacity-70">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
                    style={{
                      borderColor: modalPanelStyle.borderColor,
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
                      color: isDark ? '#fff' : '#111',
                    }}
                    required={key === 'fullName' || key === 'login' || key === 'password'}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Jinsi</label>
                <select
                  value={form.gender}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gender: e.target.value as 'male' | 'female' }))
                  }
                  className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
                  style={{
                    borderColor: modalPanelStyle.borderColor,
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
                    color: isDark ? '#fff' : '#111',
                  }}
                >
                  <option value="male">Erkak</option>
                  <option value="female">Ayol</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl font-bold text-slate-900 mt-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </form>
          </div>,
          () => setShowForm(false),
        )}

      {selectedId &&
        renderModal(
          <div
            className="w-full max-w-2xl rounded-3xl border p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={modalPanelStyle}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Diller tafsilotlari</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
              >
                <X className="w-5 h-5 opacity-60" />
              </button>
            </div>
            {detailLoading || !detail ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin opacity-50" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="opacity-60">Ism:</span> {detail.dealer.fullName}</div>
                  <div><span className="opacity-60">Login:</span> {detail.dealer.login}</div>
                  <div><span className="opacity-60">Telefon:</span> {detail.dealer.phone}</div>
                  <div><span className="opacity-60">Pasport:</span> {detail.dealer.passportSeries}</div>
                  <div><span className="opacity-60">Manzil:</span> {detail.dealer.address}</div>
                  <div><span className="opacity-60">Boshlangan:</span> {detail.dealer.startDate}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Sotuvlar', detail.stats.sales],
                    ['Mahsulot', detail.stats.products],
                    ['Do‘kon', detail.stats.stores],
                    ['Firma', detail.stats.firms],
                    ['Savdo', formatSum(detail.stats.totalSalesAmount)],
                    ['Qarz', formatSum(detail.stats.totalDebtAmount)],
                  ].map(([l, v]) => (
                    <div
                      key={String(l)}
                      className="p-3 rounded-xl border text-center"
                      style={{
                        borderColor: modalPanelStyle.borderColor,
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                      }}
                    >
                      <div className="text-xs opacity-60">{l}</div>
                      <div className="font-bold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
                {detail.recentSales.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">So‘nggi sotuvlar</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {detail.recentSales.map((s) => (
                        <div
                          key={String(s.id)}
                          className="flex justify-between text-sm p-2 rounded-lg border"
                          style={{
                            borderColor: modalPanelStyle.borderColor,
                            background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                          }}
                        >
                          <span>{String(s.createdAt || '').slice(0, 10)}</span>
                          <span className="font-medium tabular-nums">
                            {formatSum(Number(s.total || 0))} so‘m
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>,
          () => {
            setSelectedId(null);
            setDetail(null);
          },
        )}
    </div>
  );
}
