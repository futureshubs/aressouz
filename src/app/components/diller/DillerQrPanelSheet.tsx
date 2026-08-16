import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Download, Loader2, QrCode, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData } from '../../utils/dillerData';
import {
  ensureOrderToken,
  getDillerBrandLabel,
  getQrcodeOrderUrl,
  updateDillerProfile,
} from '../../utils/dillerData';
import { downloadDillerQrPoster, makeDillerQrDataUrl } from '../../utils/dillerQrPoster';
import { pushDillerLocalNow } from '../../utils/dillerSync';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageSurface,
} from './dillerIosGlass';

type Props = {
  open: boolean;
  data: DillerData;
  onClose: () => void;
  onDataChange: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3.5 py-3 rounded-[14px] text-sm outline-none ${
    isDark ? 'text-white placeholder:text-white/35' : 'text-gray-900 placeholder:text-gray-400'
  }`;

export function DillerQrPanelSheet({ open, data, onClose, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const dataWithToken = ensureOrderToken(data);
  const orderToken = dataWithToken.profile.orderToken ?? '';
  const orderUrl = orderToken ? getQrcodeOrderUrl(orderToken) : '';

  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [instagram, setInstagram] = useState('');
  const [qrSrc, setQrSrc] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone(data.profile.orderPhone ?? data.profile.phone ?? '');
    setTelegram(data.profile.telegram ?? '');
    setInstagram(data.profile.instagram ?? '');
    if (dataWithToken.profile.orderToken && dataWithToken.profile.orderToken !== data.profile.orderToken) {
      onDataChange(dataWithToken);
    }
  }, [open, data.profile.orderPhone, data.profile.phone, data.profile.telegram, data.profile.instagram]);

  useEffect(() => {
    if (!open || !orderUrl) {
      setQrSrc('');
      return;
    }
    let cancelled = false;
    void makeDillerQrDataUrl(orderUrl, 640).then((src) => {
      if (!cancelled) setQrSrc(src);
    });
    return () => {
      cancelled = true;
    };
  }, [open, orderUrl]);

  if (!open) return null;

  const brand = getDillerBrandLabel(data.profile.companyName);

  const saveContacts = () => {
    const next = updateDillerProfile(dataWithToken, {
      orderPhone: phone.trim(),
      telegram: telegram.trim(),
      instagram: instagram.trim(),
    });
    onDataChange(next);
    toast.success('Aloqa ma’lumotlari saqlandi');
  };

  const copyLink = async () => {
    if (!orderUrl) return;
    try {
      await navigator.clipboard.writeText(orderUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = orderUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success('Havola nusxalandi');
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadPoster = async () => {
    if (!orderToken) return;
    setDownloading(true);
    try {
      const sync = await pushDillerLocalNow();
      if (sync.status !== 'synced') {
        toast.error('QR yuborish uchun avval internet va bulutga ulanish kerak');
        return;
      }
      await downloadDillerQrPoster({
        orderUrl,
        companyName: brand,
        phone: phone.trim() || data.profile.phone,
        telegram: telegram.trim(),
        instagram: instagram.trim(),
        filename: `buyurtma-qr-${orderToken.slice(0, 8)}.png`,
      });
      toast.success('QR yuklab olindi (10×7 sm)');
    } catch {
      toast.error('QR yuklab olinmadi');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={dillerSheetShellClass} style={{ ...iosGlassPageSurface(isDark), zIndex: 122 }}>
      <header className="shrink-0 flex items-center gap-2 px-4 py-3" style={iosGlassBarStyle(isDark)}>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black">QR kod</h2>
          <p className="text-[11px] opacity-50">Do‘konlar skaner qilib buyurtma beradi</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl"
          style={iosGlassCardStyle(isDark)}
          aria-label="Yopish"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-4 max-w-lg mx-auto w-full pb-8`}>
        <div className="rounded-[26px] p-5 text-center" style={iosGlassCardStyle(isDark)}>
          <div
            className="mx-auto w-[min(72vw,280px)] aspect-square rounded-[22px] p-3 flex items-center justify-center"
            style={{ background: '#fff' }}
          >
            {qrSrc ? (
              <img src={qrSrc} alt="Buyurtma QR" className="w-full h-full object-contain" />
            ) : (
              <QrCode className="w-16 h-16 text-slate-300" />
            )}
          </div>
          <div className="font-black text-[17px] mt-4">{brand}</div>
          <p className="text-[11px] opacity-50 mt-1">Kamerani shu kodga yo‘naltiring</p>
        </div>

        <div className="rounded-[20px] p-3" style={iosGlassCardStyle(isDark)}>
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-45 mb-1.5">Havola</div>
          <p className="text-[11px] break-all opacity-70 mb-2">{orderUrl || '—'}</p>
          <button
            type="button"
            onClick={() => void copyLink()}
            disabled={!orderUrl}
            className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={iosGlassInputStyle(isDark)}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Nusxalandi' : 'Havolani nusxalash'}
          </button>
        </div>

        <div className="space-y-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon (QR va posterda)"
            className={inputCls(isDark)}
            style={iosGlassInputStyle(isDark)}
          />
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="Telegram (@username)"
            className={inputCls(isDark)}
            style={iosGlassInputStyle(isDark)}
          />
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="Instagram (@username)"
            className={inputCls(isDark)}
            style={iosGlassInputStyle(isDark)}
          />
          <button
            type="button"
            onClick={saveContacts}
            className="w-full py-3 rounded-[16px] text-sm font-bold"
            style={iosGlassCardStyle(isDark)}
          >
            Aloqani saqlash
          </button>
        </div>

        <p className="text-[11px] opacity-45 leading-relaxed px-1">
          Yuklab olingan 10×7 sm posterni karobkaga yopishtiring. Skaner buyurtma sahifasiga olib boradi —
          tushgan buyurtmalar shu bo‘limda «QR buyurtmalar»da ko‘rinadi.
        </p>
      </div>

      <div className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full" style={iosGlassBarStyle(isDark)}>
        <button
          type="button"
          onClick={() => void downloadPoster()}
          disabled={downloading || !orderToken}
          className="w-full py-3.5 rounded-2xl font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
        >
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {downloading ? 'Yuklanmoqda…' : 'QR yuklab olish (10×7 sm)'}
        </button>
      </div>
    </div>
  );
}
