import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import {
  Wallet,
  Plus,
  Search,
  Trash2,
  Edit2,
  Loader2,
  X,
  TrendingDown,
  Calendar,
  Tag,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  FolderPlus,
  Receipt,
  PieChart,
} from 'lucide-react';

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

type ExpenseCategory = {
  id: string;
  name: string;
  color: string;
  description?: string;
  totalUzs?: number;
  monthUzs?: number;
};

type Expense = {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  amount: number;
  note?: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  createdAt?: string;
};

type ExpenseSummary = {
  totalAll: number;
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  count: number;
  monthKey?: string;
};

type Props = {
  token: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
};

const CATEGORY_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  card: 'Karta',
  transfer: "O'tkazma",
  other: 'Boshqa',
};

function formatUzs(n: number) {
  return `${Math.round(n || 0).toLocaleString('uz-UZ')} so'm`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('uz-UZ');
  } catch {
    return iso;
  }
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const emptyExpenseForm = () => ({
  categoryId: '',
  title: '',
  amount: '',
  note: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'cash' as PaymentMethod,
});

const emptyCategoryForm = () => ({
  name: '',
  description: '',
  color: CATEGORY_COLORS[0],
});

export default function SellerExpensesPanel({ token, isDark, accentColor }: Props) {
  const visibilityTick = useVisibilityTick();
  const [subTab, setSubTab] = useState<'expenses' | 'categories'>('expenses');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [byCategory, setByCategory] = useState<Array<{ id: string; name: string; color: string; totalUzs: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(currentMonthKey());
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm());
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm());
  const [submitting, setSubmitting] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Seller-Token': token,
    }),
    [token],
  );

  const apiRoot = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller`;

  const loadCategories = useCallback(async () => {
    const res = await fetch(
      `${apiRoot}/expense-categories?token=${encodeURIComponent(token)}&month=${encodeURIComponent(monthFilter)}`,
      { headers },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'Kategoriyalar yuklanmadi');
    setCategories(Array.isArray(data.categories) ? data.categories : []);
    return data.categories as ExpenseCategory[];
  }, [apiRoot, headers, monthFilter, token]);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams({
      token,
      month: monthFilter,
      limit: '100',
    });
    if (categoryFilter !== 'all') params.set('categoryId', categoryFilter);
    if (search.trim()) params.set('q', search.trim());

    const res = await fetch(`${apiRoot}/expenses?${params.toString()}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'Harajatlar yuklanmadi');
    setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    setSummary(data.summary || null);
    setByCategory(Array.isArray(data.byCategory) ? data.byCategory : []);
  }, [apiRoot, categoryFilter, headers, monthFilter, search, token]);

  const reloadAll = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      await loadCategories();
      await loadExpenses();
    } catch (e: any) {
      toast.error(e?.message || 'Ma\'lumotlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadExpenses, token]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll, visibilityTick]);

  useEffect(() => {
    if (!token) return;
    const t = window.setTimeout(() => void loadExpenses(), 300);
    return () => window.clearTimeout(t);
  }, [search, categoryFilter, monthFilter, loadExpenses, token]);

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)';

  const statCards = [
    { label: 'Bugun', value: formatUzs(summary?.todayTotal ?? 0), icon: Calendar, color: '#ef4444' },
    { label: '7 kun', value: formatUzs(summary?.weekTotal ?? 0), icon: TrendingDown, color: '#f59e0b' },
    { label: 'Shu oy', value: formatUzs(summary?.monthTotal ?? 0), icon: Wallet, color: accentColor.color },
    { label: 'Jami yozuv', value: String(summary?.count ?? 0), icon: Receipt, color: '#8b5cf6' },
    { label: 'Kategoriyalar', value: String(categories.length), icon: Tag, color: '#22c55e' },
  ];

  const openCreateExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      ...emptyExpenseForm(),
      categoryId: categories[0]?.id || '',
    });
    setExpenseModalOpen(true);
  };

  const openEditExpense = (e: Expense) => {
    setEditingExpense(e);
    setExpenseForm({
      categoryId: e.categoryId,
      title: e.title,
      amount: String(e.amount),
      note: e.note || '',
      expenseDate: e.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      paymentMethod: e.paymentMethod || 'cash',
    });
    setExpenseModalOpen(true);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      ...emptyCategoryForm(),
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
    });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (c: ExpenseCategory) => {
    setEditingCategory(c);
    setCategoryForm({
      name: c.name,
      description: c.description || '',
      color: c.color || CATEGORY_COLORS[0],
    });
    setCategoryModalOpen(true);
  };

  const submitExpense = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!expenseForm.categoryId) {
      toast.error('Kategoriya tanlang');
      return;
    }
    if (!expenseForm.title.trim()) {
      toast.error('Harajat nomini kiriting');
      return;
    }
    if (Math.floor(Number(expenseForm.amount)) <= 0) {
      toast.error('Summa kiriting');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        categoryId: expenseForm.categoryId,
        title: expenseForm.title.trim(),
        amount: Math.floor(Number(expenseForm.amount)),
        note: expenseForm.note.trim() || undefined,
        expenseDate: expenseForm.expenseDate,
        paymentMethod: expenseForm.paymentMethod,
      };
      const url = editingExpense
        ? `${apiRoot}/expenses/${encodeURIComponent(editingExpense.id)}?token=${encodeURIComponent(token)}`
        : `${apiRoot}/expenses?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: editingExpense ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Saqlashda xatolik');
      toast.success(data.message || 'Saqlandi');
      setExpenseModalOpen(false);
      await reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Saqlashda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCategory = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Kategoriya nomini kiriting');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        color: categoryForm.color,
      };
      const url = editingCategory
        ? `${apiRoot}/expense-categories/${encodeURIComponent(editingCategory.id)}?token=${encodeURIComponent(token)}`
        : `${apiRoot}/expense-categories?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Saqlashda xatolik');
      toast.success(data.message || 'Saqlandi');
      setCategoryModalOpen(false);
      await reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Saqlashda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm('Harajatni o\'chirmoqchimisiz?')) return;
    setDeletingExpenseId(id);
    try {
      const res = await fetch(`${apiRoot}/expenses/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'O\'chirishda xatolik');
      toast.success('Harajat o\'chirildi');
      await reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'O\'chirishda xatolik');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('Kategoriyani o\'chirmoqchimisiz?')) return;
    setDeletingCategoryId(id);
    try {
      const res = await fetch(`${apiRoot}/expense-categories/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'O\'chirishda xatolik');
      toast.success('Kategoriya o\'chirildi');
      await reloadAll();
    } catch (e: any) {
      toast.error(e?.message || 'O\'chirishda xatolik');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const PaymentIcon = ({ method }: { method: PaymentMethod }) => {
    if (method === 'card') return <CreditCard className="w-3.5 h-3.5" />;
    if (method === 'transfer') return <ArrowLeftRight className="w-3.5 h-3.5" />;
    if (method === 'cash') return <Banknote className="w-3.5 h-3.5" />;
    return <Wallet className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Harajatlar</h2>
          <p className="text-sm mt-1" style={{ color: muted }}>
            Do'kon xarajatlarini kategoriya bo'yicha yozib boring va nazorat qiling
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSubTab('categories');
              openCreateCategory();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: border }}
          >
            <FolderPlus className="w-4 h-4" />
            Kategoriya
          </button>
          <button
            type="button"
            onClick={openCreateExpense}
            disabled={categories.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ background: accentColor.gradient, opacity: categories.length === 0 ? 0.5 : 1 }}
          >
            <Plus className="w-4 h-4" />
            Harajat qo'shish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border p-4" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: muted }}>{card.label}</span>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <div className="text-lg font-bold truncate">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 p-1 rounded-xl border w-fit" style={{ borderColor: border, background: cardBg }}>
        {(['expenses', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: subTab === tab ? accentColor.gradient : 'transparent',
              color: subTab === tab ? '#fff' : muted,
            }}
          >
            {tab === 'expenses' ? 'Harajatlar' : 'Kategoriyalar'}
          </button>
        ))}
      </div>

      {subTab === 'expenses' ? (
        <>
          <div className="rounded-2xl border p-4 flex flex-col lg:flex-row gap-3" style={{ background: cardBg, borderColor: border }}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qidirish..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderColor: border, color: isDark ? '#fff' : '#111' }}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderColor: border, color: isDark ? '#fff' : '#111' }}
            >
              <option value="all">Barcha kategoriya</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderColor: border, color: isDark ? '#fff' : '#111' }}
            />
          </div>

          {byCategory.length > 0 ? (
            <div className="rounded-2xl border p-4" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                <PieChart className="w-4 h-4" style={{ color: accentColor.color }} />
                Oy bo'yicha kategoriya
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {byCategory.filter((c) => c.totalUzs > 0).map((c) => (
                  <div key={c.id} className="rounded-xl px-3 py-2 border text-sm" style={{ borderColor: border }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="font-semibold text-red-500">{formatUzs(c.totalUzs)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} /></div>
          ) : categories.length === 0 ? (
            <EmptyState
              isDark={isDark}
              border={border}
              cardBg={cardBg}
              muted={muted}
              title="Avval kategoriya oching"
              subtitle="Harajat yozish uchun kamida bitta kategoriya yarating"
              actionLabel="Kategoriya qo'shish"
              onAction={() => { setSubTab('categories'); openCreateCategory(); }}
              accentGradient={accentColor.gradient}
            />
          ) : expenses.length === 0 ? (
            <EmptyState
              isDark={isDark}
              border={border}
              cardBg={cardBg}
              muted={muted}
              title="Harajatlar yo'q"
              subtitle="Birinchi harajatingizni qo'shing"
              actionLabel="Harajat qo'shish"
              onAction={openCreateExpense}
              accentGradient={accentColor.gradient}
            />
          ) : (
            <div className="grid gap-3">
              {expenses.map((e) => {
                const cat = categories.find((c) => c.id === e.categoryId);
                return (
                  <div key={e.id} className="rounded-2xl border p-4 sm:p-5" style={{ background: cardBg, borderColor: border }}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat?.color || accentColor.color }} />
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                            {e.categoryName}
                          </span>
                          <span className="text-xs inline-flex items-center gap-1" style={{ color: muted }}>
                            <PaymentIcon method={e.paymentMethod} />
                            {PAYMENT_LABELS[e.paymentMethod]}
                          </span>
                        </div>
                        <h3 className="font-bold text-base">{e.title}</h3>
                        {e.note ? <p className="text-sm mt-1" style={{ color: muted }}>{e.note}</p> : null}
                        <p className="text-xs mt-2" style={{ color: muted }}>{formatDate(e.expenseDate)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-lg font-bold text-red-500">{formatUzs(e.amount)}</div>
                        <button type="button" onClick={() => openEditExpense(e)} className="p-2 rounded-xl border" style={{ borderColor: border }}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteExpense(e.id)}
                          disabled={deletingExpenseId === e.id}
                          className="p-2 rounded-xl border text-red-500"
                          style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          {deletingExpenseId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreateCategory}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ background: accentColor.gradient }}
            >
              <FolderPlus className="w-4 h-4" />
              Yangi kategoriya
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} /></div>
          ) : categories.length === 0 ? (
            <EmptyState
              isDark={isDark}
              border={border}
              cardBg={cardBg}
              muted={muted}
              title="Kategoriyalar yo'q"
              subtitle="Ijara, kommunal, transport kabi kategoriyalar oching"
              actionLabel="Birinchi kategoriya"
              onAction={openCreateCategory}
              accentGradient={accentColor.gradient}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((c) => (
                <div key={c.id} className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: border }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}>
                        <Tag className="w-5 h-5" style={{ color: c.color }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold truncate">{c.name}</h3>
                        {c.description ? <p className="text-xs mt-0.5 truncate" style={{ color: muted }}>{c.description}</p> : null}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => openEditCategory(c)} className="p-2 rounded-lg border" style={{ borderColor: border }}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCategory(c.id)}
                        disabled={deletingCategoryId === c.id}
                        className="p-2 rounded-lg border text-red-500"
                        style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        {deletingCategoryId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-sm" style={{ borderColor: border }}>
                    <div>
                      <div className="text-xs" style={{ color: muted }}>Shu oy</div>
                      <div className="font-semibold text-red-500">{formatUzs(c.monthUzs ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: muted }}>Jami</div>
                      <div className="font-semibold">{formatUzs(c.totalUzs ?? 0)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {expenseModalOpen ? (
        <ModalShell isDark={isDark} border={border} onClose={() => setExpenseModalOpen(false)} title={editingExpense ? 'Harajatni tahrirlash' : 'Yangi harajat'}>
          <form onSubmit={submitExpense} className="space-y-4">
            <Field label="Kategoriya" isDark={isDark} border={border} muted={muted}>
              <select
                value={expenseForm.categoryId}
                onChange={(e) => setExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderColor: border, color: isDark ? '#fff' : '#111' }}
              >
                <option value="">Tanlang</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Harajat nomi" isDark={isDark} border={border} muted={muted}>
              <input value={expenseForm.title} onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))} className="field-input" style={inputStyle(isDark, border)} placeholder="Masalan: Ijara to'lovi" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Summa (so'm)" isDark={isDark} border={border} muted={muted}>
                <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} className="field-input" style={inputStyle(isDark, border)} />
              </Field>
              <Field label="Sana" isDark={isDark} border={border} muted={muted}>
                <input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm((f) => ({ ...f, expenseDate: e.target.value }))} className="field-input" style={inputStyle(isDark, border)} />
              </Field>
            </div>
            <Field label="To'lov usuli" isDark={isDark} border={border} muted={muted}>
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderColor: border, color: isDark ? '#fff' : '#111' }}
              >
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Izoh (ixtiyoriy)" isDark={isDark} border={border} muted={muted}>
              <textarea value={expenseForm.note} onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))} rows={3} className="field-input resize-none" style={inputStyle(isDark, border)} />
            </Field>
            <SubmitButton submitting={submitting} gradient={accentColor.gradient} label={editingExpense ? 'Saqlash' : 'Qo\'shish'} />
          </form>
        </ModalShell>
      ) : null}

      {categoryModalOpen ? (
        <ModalShell isDark={isDark} border={border} onClose={() => setCategoryModalOpen(false)} title={editingCategory ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}>
          <form onSubmit={submitCategory} className="space-y-4">
            <Field label="Kategoriya nomi" isDark={isDark} border={border} muted={muted}>
              <input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} className="field-input" style={inputStyle(isDark, border)} placeholder="Ijara, Transport, Ovqat..." />
            </Field>
            <Field label="Tavsif (ixtiyoriy)" isDark={isDark} border={border} muted={muted}>
              <input value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} className="field-input" style={inputStyle(isDark, border)} />
            </Field>
            <Field label="Rang" isDark={isDark} border={border} muted={muted}>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCategoryForm((f) => ({ ...f, color }))}
                    className="w-8 h-8 rounded-full border-2"
                    style={{
                      background: color,
                      borderColor: categoryForm.color === color ? '#fff' : 'transparent',
                      boxShadow: categoryForm.color === color ? `0 0 0 2px ${color}` : undefined,
                    }}
                  />
                ))}
              </div>
            </Field>
            <SubmitButton submitting={submitting} gradient={accentColor.gradient} label={editingCategory ? 'Saqlash' : 'Qo\'shish'} />
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}

