import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  X,
  User,
  Calendar,
  KeyRound,
  MapPin,
  Store,
  Clock,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useBodyScrollLock } from '../../utils/useBodyScrollLock';

const STEPS = [
  { id: 1, title: 'Ism va familya' },
  { id: 2, title: "Tug'ilgan kun va jins" },
  { id: 3, title: 'Login va parol' },
  { id: 4, title: 'Koordinata' },
  { id: 5, title: "Do'kon nomi" },
  { id: 6, title: 'Ish vaqti' },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  birthDate: '',
  gender: 'male',
  login: '',
  password: '',
  latitude: '',
  longitude: '',
  shopName: '',
  workTime: '09:00 - 22:00',
});

export function AddRentalProviderModal({ open, onClose, onCreated }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  useBodyScrollLock(open);

  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const resetAndClose = () => {
    setStep(1);
    setForm(emptyForm());
    onClose();
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokatsiya qo‘llab-quvvatlanmaydi');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        toast.success('Joy aniqlandi');
        setGeoBusy(false);
      },
      () => {
        toast.error('Joyni aniqlab bo‘lmadi — ruxsat bering');
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const validateStep = (s: number): boolean => {
    if (s === 1 && (!form.firstName.trim() || !form.lastName.trim())) {
      toast.error('Ism va familya kiriting');
      return false;
    }
    if (s === 2 && !form.birthDate) {
      toast.error('Tug‘ilgan kunni tanlang');
      return false;
    }
    if (s === 3 && (!form.login.trim() || !form.password)) {
      toast.error('Login va parol majburiy');
      return false;
    }
    if (s === 5 && !form.shopName.trim()) {
      toast.error("Do'kon nomini kiriting");
      return false;
    }
    if (s === 6 && !form.workTime.trim()) {
      toast.error('Ish vaqtini kiriting (masalan 09:00 - 22:00)');
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(6, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    for (let i = 1; i <= 6; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/branch/rental-providers`, {
        method: 'POST',
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          birthDate: form.birthDate,
          gender: form.gender,
          login: form.login.trim(),
          password: form.password,
          shopName: form.shopName.trim(),
          workTime: form.workTime.trim(),
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Ijara beruvchi qo‘shildi');
        onCreated();
        resetAndClose();
      } else {
        toast.error(data.error || 'Saqlashda xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Yopish"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={resetAndClose}
      />
      <div
        className="relative w-full max-w-lg max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border flex flex-col app-safe-pad"
        style={{
          background: isDark ? '#111' : '#fff',
          borderColor: border,
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: border }}>
          <div>
            <h2 className="text-lg font-bold">Ijara beruvchi qo‘shish</h2>
            <p className="text-xs opacity-60 mt-0.5">
              {step}/6 — {STEPS[step - 1].title}
            </p>
          </div>
          <button type="button" onClick={resetAndClose} className="p-2 rounded-xl opacity-70 hover:opacity-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1 shrink-0">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className="h-1 flex-1 rounded-full transition-all"
              style={{
                background: s.id <= step ? accentColor.color : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {step === 1 ? (
            <>
              <label className="block text-sm font-medium">
                <span className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" /> Ism
                </span>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="Ism"
                />
              </label>
              <label className="block text-sm font-medium">
                <span className="mb-2 block">Familya</span>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="Familya"
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <label className="block text-sm font-medium">
                <span className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" /> Tug‘ilgan kun
                </span>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border"
                  style={{ background: inputBg, borderColor: border }}
                />
              </label>
              <label className="block text-sm font-medium">
                <span className="mb-2 block">Jins</span>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border"
                  style={{ background: inputBg, borderColor: border }}
                >
                  <option value="male">Erkak</option>
                  <option value="female">Ayol</option>
                </select>
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <label className="block text-sm font-medium">
                <span className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-4 h-4" /> Login
                </span>
                <input
                  value={form.login}
                  onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl outline-none border font-mono"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="login"
                />
              </label>
              <label className="block text-sm font-medium">
                <span className="mb-2 block">Parol</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl outline-none border"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="Parol"
                />
              </label>
              <p className="text-xs opacity-50">
                Panel: <code className="opacity-80">/ijara-panel</code>
              </p>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <p className="text-sm opacity-60">
                Ixtiyoriy — «Aniqlash» bilan joriy joyingiz koordinatasi to‘ldiriladi.
              </p>
              <button
                type="button"
                onClick={detectLocation}
                disabled={geoBusy}
                className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 border disabled:opacity-50"
                style={{ borderColor: border, color: accentColor.color }}
              >
                {geoBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                Aniqlash
              </button>
              <label className="block text-sm font-medium">
                <span className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" /> Kenglik (latitude)
                </span>
                <input
                  value={form.latitude}
                  onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border font-mono text-sm"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="41.311081"
                />
              </label>
              <label className="block text-sm font-medium">
                <span className="mb-2 block">Uzunlik (longitude)</span>
                <input
                  value={form.longitude}
                  onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border font-mono text-sm"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="69.279737"
                />
              </label>
            </>
          ) : null}

          {step === 5 ? (
            <label className="block text-sm font-medium">
              <span className="flex items-center gap-2 mb-2">
                <Store className="w-4 h-4" /> Do‘kon nomi
              </span>
              <input
                value={form.shopName}
                onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border"
                style={{ background: inputBg, borderColor: border }}
                placeholder="Masalan: Ali ijara"
              />
            </label>
          ) : null}

          {step === 6 ? (
            <>
              <label className="block text-sm font-medium">
                <span className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" /> Ish vaqti (ochilish vaqti)
                </span>
                <input
                  value={form.workTime}
                  onChange={(e) => setForm((p) => ({ ...p, workTime: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl outline-none border"
                  style={{ background: inputBg, borderColor: border }}
                  placeholder="09:00 - 22:00"
                />
              </label>
              <p className="text-sm rounded-xl p-3 border" style={{ borderColor: border, background: inputBg }}>
                Ish vaqtidan tashqarida mijozlar bu beruvchining mahsulotlariga buyurtma bera olmaydi. Ekranda{' '}
                <strong>ochilish vaqti</strong> ko‘rsatiladi.
              </p>
            </>
          ) : null}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t shrink-0 app-safe-pb" style={{ borderColor: border }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-medium border flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ borderColor: border }}
            >
              <ChevronLeft className="w-4 h-4" /> Orqaga
            </button>
          ) : (
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 py-3 rounded-xl font-medium border"
              style={{ borderColor: border }}
            >
              Bekor
            </button>
          )}
          {step < 6 ? (
            <button
              type="button"
              onClick={next}
              className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-1"
              style={{ background: accentColor.color }}
            >
              Keyingi <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: accentColor.color }}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Saqlash
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
