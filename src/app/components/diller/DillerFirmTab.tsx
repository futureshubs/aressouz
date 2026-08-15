import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { LogOut, Moon, Palette, Pencil, Save, Smartphone, Sun, UserRound, X } from 'lucide-react';
import { accentColors, useTheme, type ThemePreference } from '../../context/ThemeContext';
import type { DillerData } from '../../utils/dillerData';
import { updateDillerProfile } from '../../utils/dillerData';
import { clearDillerSession } from '../../utils/dillerSession';
import { clearDillerCloudCreds } from '../../utils/dillerSyncMeta';
import { dillerSheetScrollClass, dillerSheetShellClass, dillerTabContentClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageStyle,
} from './dillerIosGlass';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

function Card({ children, isDark, className = '' }: { children: ReactNode; isDark: boolean; className?: string }) {
  return (
    <div className={`rounded-[22px] p-4 ${className}`.trim()} style={iosGlassCardStyle(isDark)}>
      {children}
    </div>
  );
}

const inputCls = (isDark: boolean) =>
  `w-full px-3.5 py-3 rounded-[14px] text-sm outline-none ${
    isDark ? 'text-white placeholder:text-white/35' : 'text-gray-900 placeholder:text-gray-400'
  }`;

const THEME_MODES: { id: ThemePreference; label: string; hint: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Kun', hint: 'Yorug‘', Icon: Sun },
  { id: 'dark', label: 'Tun', hint: 'Qorong‘i', Icon: Moon },
  { id: 'system', label: 'Avto', hint: 'Qurilma', Icon: Smartphone },
];

