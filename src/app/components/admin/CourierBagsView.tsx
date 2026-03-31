import { useEffect, useMemo, useState } from 'react';
import { Package2, Plus, RefreshCw, Save, X, Pencil, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { buildAdminHeaders } from '../../utils/requestAuth';
import { projectId } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

type BranchOption = {
  id: string;
  name: string;
};

type CourierBag = {
  id: string;
  branchId: string;
  bagNumber: string;
  bagCode: string;
  qrCode: string;
  bagType: string;
  capacityLevel: string;
  status: string;
  notes: string;
  courierName?: string;
  orderNumber?: string;
};

const BAG_STATUS_OPTIONS = [
  { value: 'available_in_branch', label: 'Bo‘sh' },
  { value: 'assigned_empty', label: 'Kuryerda bo‘sh' },
  { value: 'occupied', label: 'Band' },
  { value: 'return_pending', label: 'Qaytishi kerak' },
  { value: 'maintenance', label: 'Nosoz' },
  { value: 'lost', label: 'Yo‘qolgan' },
  { value: 'inactive', label: 'Faol emas' },
];

const getBagStatusLabel = (status: string) =>
  BAG_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const getBagStatusColor = (status: string) => {
  switch (status) {
    case 'available_in_branch':
      return '#10b981';
    case 'assigned_empty':
      return '#3b82f6';
    case 'occupied':
      return '#f59e0b';
    case 'return_pending':
      return '#8b5cf6';
    case 'maintenance':
      return '#ef4444';
    case 'lost':
      return '#dc2626';
    default:
      return '#6b7280';
  }
};

const initialForm = {
  branchId: '',
  bagNumber: '',
  bagCode: '',
  qrCode: '',
  bagType: 'standard',
  status: 'available_in_branch',
  notes: '',
};

export default function CourierBagsView() {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedTextColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(17,24,39,0.65)';

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [bags, setBags] = useState<CourierBag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBag, setEditingBag] = useState<CourierBag | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const visibilityRefetchTick = useVisibilityTick();

  const loadBranches = async () => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
      {
        headers: buildAdminHeaders({
          'Content-Type': 'application/json',
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Filiallarni olishda xatolik');
    }

    const data = await response.json();
    setBranches(
      (data.branches || []).map((branch: any) => ({
        id: branch.id,
        name: branch.name || branch.branchName || branch.login || branch.id,
      }))
    );
  };

  const loadBags = async (branchId = selectedBranchId) => {
    setIsLoading(true);
    try {
      const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags${query}`,
        {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      const raw = await response.text();
      let data: { success?: boolean; error?: string; bags?: CourierBag[] } = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            response.status === 404
              ? 'So‘mkalar API topilmadi (edge funksiyasini yangilang)'
              : `Server javobi noto‘g‘ri (HTTP ${response.status})`
          );
        }
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'So‘mkalarni olishda xatolik');
      }

      setBags(data.bags || []);
    } catch (error) {
      console.error('Load courier bags error:', error);
      toast.error(error instanceof Error ? error.message : 'So‘mkalarni olishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        await loadBranches();
        await loadBags('');
      } catch (error) {
        console.error('Bootstrap courier bags error:', error);
        toast.error('So‘mka bo‘limini yuklashda xatolik');
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [visibilityRefetchTick]);

  useEffect(() => {
    loadBags(selectedBranchId);
  }, [selectedBranchId, visibilityRefetchTick]);

  const stats = useMemo(() => ({
    total: bags.length,
    available: bags.filter((bag) => bag.status === 'available_in_branch').length,
    occupied: bags.filter((bag) => bag.status === 'occupied').length,
    maintenance: bags.filter((bag) => bag.status === 'maintenance').length,
  }), [bags]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingBag(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!formData.branchId || !formData.bagNumber.trim()) {
      toast.error('Filial va so‘mka raqamini kiriting');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingBag
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags/${editingBag.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags`;
      const method = editingBag ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: buildAdminHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'So‘mka saqlanmadi');
      }

      toast.success(editingBag ? 'So‘mka yangilandi' : 'So‘mka qo‘shildi');
      resetForm();
      await loadBags(selectedBranchId);
    } catch (error) {
      console.error('Save courier bag error:', error);
      toast.error(error instanceof Error ? error.message : 'So‘mka saqlanmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (bag: CourierBag) => {
    setEditingBag(bag);
    setFormData({
      branchId: bag.branchId,
      bagNumber: bag.bagNumber,
      bagCode: bag.bagCode,
      qrCode: bag.qrCode,
      bagType: bag.bagType,
      status: bag.status,
      notes: bag.notes || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6" style={{ color: textColor }}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">So‘mkalar</h2>
          <p style={{ color: mutedTextColor }}>
            Admin yangi so‘mka yaratadi, filial esa kuryerlarga biriktiradi.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="px-4 py-3 rounded-2xl border outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              color: textColor,
            }}
          >
            <option value="">Barcha filiallar</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadBags(selectedBranchId)}
            className="px-4 py-3 rounded-2xl border flex items-center gap-2"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Yangilash
          </button>

          <button
            onClick={() => {
              setEditingBag(null);
              setFormData({
                ...initialForm,
                branchId: selectedBranchId,
              });
              setIsModalOpen(true);
            }}
            className="px-4 py-3 rounded-2xl flex items-center gap-2 font-semibold"
            style={{
              background: accentColor.gradient,
              color: '#ffffff',
            }}
          >
            <Plus className="w-4 h-4" />
            So‘mka qo‘shish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Jami', value: stats.total, color: accentColor.color },
          { label: 'Bo‘sh', value: stats.available, color: '#10b981' },
          { label: 'Band', value: stats.occupied, color: '#f59e0b' },
          { label: 'Nosoz', value: stats.maintenance, color: '#ef4444' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border p-5"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <p className="text-sm mb-1" style={{ color: mutedTextColor }}>
              {item.label}
            </p>
            <p className="text-3xl font-bold" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-3xl border p-5"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        {isLoading ? (
          <div className="py-12 text-center" style={{ color: mutedTextColor }}>
            So‘mkalar yuklanmoqda...
          </div>
        ) : bags.length === 0 ? (
          <div className="py-12 text-center" style={{ color: mutedTextColor }}>
            Bu filtr bo‘yicha so‘mka topilmadi.
          </div>
        ) : (
          <div className="grid xl:grid-cols-2 gap-4">
            {bags.map((bag) => {
              const statusColor = getBagStatusColor(bag.status);
              const branchName = branches.find((branch) => branch.id === bag.branchId)?.name || bag.branchId;
              return (
                <div
                  key={bag.id}
                  className="rounded-2xl border p-4"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${statusColor}20` }}>
                        <Package2 className="w-6 h-6" style={{ color: statusColor }} />
                      </div>
                      <div>
                        <p className="font-bold text-lg">So‘mka #{bag.bagNumber}</p>
                        <p className="text-sm" style={{ color: mutedTextColor }}>
                          {branchName}
                        </p>
                      </div>
                    </div>

                    <div
                      className="px-3 py-1 rounded-full text-sm font-semibold"
                      style={{ background: `${statusColor}20`, color: statusColor }}
                    >
                      {getBagStatusLabel(bag.status)}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                      <p style={{ color: mutedTextColor }}>Kod</p>
                      <p className="font-semibold">{bag.bagCode}</p>
                    </div>
                    <div>
                      <p style={{ color: mutedTextColor }}>QR</p>
                      <p className="font-semibold">{bag.qrCode}</p>
                    </div>
                    <div>
                      <p style={{ color: mutedTextColor }}>Kuryer</p>
                      <p className="font-semibold">{bag.courierName || 'Biriktirilmagan'}</p>
                    </div>
                    <div>
                      <p style={{ color: mutedTextColor }}>Buyurtma</p>
                      <p className="font-semibold">{bag.orderNumber || 'Aktiv emas'}</p>
                    </div>
                  </div>

                  {bag.notes ? (
                    <div
                      className="rounded-2xl p-3 mb-4 text-sm"
                      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                    >
                      {bag.notes}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(bag)}
                      className="px-4 py-2 rounded-2xl border flex items-center gap-2 text-sm"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      Tahrirlash
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full max-w-lg rounded-3xl border p-6"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              color: textColor,
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold">{editingBag ? 'So‘mkani tahrirlash' : 'Yangi so‘mka'}</h3>
                <p style={{ color: mutedTextColor }}>
                  1 so‘mka = 1 aktiv order modeli uchun inventar.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Filial</label>
                <select
                  value={formData.branchId}
                  onChange={(event) => setFormData((prev) => ({ ...prev, branchId: event.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    color: textColor,
                  }}
                >
                  <option value="">Filialni tanlang</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">So‘mka raqami</label>
                  <input
                    value={formData.bagNumber}
                    onChange={(event) => setFormData((prev) => ({ ...prev, bagNumber: event.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      color: textColor,
                    }}
                    placeholder="101"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Tur</label>
                  <input
                    value={formData.bagType}
                    onChange={(event) => setFormData((prev) => ({ ...prev, bagType: event.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      color: textColor,
                    }}
                    placeholder="standard"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">Kod</label>
                  <input
                    value={formData.bagCode}
                    onChange={(event) => setFormData((prev) => ({ ...prev, bagCode: event.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      color: textColor,
                    }}
                    placeholder="Ixtiyoriy"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">QR kodi</label>
                  <input
                    value={formData.qrCode}
                    onChange={(event) => setFormData((prev) => ({ ...prev, qrCode: event.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      color: textColor,
                    }}
                    placeholder="Ixtiyoriy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Holat</label>
                <select
                  value={formData.status}
                  onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    color: textColor,
                  }}
                >
                  {BAG_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2">Izoh</label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border outline-none min-h-[96px]"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    color: textColor,
                  }}
                  placeholder="Nosozlik, model yoki maxsus belgi"
                />
              </div>

              <div
                className="rounded-2xl p-4 text-sm flex items-start gap-3"
                style={{
                  background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
                  color: isDark ? '#fde68a' : '#92400e',
                }}
              >
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>
                  occupied holatdagi so‘mka order tugamaguncha filialga qaytarilmaydi. maintenance yoki lost
                  holatidagi so‘mka kuryerga biriktirilmaydi.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingBag ? 'Saqlash' : 'Qo‘shish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
