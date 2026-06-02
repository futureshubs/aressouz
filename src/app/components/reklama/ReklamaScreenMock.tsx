import type { ReklamaMockVariant } from '../../data/reklamaContent';
import { aressoMainLogoSrc } from '../../utils/aressoBrandAssets';

const VARIANTS: Record<
  ReklamaMockVariant,
  { label: string; accent: string; tabs: string[]; rows: string[]; footer?: string }
> = {
  market: {
    label: 'Market',
    accent: '#2dd4bf',
    tabs: ['Market', "Do'kon", 'Taomlar'],
    rows: ['Mahsulot kartochkasi', 'Savatga qo‘shish', 'Yetkazish manzili'],
    footer: 'Buyurtma: tayyorlanmoqda',
  },
  seller: {
    label: 'Seller panel',
    accent: '#38bdf8',
    tabs: ['Mahsulotlar', 'Buyurtmalar', 'Statistika'],
    rows: ['Yangi buyurtma #1247', 'Mahsulot tahriri', 'To‘lov: tasdiqlangan'],
    footer: '3 ta yangi buyurtma',
  },
  restaurant: {
    label: 'Restoran',
    accent: '#fb923c',
    tabs: ['Menyu', 'Buyurtmalar', 'Tayyorlovchi'],
    rows: ['Lag‘mon ×2', 'Tayyorlanmoqda', 'Kuryerga topshirish'],
    footer: 'Navbat: 4 ta buyurtma',
  },
  support: {
    label: 'Support chat',
    accent: '#2dd4bf',
    tabs: ['Chat'],
    rows: ['Mijoz: Salom, yordam kerak', 'Support: Qanday yordam?', 'Mijoz: 📷 Rasm'],
    footer: 'Platforma support',
  },
  profile: {
    label: 'Profil',
    accent: '#a78bfa',
    tabs: ['Buyurtmalar', 'Chat', 'Sozlamalar'],
    rows: ['Market buyurtma — yetkazildi', 'Taom buyurtma — yo‘lda', 'Chekni ko‘rish'],
    footer: '2 ta faol buyurtma',
  },
};

type Props = {
  variant: ReklamaMockVariant;
  className?: string;
  large?: boolean;
};

export function ReklamaScreenMock({ variant, className = '', large = false }: Props) {
  const v = VARIANTS[variant];
  const h = large ? 'min-h-[280px]' : 'min-h-[200px]';

  return (
    <div
      className={`reklama-mock-frame ${className}`}
      style={{
        boxShadow: `0 24px 48px rgba(0,0,0,0.45), 0 0 40px ${v.accent}22`,
      }}
    >
      <div className={`reklama-mock-screen flex flex-col p-4 ${h}`}>
        <div className="flex items-center justify-between mb-3">
          <img src={aressoMainLogoSrc(true)} alt="" className="h-5 w-auto opacity-90" />
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${v.accent}22`, color: v.accent }}
          >
            {v.label}
          </span>
        </div>
        <div className="flex gap-1 mb-3">
          {v.tabs.map((t, i) => (
            <span
              key={t}
              className="flex-1 text-center py-1 rounded-md text-[9px] font-semibold truncate"
              style={{
                background: i === 0 ? `${v.accent}28` : 'rgba(255,255,255,0.05)',
                color: i === 0 ? v.accent : '#64748b',
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex-1 space-y-2">
          {v.rows.map((row, i) => (
            <div
              key={row}
              className="flex items-center gap-2 p-2.5 rounded-xl text-[11px] text-slate-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderLeft: i === 0 ? `3px solid ${v.accent}` : '3px solid transparent',
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: i === 0 ? v.accent : '#475569' }}
              />
              {row}
            </div>
          ))}
        </div>
        {v.footer ? (
          <div
            className="mt-3 text-center text-[10px] font-semibold py-2 rounded-xl"
            style={{ background: `${v.accent}15`, color: v.accent }}
          >
            {v.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
