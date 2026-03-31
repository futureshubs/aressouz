import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { projectId } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

type PickupRack = {
  id: string;
  branchId: string;
  name: string;
  number: string;
  status: 'available' | 'occupied';
  currentOrderId?: string | null;
};

type Props = {
  branchId: string;
};

export function PickupRacksPanel({ branchId }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [racks, setRacks] = useState<PickupRack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingRackId, setDeletingRackId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', number: '' });
  const visibilityRefetchTick = useVisibilityTick();

  const loadRacks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pickup-racks?branchId=${encodeURIComponent(branchId)}`,
        { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Rastalarni olishda xatolik');
      setRacks(data.racks || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rastalarni olishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRacks();
  }, [branchId, visibilityRefetchTick]);

  const stats = useMemo(() => ({
    total: racks.length,
    available: racks.filter((r) => r.status === 'available').length,
    occupied: racks.filter((r) => r.status === 'occupied').length,
  }), [racks]);

  const addRack = async () => {
    if (!form.name.trim() || !form.number.trim()) {
      toast.error('Rasta nomi va raqamini kiriting');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pickup-racks`, {
        method: 'POST',
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ branchId, name: form.name, number: form.number }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Rasta qo‘shilmadi');
      setForm({ name: '', number: '' });
      toast.success('Rasta qo‘shildi');
      await loadRacks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rasta qo‘shilmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRack = async (rack: PickupRack) => {
    if (rack.status === 'occupied' || rack.currentOrderId) {
      toast.error('Band rastani o‘chirib bo‘lmaydi');
      return;
    }
    const confirmed = window.confirm(`Rasta #${rack.number} (${rack.name}) o‘chirilsinmi?`);
    if (!confirmed) return;

    setDeletingRackId(rack.id);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pickup-racks/${encodeURIComponent(rack.id)}?branchId=${encodeURIComponent(branchId)}`,
        {
          method: 'DELETE',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Rasta o‘chirilmadi');
      toast.success('Rasta o‘chirildi');
      await loadRacks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rasta o‘chirilmadi');
    } finally {
      setDeletingRackId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Jami', value: stats.total, color: accentColor.color },
          { label: 'Bo‘sh', value: stats.available, color: '#10b981' },
          { label: 'Band', value: stats.occupied, color: '#f59e0b' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border p-4" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
            <p className="text-sm opacity-70">{item.label}</p>
            <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border p-4 space-y-3" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
        <h3 className="text-xl font-bold">Olib ketish rastasi</h3>
        <div className="grid md:grid-cols-[1fr_1fr_auto_auto] gap-2">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Rasta nomi" className="px-4 py-3 rounded-2xl border outline-none" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
          <input value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} placeholder="Rasta raqami" className="px-4 py-3 rounded-2xl border outline-none" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
          <button onClick={addRack} disabled={isSaving} className="px-4 py-3 rounded-2xl font-semibold text-white inline-flex items-center gap-2 disabled:opacity-60" style={{ background: accentColor.gradient }}><Plus className="w-4 h-4" /><Save className="w-4 h-4" />Qo‘shish</button>
          <button onClick={loadRacks} className="px-4 py-3 rounded-2xl border inline-flex items-center gap-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />Yangilash</button>
        </div>
      </div>

      <div className="rounded-3xl border p-4" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
        {isLoading ? (
          <div className="py-8 text-center opacity-70">Rastalar yuklanmoqda...</div>
        ) : racks.length === 0 ? (
          <div className="py-8 text-center opacity-70">Hali rasta qo‘shilmagan</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {racks.map((rack) => (
              <div key={rack.id} className="rounded-2xl border p-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                <p className="font-bold">#{rack.number} · {rack.name}</p>
                <p className="text-sm opacity-70">Holat: {rack.status === 'available' ? 'Bo‘sh' : 'Band'}</p>
                {rack.currentOrderId && <p className="text-xs opacity-70">Order: {rack.currentOrderId}</p>}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => deleteRack(rack)}
                    disabled={deletingRackId === rack.id}
                    className="px-3 py-2 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                    style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444' }}
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingRackId === rack.id ? 'O‘chirilmoqda...' : 'O‘chirish'}
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

