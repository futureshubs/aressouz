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
  Pencil,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createAdminDiller,
  fetchAdminDillerDetail,
  fetchAdminDillers,
  patchAdminDiller,
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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CreateDillerInput & { active: boolean }>({
    ...emptyForm(),
    active: true,
  });
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
    setEditing(false);
    setDetailLoading(true);
    const res = await fetchAdminDillerDetail(id);
    setDetailLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const dealer = res.dealer as AdminDillerRow;
    setDetail({
      dealer,
      stats: res.stats as AdminDillerRow['stats'],
      recentSales: Array.isArray(res.recentSales) ? res.recentSales : [],
    });
    setEditForm({
      fullName: dealer.fullName,
      phone: dealer.phone,
      address: dealer.address,
      passportSeries: dealer.passportSeries,
      gender: dealer.gender,
      birthDate: dealer.birthDate,
      startDate: dealer.startDate,
      login: dealer.login,
      password: '',
      active: dealer.active,
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

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    if (!editForm.fullName.trim() || !editForm.login.trim()) {
      toast.error('Ism va login majburiy');
      return;
    }
    if (editForm.password && editForm.password.length < 4) {
      toast.error('Yangi parol kamida 4 belgi');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      fullName: editForm.fullName,
      phone: editForm.phone,
      address: editForm.address,
      passportSeries: editForm.passportSeries,
      gender: editForm.gender,
      birthDate: editForm.birthDate,
      startDate: editForm.startDate,
      login: editForm.login,
      active: editForm.active,
    };
    if (editForm.password.trim()) payload.password = editForm.password.trim();
    const res = await patchAdminDiller(selectedId, payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Diller yangilandi');
    setEditing(false);
    void load();
    void openDetail(selectedId);
  };

  const toggleActive = async (dealer: AdminDillerRow) => {
    const next = !dealer.active;
    const label = next ? 'faollashtirasizmi' : 'to‘xtatasizmi';
    if (!window.confirm(`«${dealer.fullName}» ni ${label}?`)) return;
    const res = await patchAdminDiller(dealer.id, { active: next });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(next ? 'Faollashtirildi' : 'To‘xtatildi');
    void load();
    if (selectedId === dealer.id) void openDetail(dealer.id);
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
        <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>,
      document.body,
    );
  };

  const fieldClass = 'w-full px-3 py-2 rounded-xl border outline-none text-sm';
  const fieldStyle = {
    borderColor: modalPanelStyle.borderColor,
    background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
    color: isDark ? '#fff' : '#111',
  };

  const formFields = (
    values: CreateDillerInput,
    setValues: (fn: (f: CreateDillerInput) => CreateDillerInput) => void,
    opts?: { passwordOptional?: boolean },
  ) => (
    <>
      {(
        [
          ['fullName', 'Ism familiya', 'text'],
          ['phone', 'Telefon', 'tel'],
          ['address', 'Manzil', 'text'],
          ['passportSeries', 'Pasport seriyasi', 'text'],
          ['birthDate', 'Tug‘ilgan kun', 'date'],
          ['startDate', 'Ish boshlagan kun', 'date'],
          ['login', 'Login (/diller uchun)', 'text'],
          [
            'password',
            opts?.passwordOptional ? 'Yangi parol (bo‘sh qoldirish mumkin)' : 'Parol',
            'password',
          ],
        ] as const
      ).map(([key, label, type]) => (
        <div key={key}>
          <label className="block text-xs font-medium mb-1 opacity-70">{label}</label>
          <input
            type={type}
            value={values[key]}
            onChange={(e) => setValues((f) => ({ ...f, [key]: e.target.value }))}
            className={fieldClass}
            style={fieldStyle}
            required={
              key === 'fullName' ||
              key === 'login' ||
              (key === 'password' && !opts?.passwordOptional)
            }
          />
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium mb-1 opacity-70">Jinsi</label>
        <select
          value={values.gender}
          onChange={(e) =>
            setValues((f) => ({ ...f, gender: e.target.value as 'male' | 'female' }))
          }
          className={fieldClass}
          style={fieldStyle}
        >
          <option value="male">Erkak</option>
          <option value="female">Ayol</option>
        </select>
      </div>
    </>
  );

  const statsCards = [
    { label: 'Dillerlar', value: dealers.length, icon: Users, color: '#14b8a6' },
    { label: 'Sotuvlar', value: totals.sales, icon: TrendingUp, color: '#3b82f6' },
    { label: 'Do‘konlar', value: totals.stores, icon: Store, color: '#f59e0b' },
    { label: 'Mahsulotlar', value: totals.products, icon: Package, color: '#8b5cf6' },
    {
      label: 'Jami savdo',
      value: `${formatSum(totals.totalSalesAmount)} so‘m`,
      icon: BarChart3,
      color: '#10b981',
    },
    {
      label: 'Qarz',
      value: `${formatSum(totals.totalDebtAmount)} so‘m`,
      icon: Wallet,
      color: '#ef4444',
    },
  ];

  const avgSale =
    totals.sales > 0 ? Math.round(totals.totalSalesAmount / totals.sales) : 0;
  const activeCount = dealers.filter((d) => d.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Dillerlar</h2>
          <p className="text-sm opacity-70 mt-1">
            Diller qo‘shing, tahrirlang — har biri o‘z login bilan /diller ga kiradi
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border" style={cardStyle}>
          <div className="text-xs opacity-60">Faol dillerlar</div>
          <div className="text-xl font-bold mt-1">
            {activeCount} / {dealers.length}
          </div>
        </div>
        <div className="p-4 rounded-2xl border" style={cardStyle}>
          <div className="text-xs opacity-60">O‘rtacha chek</div>
          <div className="text-xl font-bold mt-1">{formatSum(avgSale)} so‘m</div>
        </div>
        <div className="p-4 rounded-2xl border" style={cardStyle}>
          <div className="text-xs opacity-60">Qarz / savdo</div>
          <div className="text-xl font-bold mt-1">
            {totals.totalSalesAmount > 0
              ? `${Math.round((totals.totalDebtAmount / totals.totalSalesAmount) * 100)}%`
              : '0%'}
          </div>
        </div>
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
                  <th className="text-left p-4 font-semibold">Holat</th>
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
                    className="border-b hover:bg-white/5"
                    style={{ borderColor: cardStyle.borderColor }}
                  >
                    <td
                      className="p-4 font-medium cursor-pointer"
                      onClick={() => void openDetail(d.id)}
                    >
                      {d.fullName}
                      <div className="text-xs opacity-50 font-normal">{d.phone || '—'}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {d.active ? 'Faol' : 'To‘xtatilgan'}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs">{d.login}</td>
                    <td className="p-4 text-right tabular-nums">{d.stats.sales}</td>
                    <td className="p-4 text-right tabular-nums">
                      {formatSum(d.stats.totalSalesAmount)}
                    </td>
                    <td className="p-4 text-right tabular-nums text-red-400">
                      {formatSum(d.stats.totalDebtAmount)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-2 rounded-lg"
                          style={cardStyle}
                          title="Tahrirlash"
                          onClick={() => void openDetail(d.id).then(() => setEditing(true))}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg"
                          style={cardStyle}
                          title={d.active ? 'To‘xtatish' : 'Faollashtirish'}
                          onClick={() => void toggleActive(d)}
                        >
                          <Power
                            className={`w-3.5 h-3.5 ${d.active ? 'text-amber-400' : 'text-emerald-400'}`}
                          />
                        </button>
                      </div>
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
            className="w-full rounded-3xl border p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={modalPanelStyle}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Yangi diller</h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 opacity-60" />
              </button>
            </div>
            <form onSubmit={submitForm} className="space-y-3">
              {formFields(form, setForm)}
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
            style={{ ...modalPanelStyle, maxWidth: '42rem' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editing ? 'Dillerni tahrirlash' : 'Diller tafsilotlari'}
              </h3>
              <div className="flex items-center gap-2">
                {!editing && detail ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                    style={cardStyle}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Tahrir
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setDetail(null);
                    setEditing(false);
                  }}
                >
                  <X className="w-5 h-5 opacity-60" />
                </button>
              </div>
            </div>
            {detailLoading || !detail ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin opacity-50" />
              </div>
            ) : editing ? (
              <form onSubmit={saveEdit} className="space-y-3">
                {formFields(editForm, (fn) =>
                  setEditForm((prev) => ({ ...fn(prev), active: prev.active })),
                  { passwordOptional: true },
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Faol (login qila oladi)
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="flex-1 py-3 rounded-xl font-bold border"
                    style={cardStyle}
                  >
                    Bekor
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-900 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}
                  >
                    {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="opacity-60">Ism:</span> {detail.dealer.fullName}
                  </div>
                  <div>
                    <span className="opacity-60">Login:</span> {detail.dealer.login}
                  </div>
                  <div>
                    <span className="opacity-60">Telefon:</span> {detail.dealer.phone}
                  </div>
                  <div>
                    <span className="opacity-60">Pasport:</span> {detail.dealer.passportSeries}
                  </div>
                  <div>
                    <span className="opacity-60">Manzil:</span> {detail.dealer.address}
                  </div>
                  <div>
                    <span className="opacity-60">Boshlangan:</span> {detail.dealer.startDate}
                  </div>
                  <div>
                    <span className="opacity-60">Holat:</span>{' '}
                    {detail.dealer.active ? 'Faol' : 'To‘xtatilgan'}
                  </div>
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
                            {s.cancelled ? ' (bekor)' : ''}
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
            setEditing(false);
          },
        )}
    </div>
  );
}
