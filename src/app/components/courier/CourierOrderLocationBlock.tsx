import { useState } from 'react';
import { ChevronDown, MapPin, Navigation, Package, Store } from 'lucide-react';
import {
  getCourierCustomerDetailLines,
  getCourierCustomerShortLine,
  getCourierPickupDetailLines,
  getCourierPickupSummary,
  type CourierOrderLocationFields,
} from '../../utils/courierOrderLocations';

type Props = {
  order: CourierOrderLocationFields;
  isDark: boolean;
  accentColor: string;
  mutedTextColor: string;
  textColor: string;
  onOpenPickupMap?: () => void;
  onOpenCustomerMap?: () => void;
  compact?: boolean;
};

export function CourierOrderLocationBlock({
  order,
  isDark,
  accentColor,
  mutedTextColor,
  textColor,
  onOpenPickupMap,
  onOpenCustomerMap,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const pickup = getCourierPickupSummary(order);
  const pickupLines = getCourierPickupDetailLines(order);
  const customerLines = getCourierCustomerDetailLines(order);
  const customerShort = getCourierCustomerShortLine(order);

  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const surface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div
      className="rounded-xl border overflow-hidden mb-2"
      style={{ borderColor: border, background: surface }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-3 flex items-start gap-3 active:opacity-90 transition-opacity"
      >
        <div
          className="p-2 rounded-xl shrink-0"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          <Store className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              {pickup.badge}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-60" style={{ color: mutedTextColor }}>
              Olish joyi
            </span>
          </div>
          <p className="font-bold text-sm leading-snug truncate">{pickup.title}</p>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: mutedTextColor }}>
            {pickup.subtitle}
          </p>
          {!open && !compact ? (
            <p className="text-xs mt-1.5 flex items-start gap-1 line-clamp-1" style={{ color: mutedTextColor }}>
              <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
              <span>Mijozga: {customerShort}</span>
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`w-5 h-5 shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: mutedTextColor }}
        />
      </button>

      {open ? (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: border }}>
          <div className="pt-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: accentColor }}>
              <Package className="w-3.5 h-3.5" />
              Qayerdan olish
            </p>
            {pickupLines.length === 0 ? (
              <p className="text-xs" style={{ color: mutedTextColor }}>
                Olish manzili kiritilmagan
              </p>
            ) : (
              <ul className="space-y-1.5">
                {pickupLines.map((line) => (
                  <li key={line.label} className="text-xs">
                    <span className="font-semibold" style={{ color: textColor }}>
                      {line.label}:{' '}
                    </span>
                    <span className="break-words" style={{ color: mutedTextColor }}>
                      {line.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {onOpenPickupMap ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPickupMap();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: `${accentColor}14`, color: accentColor }}
              >
                <Navigation className="w-3.5 h-3.5" />
                Olish nuqtasiga yo‘l
              </button>
            ) : null}
          </div>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: border }}>
            <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#10b981' }}>
              <MapPin className="w-3.5 h-3.5" />
              Mijozga yetkazish
            </p>
            {customerLines.length === 0 ? (
              <p className="text-xs" style={{ color: mutedTextColor }}>
                Mijoz manzili kiritilmagan
              </p>
            ) : (
              <ul className="space-y-1.5">
                {customerLines.map((line) => (
                  <li key={line.label} className="text-xs">
                    <span className="font-semibold" style={{ color: textColor }}>
                      {line.label}:{' '}
                    </span>
                    <span className="break-words" style={{ color: mutedTextColor }}>
                      {line.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {onOpenCustomerMap ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCustomerMap();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
              >
                <MapPin className="w-3.5 h-3.5" />
                Mijoz manziliga yo‘l
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
