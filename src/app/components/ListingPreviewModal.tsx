import { X, Pencil, MapPin } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ListingPreviewModalProps {
  listing: Record<string, unknown> | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

function formatPrice(price: unknown, currency: unknown) {
  const n = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(n)) return '—';
  const cur = String(currency || 'UZS');
  try {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: cur === 'USD' ? 'USD' : 'UZS', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}

export function ListingPreviewModal({ listing, isOpen, onClose, onEdit }: ListingPreviewModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen || !listing) return null;

  const title = String(listing.title || 'E’lon');
  const description = String(listing.description || '');
  const images = Array.isArray(listing.images) ? (listing.images as string[]) : [];
  const address = String(listing.address || '');
  const type = String(listing.type || '');

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Yopish"
        onClick={onClose}
      />
      <div
        className={`relative w-full sm:max-w-lg max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col ${
          isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-border'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/60 dark:border-white/10 shrink-0">
          <h2 className="text-lg font-bold pr-8 line-clamp-2 text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-black/5 hover:bg-black/10'}`}
            aria-label="Yopish"
          >
            <X className="size-5 text-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {images[0] ? (
            <div className="aspect-video w-full bg-muted">
              <img src={images[0]} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <div className="p-4 space-y-3">
            <p className="text-xl font-bold" style={{ color: accentColor.color }}>
              {formatPrice(listing.price, listing.currency)}
            </p>
            {address ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0 mt-0.5" />
                {address}
              </p>
            ) : null}
            {type ? (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tur: {type === 'house' ? 'Uy-joy' : 'Avto'}</p>
            ) : null}
            {description ? <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{description}</p> : null}
          </div>
        </div>

        <div
          className={`p-4 flex gap-3 border-t shrink-0 ${isDark ? 'border-white/10 bg-black/20' : 'border-border bg-muted/30'}`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 rounded-2xl font-semibold ${isDark ? 'bg-white/10 text-white' : 'bg-muted text-foreground'}`}
          >
            Yopish
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="flex-1 py-3 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
              style={{ backgroundImage: accentColor.gradient }}
            >
              <Pencil className="size-4" />
              Tahrirlash
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
