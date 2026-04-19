import React, { useMemo, useRef } from 'react';
import { Home, Car, Heart, Edit, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { firstListingImageUrl, listingCategoryShortLabel } from '../utils/listingDisplay';
import { CardImageScroll } from './CardImageScroll';
import { collectListingGalleryImages } from '../utils/cardGalleryImages';

interface ListingCardProps {
  listing: any;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean; // Show edit/delete buttons only in profile
  /** Profil ro‘yxati: ixcham kartochka */
  compact?: boolean;
  /** Katalog (Mening uy): yurakcha ko‘rinmasin — Ipoteka/Xalol badge uchun joy */
  hideFavorite?: boolean;
  /** Katalog: uy rasmi ustida Ipoteka / Xalol (profilda tahrir tugmalari bo‘lsa o‘chiriladi) */
  showHousePromoBadges?: boolean;
}

export function ListingCard({
  listing,
  onClick,
  onEdit,
  onDelete,
  showActions = false,
  compact = false,
  hideFavorite = false,
  showHousePromoBadges = false,
}: ListingCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const blockDetailOpenAfterGalleryScroll = useRef(false);

  const coverUrl = useMemo(() => firstListingImageUrl(listing), [
    listing?.id,
    listing?.image,
    Array.isArray(listing?.images) ? listing.images.join('\u001f') : '',
    Array.isArray(listing?.photos) ? listing.photos.join('\u001f') : '',
    Array.isArray(listing?.photoUrls) ? listing.photoUrls.join('\u001f') : '',
  ]);

  const categoryLabel = listingCategoryShortLabel(
    String(listing?.categoryId ?? ''),
    String(listing?.type ?? ''),
  );

  const galleryUrls = useMemo(
    () => collectListingGalleryImages(listing),
    [
      listing?.id,
      listing?.image,
      Array.isArray(listing?.images) ? listing.images.join('\u001f') : '',
      Array.isArray(listing?.photos) ? listing.photos.join('\u001f') : '',
      Array.isArray(listing?.photoUrls) ? listing.photoUrls.join('\u001f') : '',
    ],
  );

  const promoHouse =
    compact &&
    showHousePromoBadges &&
    !showActions &&
    String(listing?.type) === 'house';

  return (
    <div
      className={`overflow-hidden transition-all active:scale-[0.97] cursor-pointer relative w-full ${
        compact ? 'rounded-xl' : 'rounded-2xl'
      }`}
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: compact
          ? isDark
            ? '0 2px 12px rgba(0, 0, 0, 0.45)'
            : '0 2px 8px rgba(0, 0, 0, 0.08)'
          : isDark
            ? '0 4px 20px rgba(0, 0, 0, 0.6)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Image */}
      <div 
        onClick={() => {
          if (blockDetailOpenAfterGalleryScroll.current) return;
          onClick?.();
        }}
        className={`relative w-full overflow-hidden ${compact ? 'aspect-[4/3]' : 'aspect-square'}`}
        style={{ background: isDark ? '#2a2a2a' : '#f5f5f5' }}
      >
        {galleryUrls.length > 1 ? (
          <CardImageScroll
            images={galleryUrls}
            alt={listing.title}
            dotColor={accentColor.color}
            onUserInteracted={() => {
              blockDetailOpenAfterGalleryScroll.current = true;
              window.setTimeout(() => {
                blockDetailOpenAfterGalleryScroll.current = false;
              }, 450);
            }}
            imgClassName="h-full w-full object-cover"
          />
        ) : coverUrl ? (
          <img
            key={`${listing?.id ?? 'x'}-${coverUrl}`}
            src={coverUrl}
            alt={listing.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {listing.type === 'house' ? (
              <Home
                className={compact ? 'size-8' : 'size-12'}
                strokeWidth={1.5}
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              />
            ) : (
              <Car
                className={compact ? 'size-8' : 'size-12'}
                strokeWidth={1.5}
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              />
            )}
          </div>
        )}
        
        {/* Category Badge - Top Left */}
        <div 
          className={`absolute font-bold rounded-md ${
            compact ? 'top-1.5 left-1.5 px-1.5 py-0.5 text-[10px]' : 'top-3 left-3 px-3 py-1.5 rounded-lg text-xs'
          }`}
          style={{
            background: accentColor.color,
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {categoryLabel}
        </div>

        {promoHouse && listing.hasHalalInstallment && (
          <div
            className="absolute right-1.5 top-1.5 max-w-[calc(100%-3.5rem)] truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              background: accentColor.color,
              color: '#ffffff',
              boxShadow: `0 2px 6px ${accentColor.color}50`,
            }}
          >
            Xalol
          </div>
        )}

        {promoHouse && listing.mortgageAvailable && (
          <div
            className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              background: 'rgba(59, 130, 246, 0.95)',
              color: '#ffffff',
            }}
          >
            Ipoteka
          </div>
        )}

        {/* Actions: Show either Edit/Delete OR Heart based on showActions prop */}
        {showActions ? (
          // Edit/Delete Buttons - Profile view only
          <div className={`absolute flex ${compact ? 'top-1.5 right-1.5 gap-1' : 'top-3 right-3 gap-2'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className={`rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
                compact ? 'w-7 h-7' : 'w-9 h-9'
              }`}
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Edit className={`text-white ${compact ? 'size-3' : 'size-4'}`} strokeWidth={2} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className={`rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
                compact ? 'w-7 h-7' : 'w-9 h-9'
              }`}
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Trash2 className={`text-white ${compact ? 'size-3' : 'size-4'}`} strokeWidth={2} />
            </button>
          </div>
        ) : !hideFavorite ? (
          // Heart Icon - Public view
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add to favorites
            }}
            className={`absolute rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
              compact ? 'top-1.5 right-1.5 w-7 h-7' : 'top-3 right-3 w-9 h-9'
            }`}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <Heart className={`text-white ${compact ? 'size-3' : 'size-4'}`} strokeWidth={2} fill="rgba(255, 255, 255, 0.3)" />
          </button>
        ) : null}
      </div>

      {/* Content */}
      <div className={compact ? 'p-2' : 'p-3.5'}>
        {/* Title */}
        <h3 
          className={`font-bold line-clamp-2 leading-snug ${
            compact ? 'text-[11px] mb-1 min-h-0' : 'text-sm mb-2 min-h-[2.5rem]'
          }`}
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {listing.title}
        </h3>

        {/* Location */}
        <div className={`flex items-start gap-1 ${compact ? 'mb-1.5' : 'gap-1.5 mb-3'}`}>
          <svg className={`flex-shrink-0 mt-0.5 ${compact ? 'size-3' : 'size-3.5'}`} style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className={`line-clamp-1 leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`} style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {listing.district && listing.region ? `${listing.district}, ${listing.region}` : listing.region || listing.district || listing.address || 'Manzil'}
          </p>
        </div>

        {/* Details - Icons Row */}
        {listing.type === 'house' && !compact && (
          <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)' }}>
            {listing.rooms && (
              <div className="flex items-center gap-1.5">
                <svg className="size-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{listing.rooms}</span>
              </div>
            )}
            {listing.bathrooms && (
              <div className="flex items-center gap-1.5">
                <svg className="size-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{listing.bathrooms}</span>
              </div>
            )}
            {listing.area && (
              <div className="flex items-center gap-1.5">
                <svg className="size-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{listing.area} m²</span>
              </div>
            )}
          </div>
        )}

        {listing.type === 'car' && !compact && (
          <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)' }}>
            {listing.year && (
              <div className="flex items-center gap-1.5">
                <svg className="size-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{listing.year}</span>
              </div>
            )}
            {listing.mileage && (
              <div className="flex items-center gap-1.5">
                <svg className="size-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{listing.mileage.toLocaleString()} km</span>
              </div>
            )}
          </div>
        )}

        {compact && listing.type === 'house' && (listing.rooms || listing.area || listing.bathrooms) && (
          <p className="text-[10px] mb-1.5 line-clamp-1" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }}>
            {[
              listing.rooms != null ? `${listing.rooms} xona` : null,
              listing.bathrooms != null ? `${listing.bathrooms} hammom` : null,
              listing.area != null ? `${listing.area} m²` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {compact && listing.type === 'car' && listing.year && (
          <p className="text-[10px] mb-1.5" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }}>
            {listing.year}
            {listing.mileage != null ? ` · ${Number(listing.mileage).toLocaleString()} km` : ''}
          </p>
        )}

        {/* Price */}
        <div>
          {!compact && (
            <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
              Narx
            </p>
          )}
          <p className={`font-bold ${compact ? 'text-xs' : 'text-lg'}`} style={{ color: accentColor.color }}>
            {listing.price ? `${listing.price.toLocaleString()} ` : 'Kelishiladi '}
            <span className={`font-semibold ${compact ? 'text-[10px]' : 'text-xs'}`} style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
              {listing.price && (listing.currency === 'UZS' ? 'UZS' : 'USD')}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}