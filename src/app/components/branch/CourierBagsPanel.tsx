import { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Link2, Pencil, Plus, QrCode, RefreshCw, Save, Undo2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { projectId } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

type CourierOption = {
  id: string;
  name: string;
  status: string;
};

type CourierBag = {
  id: string;
  branchId: string;
  bagNumber: string;
  bagCode: string;
  qrCode?: string;
  bagType?: string;
  notes?: string;
  status: string;
  courierName?: string;
  courierPhone?: string;
  orderNumber?: string;
  currentCourierId?: string | null;
};

type Props = {
  branchId: string;
  couriers: CourierOption[];
  mode?: 'full' | 'createOnly' | 'assignOnly';
};

const BAG_STATUS_LABELS: Record<string, string> = {
  available_in_branch: 'Bo‘sh',
  assigned_empty: 'Kuryerda bo‘sh',
  occupied: 'Band',
  return_pending: 'Qaytishi kerak',
  maintenance: 'Nosoz',
  lost: 'Yo‘qolgan',
  inactive: 'Faol emas',
};

const BAG_STATUS_COLORS: Record<string, string> = {
  available_in_branch: '#10b981',
  assigned_empty: '#3b82f6',
  occupied: '#f59e0b',
  return_pending: '#8b5cf6',
  maintenance: '#ef4444',
  lost: '#dc2626',
  inactive: '#6b7280',
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

export function CourierBagsPanel({ branchId, couriers, mode = 'full' }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedTextColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(17,24,39,0.65)';

  const [bags, setBags] = useState<CourierBag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [selectedBagId, setSelectedBagId] = useState('');
  const [assigningBagId, setAssigningBagId] = useState<string | null>(null);
  const [releasingBagId, setReleasingBagId] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const lookupScannerRef = useRef<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBag, setEditingBag] = useState<CourierBag | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    bagNumber: '',
    bagCode: '',
    qrCode: '',
    bagType: 'standard',
    status: 'available_in_branch',
    notes: '',
  });
  const canManageBags = mode !== 'assignOnly';
  const canAssignBags = mode !== 'createOnly';
  const visibilityRefetchTick = useVisibilityTick();

  const loadBags = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags?branchId=${encodeURIComponent(branchId)}`,
        {
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'So‘mkalarni olishda xatolik');
      }

      setBags(data.bags || []);
    } catch (error) {
      console.error('Load branch courier bags error:', error);
      toast.error(error instanceof Error ? error.message : 'So‘mkalarni olishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBags();
  }, [branchId, visibilityRefetchTick]);

  useEffect(() => {
    if (!lookupOpen) {
      lookupScannerRef.current?.clear().catch(() => {});
      lookupScannerRef.current = null;
      return;
    }

    let cancelled = false;
    let scanner: any = null;

    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const Html5QrcodeScanner = (mod as any).Html5QrcodeScanner;
        scanner = new Html5QrcodeScanner(
          'branch-bag-qr-reader',
          { fps: 8, qrbox: { width: 240, height: 240 } },
          false,
        );
        lookupScannerRef.current = scanner;

        scanner.render(
          async (decodedText: string) => {
            try {
              await scanner.clear();
            } catch {
              /* ignore */
            }
            lookupScannerRef.current = null;
            setLookupOpen(false);
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags/lookup`,
                {
                  method: 'POST',
                  headers: buildBranchHeaders({
                    'Content-Type': 'application/json',
                  }),
                  body: JSON.stringify({ branchId, scan: decodedText }),
                },
              );
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.error || 'So‘mka topilmadi');
              }
              setSelectedBagId(data.bag.id);
              toast.success(`So‘mka tanlandi: #${data.bag.bagNumber}`);
            } catch (error) {
              console.error('Branch bag QR lookup error:', error);
              toast.error(error instanceof Error ? error.message : 'QR bo‘yicha topilmadi');
            }
          },
          () => {},
        );
      } catch (error) {
        console.error('Branch QR scanner load error:', error);
        toast.error('QR skanerni yuklashda xatolik');
        setLookupOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      scanner?.clear?.().catch?.(() => {});
      lookupScannerRef.current = null;
    };
  }, [lookupOpen, branchId]);

  const availableBags = useMemo(
    () => bags.filter((bag) => bag.status === 'available_in_branch'),
    [bags]
  );

  const assignedBags = useMemo(
    () => bags.filter((bag) => bag.status === 'assigned_empty' || bag.status === 'occupied'),
    [bags]
  );

  const stats = useMemo(
    () => ({
      total: bags.length,
      available: bags.filter((bag) => bag.status === 'available_in_branch').length,
      occupied: bags.filter((bag) => bag.status === 'occupied').length,
      assignedEmpty: bags.filter((bag) => bag.status === 'assigned_empty').length,
    }),
    [bags]
  );

  const handleAssignBag = async () => {
    if (!selectedCourierId || !selectedBagId) {
      toast.error('Kuryer va so‘mkani tanlang');
      return;
    }

    setAssigningBagId(selectedBagId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags/${selectedBagId}/assign-courier`,
        {
          method: 'POST',
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            branchId,
            courierId: selectedCourierId,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'So‘mka biriktirilmadi');
      }

      toast.success('So‘mka kuryerga biriktirildi');
      setSelectedBagId('');
      setSelectedCourierId('');
      await loadBags();
    } catch (error) {
      console.error('Assign bag error:', error);
      toast.error(error instanceof Error ? error.message : 'So‘mka biriktirilmadi');
    } finally {
      setAssigningBagId(null);
    }
  };

  const handleReleaseBag = async (bagId: string) => {
    setReleasingBagId(bagId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier-bags/${bagId}/release-courier`,
        {
          method: 'POST',
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ branchId }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'So‘mka qaytarilmadi');
      }

      toast.success('So‘mka filialga qaytarildi');
      await loadBags();
    } catch (error) {
      console.error('Release bag error:', error);
      toast.error(error instanceof Error ? error.message : 'So‘mka qaytarilmadi');
    } finally {
      setReleasingBagId(null);
    }
  };

  const openCreateModal = () => {
    setEditingBag(null);
    setFormData({
      bagNumber: '',
      bagCode: '',
      qrCode: '',
      bagType: 'standard',
      status: 'available_in_branch',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (bag: CourierBag) => {
    setEditingBag(bag);
    setFormData({
      bagNumber: bag.bagNumber || '',
      bagCode: bag.bagCode || '',
      qrCode: bag.qrCode || '',
      bagType: bag.bagType || 'standard',
      status: bag.status || 'available_in_branch',
      notes: bag.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveBag = async () => {
    if (!formData.bagNumber.trim()) {
      toast.error('So‘mka raqamini kiriting');
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
        headers: buildBranchHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          branchId,
          ...formData,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'So‘mka saqlanmadi');
      }
      toast.success(editingBag ? 'So‘mka yangilandi' : 'So‘mka qo‘shildi');
      setIsModalOpen(false);
      setEditingBag(null);
      await loadBags();
    } catch (error) {
      console.error('Save branch bag error:', error);
      toast.error(error instanceof Error ? error.message : 'So‘mka saqlanmadi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" style={{ color: textColor }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Jami', value: stats.total, color: accentColor.color },
          { label: 'Bo‘sh', value: stats.available, color: '#10b981' },
          { label: 'Band', value: stats.occupied, color: '#f59e0b' },
          { label: 'Kuryerda bo‘sh', value: stats.assignedEmpty, color: '#3b82f6' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border p-4"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <p className="text-sm mb-1" style={{ color: mutedTextColor }}>
              {item.label}
            </p>
            <p className="text-2xl font-bold" style={{ color: item.color }}>
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold">So‘mka biriktirish</h3>
            <p style={{ color: mutedTextColor }}>
              Filial bo‘sh so‘mkani kuryerga biriktiradi. Band so‘mka qaytarilmaydi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {canManageBags && (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-2xl font-semibold flex items-center gap-2"
                style={{ background: accentColor.gradient, color: '#ffffff' }}
              >
                <Plus className="w-4 h-4" />
                So‘mka qo‘shish
              </button>
            )}
            <button
              type="button"
              onClick={() => setLookupOpen(true)}
              className="px-4 py-2 rounded-2xl border flex items-center gap-2"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <QrCode className="w-4 h-4" />
              QR tanlash
            </button>
            <button
              type="button"
              onClick={loadBags}
              className="px-4 py-2 rounded-2xl border flex items-center gap-2"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>
        </div>

        {canAssignBags && (
        <div className="grid lg:grid-cols-[1fr_1fr_auto] gap-3 mb-5">
          <select
            value={selectedCourierId}
            onChange={(event) => setSelectedCourierId(event.target.value)}
            className="px-4 py-3 rounded-2xl border outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              color: textColor,
            }}
          >
            <option value="">Kuryerni tanlang</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name} ({courier.status})
              </option>
            ))}
          </select>

          <select
            value={selectedBagId}
            onChange={(event) => setSelectedBagId(event.target.value)}
            className="px-4 py-3 rounded-2xl border outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              color: textColor,
            }}
          >
            <option value="">Bo‘sh so‘mkani tanlang</option>
            {availableBags.map((bag) => (
              <option key={bag.id} value={bag.id}>
                So‘mka #{bag.bagNumber} ({bag.bagCode})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleAssignBag()}
            disabled={assigningBagId !== null || availableBags.length === 0}
            className="px-4 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: accentColor.gradient,
              color: '#ffffff',
            }}
          >
            {assigningBagId !== null ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Link2 className="w-4 h-4 shrink-0" />
            )}
            {assigningBagId !== null ? 'Biriktirilmoqda...' : 'Biriktirish'}
          </button>
        </div>
        )}

        {canAssignBags && (assignedBags.length === 0 ? (
          <div className="py-8 text-center" style={{ color: mutedTextColor }}>
            Hozircha kuryerlarga biriktirilgan so‘mka yo‘q.
          </div>
        ) : (
          <div className="grid xl:grid-cols-2 gap-4">
            {assignedBags.map((bag) => {
              const statusColor = BAG_STATUS_COLORS[bag.status] || '#6b7280';
              return (
                <div
                  key={bag.id}
                  className="rounded-2xl border p-4"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${statusColor}20` }}>
                        <BriefcaseBusiness className="w-5 h-5" style={{ color: statusColor }} />
                      </div>
                      <div>
                        <p className="font-bold">So‘mka #{bag.bagNumber}</p>
                        <p className="text-sm" style={{ color: mutedTextColor }}>
                          {bag.bagCode}
                        </p>
                      </div>
                    </div>

                    <div
                      className="px-3 py-1 rounded-full text-sm font-semibold"
                      style={{ background: `${statusColor}20`, color: statusColor }}
                    >
                      {BAG_STATUS_LABELS[bag.status] || bag.status}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <p><span style={{ color: mutedTextColor }}>Kuryer:</span> {bag.courierName || 'Biriktirilmagan'}</p>
                    <p><span style={{ color: mutedTextColor }}>Buyurtma:</span> {bag.orderNumber || 'Aktiv emas'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleReleaseBag(bag.id)}
                    disabled={bag.status === 'occupied' || releasingBagId === bag.id}
                    className="px-4 py-2 rounded-2xl border text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    {releasingBagId === bag.id ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Undo2 className="w-4 h-4 shrink-0" />
                    )}
                    {bag.status === 'occupied' ? 'Avval order tugasin' : 'Filialga qaytarish'}
                  </button>
                  {canManageBags && (
                    <button
                      onClick={() => openEditModal(bag)}
                      className="ml-2 px-4 py-2 rounded-2xl border text-sm font-semibold inline-flex items-center gap-2"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      Tahrirlash
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {lookupOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setLookupOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setLookupOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-3xl border p-5"
            style={{
              background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              color: textColor,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="So‘mka QR skaner"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="font-bold text-lg">So‘mka QR</p>
              <button
                type="button"
                onClick={() => setLookupOpen(false)}
                className="p-2 rounded-xl border"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                }}
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div id="branch-bag-qr-reader" className="rounded-2xl overflow-hidden" />
          </div>
        </div>
      )}

      {canManageBags && isModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => !isSaving && setIsModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-3xl border p-5"
            style={{
              background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="So‘mka saqlash"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{editingBag ? 'So‘mkani tahrirlash' : 'Yangi so‘mka'}</h3>
              <button
                type="button"
                onClick={() => !isSaving && setIsModalOpen(false)}
                className="p-2 rounded-xl border"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={formData.bagNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, bagNumber: e.target.value }))}
                placeholder="So‘mka raqami"
                className="px-4 py-3 rounded-2xl border outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
              />
              <input
                value={formData.bagCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, bagCode: e.target.value }))}
                placeholder="So‘mka kodi (ixtiyoriy)"
                className="px-4 py-3 rounded-2xl border outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
              />
              <input
                value={formData.qrCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, qrCode: e.target.value }))}
                placeholder="QR kodi (ixtiyoriy)"
                className="px-4 py-3 rounded-2xl border outline-none md:col-span-2"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
              />
              <input
                value={formData.bagType}
                onChange={(e) => setFormData((prev) => ({ ...prev, bagType: e.target.value }))}
                placeholder="Turi (standard)"
                className="px-4 py-3 rounded-2xl border outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
              />
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="px-4 py-3 rounded-2xl border outline-none"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
              >
                {BAG_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Izoh"
                className="px-4 py-3 rounded-2xl border outline-none md:col-span-2 min-h-[96px]"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-2xl border font-semibold"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={() => void handleSaveBag()}
                disabled={isSaving}
                className="px-4 py-2 rounded-2xl font-semibold text-white inline-flex items-center gap-2 disabled:opacity-60"
                style={{ background: accentColor.gradient }}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
