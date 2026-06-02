import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ChevronDown, Info, Menu, X } from 'lucide-react';
import { REKLAMA_NAV } from '../../data/reklamaContent';
import { aressoMainLogoSrc } from '../../utils/aressoBrandAssets';
import { siteSupportEmail } from '../../config/site';

export function ReklamaHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl"
      style={{ background: 'rgba(3,7,18,0.88)', paddingTop: 'var(--app-safe-top, 0px)' }}
    >
      {/* Asosiy navigatsiya */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 shrink-0 text-slate-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 hidden sm:block" />
            <img src={aressoMainLogoSrc(true)} alt="Aresso" className="h-7 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1 flex-wrap justify-center">
            {REKLAMA_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-white/10"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menyu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a
              href={`mailto:${siteSupportEmail}?subject=Aresso%20hamkorlik`}
              className="hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-bold text-slate-900"
              style={{ background: 'linear-gradient(135deg, #5eead4, #14b8a6)' }}
            >
              Hamkorlik
            </a>
          </div>
        </div>

        {menuOpen ? (
          <nav className="lg:hidden flex flex-wrap gap-2 pt-3 pb-1 border-t border-white/10 mt-3">
            {REKLAMA_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="px-3 py-2 rounded-lg text-sm text-slate-300 bg-white/5"
              >
                {item.label}
              </button>
            ))}
            <a
              href={`mailto:${siteSupportEmail}`}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-emerald-300"
            >
              {siteSupportEmail}
            </a>
          </nav>
        ) : null}
      </div>

      {/* To‘liq tushuntirish paneli */}
      <div className="border-t border-white/8 bg-emerald-500/5">
        <div className="max-w-6xl mx-auto px-4">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 py-3 text-left"
            onClick={() => setInfoOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Info className="w-4 h-4 shrink-0" />
              Bu sahifa kimlar uchun va nima haqida?
            </span>
            <ChevronDown
              className={`w-5 h-5 text-slate-500 transition-transform ${infoOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {infoOpen ? (
            <div className="pb-4 space-y-4 reklama-header-info">
              <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                <strong className="text-white">Aresso</strong> — O‘zbekistonda market, onlayn do‘kon, taom
                buyurtmasi, ijara va xizmatlarni birlashtirgan platforma. Bu yerda loyiha{' '}
                <strong className="text-emerald-300">pul so‘ramasdan</strong> tanishtiriladi: mijozlar nima
                qila olishini, seller va restoranlar qanday ulanishini, qanday foyda olishingiz mumkinligini
                to‘liq ko‘rasiz.
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    title: 'Oddiy foydalanuvchi',
                    text: 'Xarid, taom, profil, support chat — aresso.app',
                    href: '/',
                  },
                  {
                    title: 'Seller (sotuvchi)',
                    text: 'Mahsulot yuklash, buyurtma boshqaruvi — /seller',
                    href: '/seller',
                  },
                  {
                    title: 'Restoran / taom',
                    text: 'Menyu, oshxona navbati — /restaurant',
                    href: '/restaurant',
                  },
                  {
                    title: 'Platforma support',
                    text: 'Mijozlar bilan chat — /support',
                    href: '/support',
                  },
                  {
                    title: 'Diller panel',
                    text: 'Firma → do‘kon tarqatish — /diller',
                    href: '/diller',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="p-3 rounded-xl border border-white/10 bg-black/30"
                  >
                    <p className="text-xs font-bold text-white">{card.title}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{card.text}</p>
                    <Link
                      to={card.href}
                      className="inline-block mt-2 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Ochish →
                    </Link>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500">
                Pastga aylantiring: har bir bo‘limda matn, rasmlar (ekran ko‘rinishi) va qadamlar bor.
                Savollar bo‘limida tez javoblar.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
