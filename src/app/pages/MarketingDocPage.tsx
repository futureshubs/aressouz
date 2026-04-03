import { useParams, Link, Navigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getMarketingDoc, isValidMarketingSlug } from '../data/marketingDocs';
import { siteSupportEmail } from '../config/site';

export default function MarketingDocPage() {
  const { slug } = useParams<{ slug: string }>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!slug || !isValidMarketingSlug(slug)) {
    return <Navigate to="/" replace />;
  }

  const doc = getMarketingDoc(slug);

  return (
    <div
      className={`min-h-screen ${isDark ? 'bg-background text-foreground' : 'bg-background text-foreground'}`}
    >
      <header
        className={`sticky top-0 z-10 border-b backdrop-blur-md ${
          isDark ? 'border-white/10 bg-black/40' : 'border-border bg-background/90'
        }`}
        style={{ paddingTop: 'var(--app-safe-top, 0px)' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:[color:var(--accent-color)] transition-colors"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Bosh sahifa
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 pb-16">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{doc.title}</h1>
        {doc.updated && (
          <p className="text-xs text-muted-foreground mt-2">Oxirgi yangilanish: {doc.updated}</p>
        )}
        {doc.intro && <p className="mt-6 text-sm sm:text-base text-muted-foreground leading-relaxed">{doc.intro}</p>}

        <div className="mt-10 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-foreground mb-3">{section.heading}</h2>
              <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {section.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div
          className={`mt-12 pt-8 border-t ${isDark ? 'border-white/10' : 'border-border'}`}
        >
          <p className="text-sm text-muted-foreground">
            Savollar bo‘yicha:{' '}
            <a
              href={`mailto:${siteSupportEmail}`}
              className="font-medium transition-colors hover:[color:var(--accent-color)]"
            >
              {siteSupportEmail}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
