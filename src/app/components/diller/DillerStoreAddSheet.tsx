import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Navigation, Save, Store, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import { createStore, ensureUniqueStoreName, updateStore } from '../../utils/dillerData';
import { CheckoutMapPickerModal } from '../CheckoutMapPickerModal';
import { reverseGeocodeDisplayLine } from '../../utils/geolocationDetect';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  data: DillerData;
  editStore?: DillerStore | null;
  onClose: () => void;
  onSave: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

export function DillerStoreAddSheet({ open, data, editStore = null, onClose, onSave }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isEdit = editStore != null;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editStore) {
      setName(editStore.name);
      setAddress(editStore.address);
      setPhone(editStore.phone);
      setContactName(editStore.contactName);
      setLat(editStore.lat ?? null);
      setLng(editStore.lng ?? null);
    } else {
      setName('');
      setAddress('');
      setPhone('');
      setContactName('');
      setLat(null);
      setLng(null);
    }
  }, [open, editStore]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setContactName('');
    setLat(null);
    setLng(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const applyCoords = async (newLat: number, newLng: number, fillAddressIfEmpty = true) => {
    setLat(newLat);
    setLng(newLng);
    if (fillAddressIfEmpty && !address.trim()) {
      const line = await reverseGeocodeDisplayLine(newLat, newLng);
      if (line) setAddress(line);
    }
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokatsiya qo‘llab-quvvatlanmaydi');
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyCoords(pos.coords.latitude, pos.coords.longitude);
        setLocBusy(false);
        toast.success('Koordinata aniqlandi');
      },
      () => {
        setLocBusy(false);
        toast.error('Joylashuvni olish mumkin emas — xaritadan tanlang');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const save = () => {
    const payload = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      contactName: contactName.trim(),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    };

    const result = isEdit
      ? updateStore(data, editStore.id, payload)
      : createStore(data, payload);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const savedStore = isEdit
      ? result.data.stores.find((s) => s.id === editStore.id)
      : result.data.stores.find(
          (s) => !data.stores.some((prev) => prev.id === s.id),
        );
    const savedName = savedStore?.name ?? payload.name;
    const autoRenamed =
      savedName !== payload.name && payload.name.trim().length > 0;

    onSave(result.data);
    resetForm();
    onClose();
    if (autoRenamed) {
      toast.success(`Saqlendi: «${savedName}» (nom band edi, avtomatik raqamlangan)`);
    } else {
      toast.success(isEdit ? 'Do‘kon yangilandi' : 'Do‘kon saqlandi');
    }
  };

  const previewName = name.trim()
    ? ensureUniqueStoreName(name.trim(), data.stores, editStore?.id)
    : '';
  const willRename = name.trim().length > 0 && previewName !== name.trim();

  const coordsText =
    lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null;

  return (
    <>
      <div
        className={dillerSheetShellClass}
        style={{ background: isDark ? '#0a0a0a' : '#f1f5f9', zIndex: 115 }}
      >
        <header
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accentColor.color}22` }}
          >
            <Store className="w-5 h-5" style={{ color: accentColor.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base">{isEdit ? 'Do‘konni tahrirlash' : 'Do‘kon qo‘shish'}</h2>
            <p className="text-[10px] opacity-50 truncate">Nom, manzil, GPS, telefon</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl opacity-70 hover:opacity-100"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-3 max-w-lg mx-auto w-full pb-6`}>
          <p className="text-xs opacity-70">
            Tarqatish nuqtasi: nom, manzil, GPS (ixtiyoriy), telefon va mas‘ul.
          </p>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Do‘kon nomi *</label>
            <input
              placeholder="Masalan: Mini market «Oqtepa»"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls(isDark)}
            />
            {willRename ? (
              <p className="text-[10px] text-amber-500/90 mt-1">
                Saqlanganda nom: <strong>{previewName}</strong> (bunday nom allaqachon bor)
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Manzil</label>
            <input
              placeholder="Toshkent, Chilonzor..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Koordinata (ixtiyoriy)</label>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div
                className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border text-xs font-mono truncate ${
                  coordsText ? 'text-emerald-400' : 'opacity-50'
                }`}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {coordsText ?? 'Aniqlanmagan'}
              </div>
              <button
                type="button"
                onClick={detectGps}
                disabled={locBusy}
                className="shrink-0 px-3 py-2.5 rounded-xl border flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
              >
                <Navigation className={`w-4 h-4 ${locBusy ? 'animate-pulse' : ''}`} />
                GPS
              </button>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="shrink-0 px-3 py-2.5 rounded-xl border flex items-center gap-1 text-xs font-bold"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                  color: accentColor.color,
                }}
              >
                <MapPin className="w-4 h-4" />
                Xarita
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Telefon *</label>
            <input
              type="tel"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium opacity-80 mb-1">Mas‘ul ism *</label>
            <input
              placeholder="Masalan: Jasur"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={inputCls(isDark)}
            />
          </div>
        </div>

        <div
          className="shrink-0 px-4 py-3 border-t max-w-lg mx-auto w-full"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <button
            type="button"
            onClick={save}
            className="w-full py-3.5 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2"
            style={{ background: accentColor.gradient }}
          >
            <Save className="w-4 h-4" />
            {isEdit ? 'O‘zgarishlarni saqlash' : 'Do‘konni saqlash'}
          </button>
        </div>
      </div>

      <CheckoutMapPickerModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        initialCenter={lat != null && lng != null ? { lat, lng } : null}
        isDark={isDark}
        accentColor={accentColor}
        onConfirm={async (coords) => {
          await applyCoords(coords.lat, coords.lng);
          setMapOpen(false);
          toast.success('Xaritadan koordinata olindi');
        }}
      />
    </>
  );
}