export function DillerProfilTab({ data, onDataChange }: Props) {
  const navigate = useNavigate();
  const { theme, themePreference, setThemePreference, accentColor, setAccentColor } = useTheme();
  const isDark = theme === 'dark';
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    companyName: data.profile.companyName || '',
    directorName: data.profile.directorName || '',
    phone: data.profile.phone || '',
    region: data.profile.region || '',
    note: data.profile.note || '',
    orderPhone: data.profile.orderPhone || '',
    telegram: data.profile.telegram || '',
    instagram: data.profile.instagram || '',
  });

  const saveProfile = () => {
    onDataChange(
      updateDillerProfile(data, {
        companyName: profileForm.companyName,
        directorName: profileForm.directorName,
        phone: profileForm.phone,
        region: profileForm.region,
        note: profileForm.note,
        orderPhone: profileForm.orderPhone,
        telegram: profileForm.telegram,
        instagram: profileForm.instagram,
      }),
    );
    toast.success('Profil saqlandi');
    setProfileOpen(false);
  };

  const logout = () => {
    clearDillerCloudCreds();
    clearDillerSession();
    toast.success('Chiqildi');
    navigate('/diller', { replace: true });
  };

  const field = (label: string, input: ReactNode) => (
    <label className="block">
      <span className="block text-[11px] font-semibold opacity-55 mb-1.5">{label}</span>
      {input}
    </label>
  );

  const companyName = profileForm.companyName.trim() || 'Diller profili';
  const companySub = profileForm.directorName.trim() || profileForm.phone.trim() || 'Kompaniyani tahrirlash';

  return (
    <div className={dillerTabContentClass}>
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="relative w-full overflow-hidden rounded-[22px] p-4 text-left active:scale-[0.99]"
        style={iosGlassCardStyle(isDark)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0"
            style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
          >
            <UserRound className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-[18px] tracking-tight truncate">{companyName}</h2>
            <p className="text-[12px] opacity-55 truncate">{companySub}</p>
          </div>
          <Pencil className="w-4 h-4 opacity-35 shrink-0" />
        </div>
      </button>

      <Card isDark={isDark}>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-5 h-5" style={{ color: accentColor.color }} />
          <div>
            <h3 className="font-black text-[15px] tracking-tight">Ko‘rinish</h3>
            <p className="text-[11px] opacity-50">Kun, tun va rang</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {THEME_MODES.map((m) => {
            const on = themePreference === m.id;
            const Icon = m.Icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setThemePreference(m.id)}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-[16px] active:scale-[0.97]"
                style={on ? iosAccentFillStyle(accentColor.gradient, accentColor.color) : iosGlassInputStyle(isDark)}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[12px] font-black">{m.label}</span>
                <span className={`text-[10px] ${on ? 'opacity-70' : 'opacity-45'}`}>{m.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold opacity-55 mb-2">Rang</div>
          <div className="grid grid-cols-6 gap-2">
            {accentColors.map((c) => {
              const on = accentColor.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAccentColor(c.id)}
                  className="aspect-square rounded-full active:scale-90"
                  style={{
                    background: c.gradient,
                    boxShadow: on ? `0 0 0 3px ${isDark ? '#000' : '#fff'}, 0 0 0 5px ${c.color}` : 'none',
                  }}
                  aria-label={c.name}
                />
              );
            })}
          </div>
          <label className="mt-3 flex items-center gap-3 rounded-[16px] px-3 py-2.5" style={iosGlassInputStyle(isDark)}>
            <input
              type="color"
              value={accentColor.color}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-full border-0 bg-transparent p-0 cursor-pointer shrink-0"
              aria-label="Istalgan rang"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold">Istalgan rang</span>
              <span className="block text-[11px] opacity-50 font-mono">{accentColor.color}</span>
            </span>
          </label>
        </div>
      </Card>

      <button
        type="button"
        onClick={logout}
        className="w-full py-3.5 rounded-[16px] font-bold text-red-400 flex items-center justify-center gap-2 active:scale-[0.98]"
        style={{
          background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
          border: '0.5px solid rgba(239,68,68,0.28)',
        }}
      >
        <LogOut className="w-4 h-4" />
        Chiqish
      </button>

      {profileOpen ? (
        <div
          className={`${dillerSheetShellClass} animate-in fade-in slide-in-from-bottom-4 duration-200`}
          style={{ ...iosGlassPageStyle(isDark), zIndex: 115 }}
        >
          <header className="shrink-0 px-4 pt-2 pb-3" style={{ ...iosGlassBarStyle(isDark), borderTop: 'none' }}>
            <div className="flex justify-center pb-2">
              <span className="w-10 h-1 rounded-full bg-white/25" />
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
              >
                <UserRound className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-[16px] truncate">Kompaniya</h2>
                <p className="text-[11px] opacity-50">Chek va QR buyurtmada</p>
              </div>
              <button type="button" onClick={() => setProfileOpen(false)} className="p-2 rounded-xl" aria-label="Yopish">
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>
          <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-2.5 max-w-lg mx-auto w-full`}>
            {field(
              'Kompaniya nomi',
              <input
                placeholder="Masalan: Aresso"
                value={profileForm.companyName}
                onChange={(e) => setProfileForm((f) => ({ ...f, companyName: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Direktor / mas‘ul',
              <input
                placeholder="Ism familiya"
                value={profileForm.directorName}
                onChange={(e) => setProfileForm((f) => ({ ...f, directorName: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Telefon',
              <input
                type="tel"
                placeholder="+998..."
                value={profileForm.phone}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Viloyat / hudud',
              <input
                placeholder="Andijon..."
                value={profileForm.region}
                onChange={(e) => setProfileForm((f) => ({ ...f, region: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Buyurtma telefoni (QR)',
              <input
                type="tel"
                placeholder="+998..."
                value={profileForm.orderPhone}
                onChange={(e) => setProfileForm((f) => ({ ...f, orderPhone: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Telegram',
              <input
                placeholder="@username"
                value={profileForm.telegram}
                onChange={(e) => setProfileForm((f) => ({ ...f, telegram: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Instagram',
              <input
                placeholder="@username"
                value={profileForm.instagram}
                onChange={(e) => setProfileForm((f) => ({ ...f, instagram: e.target.value }))}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />,
            )}
            {field(
              'Izoh / manzil',
              <textarea
                placeholder="Qisqa manzil"
                value={profileForm.note}
                onChange={(e) => setProfileForm((f) => ({ ...f, note: e.target.value }))}
                className={`${inputCls(isDark)} min-h-[72px] resize-none`}
                style={iosGlassInputStyle(isDark)}
                rows={2}
              />,
            )}
            <div className="h-4" />
          </div>
          <div className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full" style={{ ...iosGlassBarStyle(isDark), borderBottom: 'none' }}>
            <button
              type="button"
              onClick={saveProfile}
              className="w-full py-3.5 rounded-[16px] font-bold flex items-center justify-center gap-2 text-white active:scale-[0.98]"
              style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
            >
              <Save className="w-4 h-4" />
              Saqlash
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
