import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Send, Save } from 'lucide-react';
import { projectId } from '../../../../utils/supabase/info';
import { buildRentalPanelHeaders } from '../../utils/requestAuth';
import { toast } from 'sonner';

const base = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals`;

export function RentalBranchTelegramSettings({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [rentalTelegramChatId, setRentalTelegramChatId] = useState('');
  const [autoCourierRentalsEnabled, setAutoCourierRentalsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${base}/branch/rental-notify-settings/${encodeURIComponent(branchId)}`, {
          headers: buildRentalPanelHeaders(),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          if (typeof data.rentalTelegramChatId === 'string') {
            setRentalTelegramChatId(data.rentalTelegramChatId);
          }
          if (typeof data.autoCourierRentalsEnabled === 'boolean') {
            setAutoCourierRentalsEnabled(data.autoCourierRentalsEnabled);
          }
        }
      } catch {
        if (!cancelled) toast.error('Filial Telegram sozlamalarini yuklashda xatolik');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${base}/branch/rental-notify-settings`, {
        method: 'PUT',
        headers: { ...buildRentalPanelHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          rentalTelegramChatId,
          autoCourierRentalsEnabled,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Saqlanmadi');
        return;
      }
      toast.success('Saqlandi');
      if (typeof data.rentalTelegramChatId === 'string') {
        setRentalTelegramChatId(data.rentalTelegramChatId);
      }
      if (typeof data.autoCourierRentalsEnabled === 'boolean') {
        setAutoCourierRentalsEnabled(data.autoCourierRentalsEnabled);
      }
    } catch {
      toast.error('Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const chatId = String(rentalTelegramChatId || '').trim();
    if (!chatId) {
      toast.error('Avval chat ID kiriting');
      return;
    }
    try {
      setTestLoading(true);
      const res = await fetch(`${base}/telegram/test-prep`, {
        method: 'POST',
        headers: { ...buildRentalPanelHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, telegramChatId: chatId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Yuborilmadi');
        return;
      }
      toast.success('Sinov xabari yuborildi');
    } catch {
      toast.error('Yuborishda xatolik');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-4 border"
      style={{
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <p className="font-semibold text-sm" style={{ color: accentColor.color }}>
        Filial: ijara buyurtma Telegram
      </p>
      <p
        className="text-xs leading-relaxed"
        style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
      >
        Har qanday ijara buyurtmasi tushganda shu chatga ham «Sizdan buyurtma qilindi» xabari ketadi.
        Mahsulotda alohida tayyorlovchi chat bo‘lsa, ikkalasiga yuboriladi (bir xil bo‘lsa — bir marta).
        Bo‘sh qoldirsangiz, faqat mahsulotdagi chat ishlatiladi.
      </p>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="mt-1 rounded border"
          checked={autoCourierRentalsEnabled}
          onChange={(e) => setAutoCourierRentalsEnabled(e.target.checked)}
          disabled={loading}
        />
        <span className="text-sm leading-snug" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#111' }}>
          <span className="font-semibold">Avto-kuryer (10 kg dan yuqori yoki mahsulotda belgilangan)</span>
          <span
            className="block text-xs mt-1"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)' }}
          >
            O‘chirilsa, og‘ir buyurtmalar ham oddiy kuryer orqali — faqat Telegram navbati va avto-kuryer xabarlari ishlamaydi.
          </span>
        </span>
      </label>
      <div>
        <label className="block mb-2 font-medium text-sm">Filial chat ID (ixtiyoriy)</label>
        <input
          type="text"
          value={rentalTelegramChatId}
          onChange={(e) => setRentalTelegramChatId(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3 rounded-2xl outline-none font-mono text-sm"
          style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
          placeholder={loading ? 'Yuklanmoqda…' : '-1001234567890 yoki @username'}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
          style={{ background: accentColor.color }}
        >
          <Save className="w-4 h-4 shrink-0" />
          {saving ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={testLoading || loading || !String(rentalTelegramChatId || '').trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
            color: accentColor.color,
          }}
        >
          <Send className="w-4 h-4 shrink-0" />
          {testLoading ? 'Yuborilmoqda…' : 'Sinov xabari'}
        </button>
      </div>
    </div>
  );
}
