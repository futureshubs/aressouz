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
import {
  DILLER_QR_POSTER_CM,
  downloadDillerQrPoster,
  renderDillerQrPosterDataUrl,
} from '../../utils/dillerQrPoster';
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
  const [posterSrc, setPosterSrc] = useState('');
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
      setPosterSrc('');
      return;
    }
    let cancelled = false;
    const brand = getDillerBrandLabel(data.profile.companyName);
    const timer = window.setTimeout(() => {
      void renderDillerQrPosterDataUrl({
        orderUrl,
        companyName: brand,
        phone: phone.trim() || data.profile.phone,
        telegram: telegram.trim(),
        instagram: instagram.trim(),
      }).then((src) => {
        if (!cancelled) setPosterSrc(src);
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, orderUrl, phone, telegram, instagram, data.profile.companyName, data.profile.phone]);

  if (!open) return null;

  const brand = getDillerBrandLabel(data.profile.companyName);
  const sizeLabel = `${DILLER_QR_POSTER_CM.w}×${DILLER_QR_POSTER_CM.h} sm`;

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
        filename: `karobka-sticker-${orderToken.slice(0, 8)}.png`,
      });
      toast.success(`Sticker yuklab olindi (${sizeLabel})`);
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
          <h2 className="text-lg font-black">Karobka sticker</h2>
          <p className="text-[11px] opacity-50">QR · telefon · Instagram · Telegram · {sizeLabel}</p>
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
        <div className="relative mx-auto w-full overflow-hidden rounded-[28px] px-4 pt-5 pb-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(152deg, #d7b07a 0%, #b58952 28%, #8a6236 62%, #5c3d22 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 3px, transparent 3px 11px)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)',
            }}
          />
          <div className="relative text-center mb-3">
            <div className="text-[10px] font-black tracking-[0.22em] uppercase text-white/70">
              Karobka · {sizeLabel}
            </div>
            <div className="text-[11px] font-semibold text-white/50 mt-0.5">
              Skaner → buyurtma bo‘limi
            </div>
          </div>
          <div className="relative px-1" style={{ perspective: 980 }}>
            <div
              className="overflow-hidden rounded-[16px]"
              style={{
                aspectRatio: `${DILLER_QR_POSTER_CM.w} / ${DILLER_QR_POSTER_CM.h}`,
                transform: 'rotateX(10deg) rotateY(-14deg) translateZ(18px)',
                transformStyle: 'preserve-3d',
                boxShadow:
                  '0 26px 40px rgba(40, 20, 8, 0.55), 0 8px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)',
                background: '#0b1c1a',
              }}
            >
              {posterSrc ? (
                <img src={posterSrc} alt="Karobka QR sticker" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <QrCode className="h-12 w-12 text-white/25" />
                </div>
              )}
            </div>
          </div>
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
            placeholder="Telefon raqam"
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
          {sizeLabel} sticker chiqarib karobkaga yopishtiring. QR skaner qilinsa do‘kon buyurtma berish
          sahifasiga o‘tadi — tushgan buyurtmalar «QR buyurtmalar»da ko‘rinadi.
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
          {downloading ? 'Yuklanmoqda…' : `Sticker yuklab olish (${sizeLabel})`}
        </button>
      </div>
    </div>
  );
}
