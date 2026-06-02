import { useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChefHat,
  Globe,
  Layers,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react';
import { ReklamaScene3D } from '../components/reklama/ReklamaScene3D';
import { ReklamaHeader } from '../components/reklama/ReklamaHeader';
import { ReklamaScreenMock } from '../components/reklama/ReklamaScreenMock';
import {
  HAMKOR_ROLLAR,
  JARAYON_QADAMLAR,
  MIJOZ_IMKONLAR,
  SAVOLLAR,
} from '../data/reklamaContent';
import { siteSupportEmail } from '../config/site';
import '../reklama-presentation.css';

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

const VERTICALS = [
  {
    title: 'Market',
    desc: 'Filial mahsulotlari, katalog, savat, yetkazish zonasi va to‘lov.',
    color: '#2dd4bf',
  },
  {
    title: "Do'kon",
    desc: 'Sellerlar va onlayn do‘konlar — alohida vitrina.',
    color: '#38bdf8',
  },
  {
    title: 'Taomlar',
    desc: 'Restoran menyusi, tayyorlovchi, kuryer — to‘liq zanjir.',
    color: '#fb923c',
  },
  {
    title: 'Ijara va boshqalar',
    desc: 'Ijara, xizmatlar, auksion, jamiyat — Menu bo‘limlarida.',
    color: '#a78bfa',
  },
];

const SELLER_STEPS = [
  {
    n: '01',
    title: 'Ro‘yxatdan o‘ting',
    text: 'seller.aresso.app yoki /seller — telefon orqali kirish. Shaxsiy seller panel ochiladi.',
  },
  {
    n: '02',
    title: 'Mahsulot yuklang',
    text: 'Rasm, narx, zaxira. Market va do‘kon bo‘limlarida avtomatik ko‘rinadi.',
  },
  {
    n: '03',
    title: 'Buyurtmalarni boshqaring',
    text: 'Yangi buyurtma bildirishnoma, holat yangilash, mijoz bilan aloqa.',
  },
];

const TAOM_STEPS = [
  {
    n: '01',
    title: 'Restoran paneli',
    text: '/restaurant — menyu tahriri, narx, buyurtmalar ro‘yxati.',
  },
  {
    n: '02',
    title: 'Tayyorlovchi ekrani',
    text: 'Oshxonada katta ekranda navbat — qaysi taom tayyorlanishi kerak.',
  },
  {
    n: '03',
    title: 'Yetkazish',
    text: 'Kuryer buyurtmani oladi, mijoz profilda “yo‘lda” ko‘radi.',
  },
];

export default function ReklamaPresentationPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Aresso — To‘liq taqdimot va tushuntirish';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="reklama-root">
      <div className="reklama-mesh" aria-hidden />
      <div className="reklama-grid-floor" aria-hidden />

      <ReklamaHeader />

      {/* Hero */}
      <section id="tanishuv" className="reklama-section-anchor relative max-w-6xl mx-auto px-4 pt-10 pb-16 md:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp}>
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              To‘liq ma’lumot — rasmlar va tushuntirishlar bilan
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.08] text-white">
              Aresso platformasini{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #5eead4, #2dd4bf)' }}
              >
                tushunarli qilib
              </span>{' '}
              tanishtiramiz
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
              Mijozlar uchun: qayerdan xarid qilish, qanday support olish. Seller va restoranlar uchun:
              qanday ulanish, qanday panel ishlatish. Pastda har bir rol uchun matn va ekran ko‘rinishidagi
              rasmlar.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Bitta ilova — market, do‘kon, taom, profil',
                'Real vaqt buyurtma va chat',
                'Seller va taom integratsiyasi tayyor',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {line}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <ReklamaScene3D />
            <p className="text-center text-xs text-slate-500 mt-4">3D ko‘rinish — haqiqiy ilova interfeysi</p>
          </motion.div>
        </div>
      </section>

      {/* Rollar + rasmlar */}
      <section className="relative max-w-6xl mx-auto px-4 py-12">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Kimlar platformadan foydalanadi?</h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl mx-auto">
            Har bir rol uchun alohida kirish va panel. Quyida brend rasmlari va qisqa tushuntirish.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HAMKOR_ROLLAR.map((r, i) => (
            <motion.div
              key={r.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              className="reklama-role-card"
            >
              <img src={r.image} alt={r.title} loading="lazy" />
              <div className="p-4">
                <h3 className="font-bold text-white text-sm">{r.title}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{r.desc}</p>
                {r.link ? (
                  <Link to={r.link} className="inline-block mt-3 text-xs font-semibold text-emerald-400">
                    {r.linkLabel} →
                  </Link>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Platform vertikallar */}
      <section className="relative max-w-6xl mx-auto px-4 py-16">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Platforma bo‘limlari</h2>
          <p className="mt-2 text-slate-400 text-sm">Mijoz bitta ilovada hammasiga kiradi</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 gap-4">
          {VERTICALS.map((v, i) => (
            <motion.div
              key={v.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.05 }}
              className="reklama-glass-card p-6 flex gap-4"
            >
              <div
                className="w-1 rounded-full shrink-0"
                style={{ background: v.color }}
              />
              <div>
                <h3 className="font-bold text-lg text-white">{v.title}</h3>
                <p className="text-sm text-slate-400 mt-2">{v.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div {...fadeUp} className="mt-8 max-w-2xl mx-auto">
          <ReklamaScreenMock variant="market" large />
          <p className="text-center text-xs text-slate-500 mt-3">Mijoz ilovasi — Market bo‘limi (ekran ko‘rinishi)</p>
        </motion.div>
      </section>

      {/* Mijozlar */}
      <section id="mijoz" className="reklama-section-anchor relative max-w-6xl mx-auto px-4 py-16 md:py-20">
        <motion.div {...fadeUp} className="mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Foydalanuvchilar</span>
          <h2 className="text-3xl font-bold text-white mt-2">Oddiy mijoz nima qila oladi?</h2>
          <p className="text-slate-400 mt-3 max-w-3xl leading-relaxed">
            Telefonda aresso.app ni ochasiz, SMS bilan kirasiz. Quyidagi imkoniyatlar tayyor — qo‘shimcha
            dastur o‘rnatish shart emas (PWA ham ishlaydi).
          </p>
        </motion.div>

        <div className="space-y-16">
          {MIJOZ_IMKONLAR.map((item, i) => {
            const Icon = item.icon;
            const reverse = i % 2 === 1;
            return (
              <motion.div
                key={item.title}
                {...fadeUp}
                className={`reklama-mijoz-row ${reverse ? 'reverse' : ''}`}
              >
                <div>
                  <div className="inline-flex items-center gap-2 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(45,212,191,0.12)' }}
                    >
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{item.text}</p>
                </div>
                <ReklamaScreenMock variant={item.mock} large />
              </motion.div>
            );
          })}
        </div>

        <motion.div {...fadeUp} className="mt-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-slate-900"
            style={{ background: 'linear-gradient(135deg, #5eead4, #14b8a6)' }}
          >
            Mijoz ilovasini sinab ko‘ring
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Seller */}
      <section id="seller" className="reklama-section-anchor relative max-w-6xl mx-auto px-4 py-16">
        <motion.div {...fadeUp} className="reklama-glass-card p-8 md:p-10">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <span className="text-xs font-bold uppercase text-sky-400">Hamkorlik</span>
              <h2 className="text-3xl font-bold text-white mt-2">Seller integratsiyasi</h2>
              <p className="text-slate-400 mt-4 leading-relaxed">
                O‘z do‘koningiz yoki mahsulotlaringizni Aresso market va do‘kon bo‘limiga chiqaring. Panelda
                buyurtmalar real vaqtda keladi — telefon orqali ham kuzatish mumkin.
              </p>
              <div className="mt-6 space-y-4">
                {SELLER_STEPS.map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <span className="text-xl font-black text-sky-500/50">{s.n}</span>
                    <div>
                      <h4 className="font-bold text-white">{s.title}</h4>
                      <p className="text-sm text-slate-400 mt-1">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/seller" className="inline-flex items-center gap-2 mt-8 text-sky-300 font-semibold">
                Seller paneliga o‘tish <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              <ReklamaScreenMock variant="seller" large />
              <p className="text-xs text-slate-500 mt-3 text-center">Seller panel — buyurtmalar ekrani</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Taom */}
      <section id="taom" className="reklama-section-anchor relative max-w-6xl mx-auto px-4 py-16">
        <motion.div {...fadeUp} className="reklama-glass-card p-8 md:p-10">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="order-2 lg:order-1">
              <ReklamaScreenMock variant="restaurant" large />
              <div className="mt-4 flex justify-center">
                <img
                  src="/branding/aresso-tayyorlovchi.png"
                  alt="Tayyorlovchi panel"
                  className="h-16 object-contain opacity-90"
                  loading="lazy"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">Restoran + tayyorlovchi zanjiri</p>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-xs font-bold uppercase text-orange-400">Taom</span>
              <h2 className="text-3xl font-bold text-white mt-2">Restoran va oshxona</h2>
              <p className="text-slate-400 mt-4 leading-relaxed">
                Mijoz «Taomlar» bo‘limidan buyurtma beradi. Siz restoran panelida ko‘rasiz, tayyorlovchi
                oshxonada tayyorlaydi, kuryer yetkazadi — hammasi bir tizimda.
              </p>
              <div className="mt-6 space-y-4">
                {TAOM_STEPS.map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <span className="text-xl font-black text-orange-500/50">{s.n}</span>
                    <div>
                      <h4 className="font-bold text-white">{s.title}</h4>
                      <p className="text-sm text-slate-400 mt-1">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/restaurant" className="inline-flex items-center gap-2 mt-8 text-orange-300 font-semibold">
                Restoran paneli <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Jarayon */}
      <section id="jarayon" className="reklama-section-anchor relative max-w-6xl mx-auto px-4 py-16">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Buyurtma qanday ishlaydi?</h2>
          <p className="text-slate-400 mt-2 text-sm">Mijozdan supportgacha — to‘liq zanjir</p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {JARAYON_QADAMLAR.map((step) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.title} {...fadeUp} className="reklama-jarayon-step pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white">{step.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
          <motion.div {...fadeUp}>
            <ReklamaScreenMock variant="support" large />
            <p className="text-xs text-slate-500 mt-3 text-center">Support chat — mijoz va platforma o‘rtasida</p>
          </motion.div>
        </div>
      </section>

      {/* Texnik */}
      <section className="relative max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Globe, title: 'aresso.app', text: 'Ishlab chiqarishda. Veb + PWA.' },
            { icon: Layers, title: 'Panellar', text: 'Seller, restoran, filial, kuryer, support.' },
            { icon: Zap, title: 'Real vaqt', text: 'Buyurtma va chat fon yangilanishi.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.title} {...fadeUp} className="reklama-glass-card p-6 text-center">
                <Icon className="w-8 h-8 mx-auto text-emerald-400 mb-3" />
                <h3 className="font-bold text-white">{item.title}</h3>
                <p className="text-sm text-slate-400 mt-2">{item.text}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section id="savollar" className="reklama-section-anchor relative max-w-6xl mx-auto px-4 py-16 pb-8">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-10">Tez-tez so‘raladigan savollar</h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {SAVOLLAR.map((item) => (
              <details
                key={item.q}
                className="reklama-glass-card group p-5 cursor-pointer"
              >
                <summary className="font-semibold text-white list-none flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-emerald-400 text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-slate-400 mt-4 leading-relaxed border-t border-white/10 pt-4">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative max-w-6xl mx-auto px-4 pb-24 pt-8 text-center">
        <motion.div {...fadeUp}>
          <Building2 className="w-10 h-10 mx-auto text-emerald-400 mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold text-white">Hamkorlikni boshlaymizmi?</h2>
          <p className="text-slate-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
            Seller yoki restoran sifatida qo‘shilish, yoki mijoz sifatida sinash — ikkalasi ham bepul
            tanishtirish maqsadida. Savollar uchun support.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="px-6 py-3 rounded-2xl font-bold text-slate-900"
              style={{ background: 'linear-gradient(135deg, #5eead4, #14b8a6)' }}
            >
              Ilovani ochish
            </Link>
            <Link
              to="/seller"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white border border-sky-500/30 bg-sky-500/10"
            >
              <Store className="w-4 h-4" />
              Seller
            </Link>
            <Link
              to="/restaurant"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white border border-orange-500/30 bg-orange-500/10"
            >
              <ChefHat className="w-4 h-4" />
              Restoran
            </Link>
            <a
              href={`mailto:${siteSupportEmail}?subject=Aresso%20savol`}
              className="px-6 py-3 rounded-2xl font-bold text-emerald-300 border border-emerald-500/30"
            >
              {siteSupportEmail}
            </a>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500 px-4">
        © {new Date().getFullYear()} Aresso · To‘liq taqdimot ·{' '}
        <Link to="/" className="text-emerald-500/80 hover:text-emerald-400">
          aresso.app
        </Link>
      </footer>
    </div>
  );
}
