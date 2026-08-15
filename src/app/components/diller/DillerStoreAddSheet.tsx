import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Navigation, Save, Store, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import { createStore, ensureUniqueStoreName, updateStore } from '../../utils/dillerData';
import { CheckoutMapPickerModal } from '../CheckoutMapPickerModal';
import { reverseGeocodeDisplayLine } from '../../utils/geolocationDetect';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageStyle,
} from './dillerIosGlass';
import { DillerLocalImageField } from './DillerLocalImageField';

type Props = {
  open: boolean;
  data: DillerData;
  editStore?: DillerStore | null;
  onClose: () => void;
  onSave: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3.5 py-3 rounded-[14px] text-sm outline-none ${
    isDark ? 'text-white placeholder:text-white/35' : 'text-gray-900 placeholder:text-gray-400'
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
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editStore) {
      setName(editStore.name);
      setAddress(editStore.address);
      setPhone(editStore.phone);
      setContactName(editStore.contactName);
      setLat(editStore.lat ?? null);
      setLng(editStore.lng ?? null);
      setImageUrl(editStore.imageUrl ?? '');
    } else {
      setName('');
      setAddress('');
      setPhone('');
      setContactName('');
      setLat(null);
      setLng(null);
      setImageUrl('');
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
    setImageUrl('');
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
      imageUrl: imageUrl.trim() || undefined,
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
        className={`${dillerSheetShellClass} animate-in fade-in slide-in-from-bottom-8 duration-300`}
        style={{ ...iosGlassPageStyle(isDark), zIndex: 115 }}
      >
        <header className="shrink-0 px-4 pt-2 pb-3" style={{ ...iosGlassBarStyle(isDark), borderTop: 'none' }}>
          <div className="flex justify-center pb-2">
            <span className="w-10 h-1 rounded-full bg-white/25" />
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0"
              style={{ background: `${accentColor.color}22` }}
            >
              <Store className="w-5 h-5" style={{ color: accentColor.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-[17px] tracking-tight">
                {isEdit ? 'Do‘konni tahrirlash' : 'Yangi do‘kon'}
              </h2>
              <p className="text-[11px] opacity-50 truncate">Nom, manzil, GPS, telefon</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              style={iosGlassCardStyle(isDark)}
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-3 max-w-lg mx-auto w-full`}>
          <div className="rounded-[24px] p-4 space-y-3.5" style={iosGlassCardStyle(isDark)}>
            <DillerLocalImageField
              imageUrl={imageUrl}
              onChange={setImageUrl}
              isDark={isDark}
              accentColor={accentColor.color}
              label="Do‘kon rasmi"
            />
            <div>
              <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Do‘kon nomi *</label>
              <input
                placeholder="Masalan: Mini market «Oqtepa»"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
              {willRename ? (
                <p className="text-[10px] text-amber-500/90 mt-1.5">
                  Saqlanganda nom: <strong>{previewName}</strong> (bunday nom allaqachon bor)
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Manzil</label>
              <input
                placeholder="Toshkent, Chilonzor..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Koordinata</label>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <div
                  className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-[14px] text-xs font-mono truncate ${
                    coordsText ? 'text-emerald-400' : 'opacity-50'
                  }`}
                  style={iosGlassInputStyle(isDark)}
                >
                  {coordsText ?? 'Aniqlanmagan'}
                </div>
                <button
                  type="button"
                  onClick={detectGps}
                  disabled={locBusy}
                  className="shrink-0 px-3 py-2.5 rounded-[14px] flex items-center gap-1 text-xs font-bold disabled:opacity-50 active:scale-95"
                  style={iosGlassCardStyle(isDark)}
                >
                  <Navigation className={`w-4 h-4 ${locBusy ? 'animate-pulse' : ''}`} />
                  GPS
                </button>
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className="shrink-0 px-3 py-2.5 rounded-[14px] flex items-center gap-1 text-xs font-bold active:scale-95"
                  style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
                >
                  <MapPin className="w-4 h-4" />
                  Xarita
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Telefon *</label>
              <input
                type="tel"
                placeholder="+998901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Mas‘ul ism *</label>
              <input
                placeholder="Masalan: Jasur"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>
          </div>
        </div>

        <div
          className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full"
          style={{ ...iosGlassBarStyle(isDark), borderBottom: 'none' }}
        >
          <button
            type="button"
            onClick={save}
            className="w-full py-3.5 rounded-[16px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
            style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
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
