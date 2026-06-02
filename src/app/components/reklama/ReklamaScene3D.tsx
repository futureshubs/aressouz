import { Store, UtensilsCrossed, ShoppingBag, MessageCircle, Truck } from 'lucide-react';
import { aressoMainLogoSrc } from '../../utils/aressoBrandAssets';

const SCREEN_TABS = [
  { id: 'market', label: 'Market', color: '#2dd4bf' },
  { id: 'dokon', label: "Do'kon", color: '#38bdf8' },
  { id: 'taom', label: 'Taomlar', color: '#fb923c' },
];

export function ReklamaScene3D() {
  return (
    <div className="reklama-scene relative mx-auto w-full max-w-lg h-[min(520px,70vh)] flex items-center justify-center">
      <div className="reklama-orbit-card reklama-orbit-1">
        <Store className="w-6 h-6 mb-2" style={{ color: '#38bdf8' }} />
        <p className="text-xs font-bold text-white">Seller panel</p>
        <p className="text-[10px] text-slate-400 mt-1">Mahsulot · buyurtma</p>
      </div>

      <div className="reklama-orbit-card reklama-orbit-2">
        <UtensilsCrossed className="w-6 h-6 mb-2" style={{ color: '#fb923c' }} />
        <p className="text-xs font-bold text-white">Taom panel</p>
        <p className="text-[10px] text-slate-400 mt-1">Restoran · tayyorlovchi</p>
      </div>

      <div className="reklama-orbit-card reklama-orbit-3">
        <MessageCircle className="w-6 h-6 mb-2" style={{ color: '#2dd4bf' }} />
        <p className="text-xs font-bold text-white">Support chat</p>
        <p className="text-[10px] text-slate-400 mt-1">Mijoz ↔ platforma</p>
      </div>

      <div className="reklama-phone-wrap relative">
        <div className="reklama-phone">
          <div className="reklama-phone-screen flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <img
                src={aressoMainLogoSrc(true)}
                alt="Aresso"
                className="h-6 w-auto object-contain"
              />
              <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
            </div>

            <div className="flex gap-1.5 mb-4">
              {SCREEN_TABS.map((t) => (
                <span
                  key={t.id}
                  className="flex-1 text-center py-1.5 rounded-lg text-[9px] font-bold"
                  style={{
                    background: t.id === 'market' ? `${t.color}33` : 'rgba(255,255,255,0.05)',
                    color: t.id === 'market' ? t.color : '#94a3b8',
                  }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            <div className="space-y-2 flex-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex gap-2 p-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${i === 1 ? '#2dd4bf' : i === 2 ? '#38bdf8' : '#fb923c'}44, transparent)`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="h-2 w-3/4 rounded bg-white/10 mb-1.5" />
                    <div className="h-1.5 w-1/2 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-3 flex items-center justify-between px-3 py-2 rounded-2xl text-[10px]"
              style={{ background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.25)' }}
            >
              <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <Truck className="w-3.5 h-3.5" />
                Buyurtma yo‘lda
              </span>
              <ShoppingBag className="w-4 h-4 text-emerald-400/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
