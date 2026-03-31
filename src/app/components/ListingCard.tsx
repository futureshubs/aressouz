import React from 'react';
import { Home, Car, Heart, Edit, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ListingCardProps {
  listing: any;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean; // Show edit/delete buttons only in profile
}

export function ListingCard({ listing, onClick, onEdit, onDelete, showActions = false }: ListingCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="overflow-hidden rounded-2xl transition-all active:scale-[0.97] cursor-pointer relative w-full"
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.6)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Image */}
      <div 
        onClick={onClick}
        className="relative w-full aspect-square overflow-hidden"
        style={{ background: isDark ? '#2a2a2a' : '#f5f5f5' }}
      >
        {listing.images && listing.images.length > 0 ? (
          <img 
            src={listing.images[0]} 
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {listing.type === 'house' ? (
              <Home className="size-12" strokeWidth={1.5} style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }} />
            ) : (
              <Car className="size-12" strokeWidth={1.5} style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }} />
            )}
          </div>
        )}
        
        {/* Category Badge - Top Left */}
        <div 
          className="absolute top-3 left-3 px-3 py-1.5 rounded-lg font-bold text-xs"
          style={{
            background: accentColor.color,
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* House Categories */}
          {listing.categoryId === 'apartment' ? 'Kvartira' :
           listing.categoryId === 'house' ? 'Uy' :
           listing.categoryId === 'villa' ? 'Villa' :
           listing.categoryId === 'penthouse' ? 'Pentxaus' :
           listing.categoryId === 'townhouse' ? 'Taurnxaus' :
           /* Car Categories */
           listing.categoryId === 'sedan' ? 'Sedan' :
           listing.categoryId === 'hatchback' ? 'Hatchback' :
           listing.categoryId === 'suv' ? 'SUV' :
           listing.categoryId === 'crossover' ? 'Crossover' :
           listing.categoryId === 'coupe' ? 'Coupe' :
           listing.categoryId === 'luxury' ? 'Hashamatli' :
           listing.categoryId === 'sport' ? 'Sport' :
           listing.categoryId === 'electric' ? 'Elektr' :
           listing.categoryId === 'hybrid' ? 'Gibrid' :
           listing.categoryId === 'minivan' ? 'Minivan' :
           listing.categoryId === 'pickup' ? 'Pickup' :
           listing.categoryId === 'van' ? 'Van' :
           listing.categoryId === 'convertible' ? 'Kabriolet' :
           listing.categoryId === 'wagon' ? 'Wagon' :
           listing.type === 'house' ? 'Uy' : 'Moshina'}
        </div>

        {/* Actions: Show either Edit/Delete OR Heart based on showActions prop */}
        {showActions ? (
          // Edit/Delete Buttons - Profile view only
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Edit className="size-4 text-white" strokeWidth={2} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Trash2 className="size-4 text-white" strokeWidth={2} />
            </button>
          </div>
        ) : (
          // Heart Icon - Public view
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add to favorites
            }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <Heart className="size-4 text-white" strokeWidth={2} fill="rgba(255, 255, 255, 0.3)" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5">
        {/* Title */}
        <h3 
          className="text-sm font-bold mb-2 line-clamp-2 leading-snug" 
          style={{ color: isDark ? '#ffffff' : '#111827', minHeight: '2.5rem' }}
        >
          {listing.title}
        </h3>

        {/* Location */}
        <div className="flex items-start gap-1.5 mb-3">
          <svg className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs line-clamp-1 leading-tight" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {listing.district && listing.region ? `${listing.district}, ${listing.region}` : listing.region || listing.district || listing.address || 'Manzil'}
          </p>
        </div>

        {/* Details - Icons Row */}
        {listing.type === 'house' && (
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

        {listing.type === 'car' && (
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

        {/* Price */}
        <div>
          <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Narx</p>
          <p className="text-lg font-bold" style={{ color: accentColor.color }}>
            {listing.price ? `${listing.price.toLocaleString()} ` : 'Kelishiladi '}
            <span className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
              {listing.price && 'USD'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}