function inputStyle(isDark: boolean, border: string): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.75rem',
    border: `1px solid ${border}`,
    background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
    color: isDark ? '#fff' : '#111827',
    fontSize: '0.875rem',
    outline: 'none',
  };
}

function Field({ label, children, muted }: { label: string; children: React.ReactNode; isDark: boolean; border: string; muted: string }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: muted }}>{label}</label>
      {children}
    </div>
  );
}

function SubmitButton({ submitting, gradient, label }: { submitting: boolean; gradient: string; label: string }) {
  return (
    <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2" style={{ background: gradient, opacity: submitting ? 0.7 : 1 }}>
      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
      {label}
    </button>
  );
}

function ModalShell({ title, children, onClose, isDark, border }: { title: string; children: React.ReactNode; onClose: () => void; isDark: boolean; border: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 app-modal-overlay" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-5 sm:p-6" style={{ background: isDark ? '#111' : '#fff', borderColor: border }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  cardBg,
  border,
  muted,
  accentGradient,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  isDark: boolean;
  cardBg: string;
  border: string;
  muted: string;
  accentGradient: string;
}) {
  return (
    <div className="rounded-2xl border p-12 text-center" style={{ background: cardBg, borderColor: border }}>
      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1 mb-4" style={{ color: muted }}>{subtitle}</p>
      <button type="button" onClick={onAction} className="px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: accentGradient }}>
        {actionLabel}
      </button>
    </div>
  );
}
