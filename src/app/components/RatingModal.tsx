import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, Star, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  orderId: string;
  onSuccess: () => void;
}

export function RatingModal({ isOpen, onClose, productId, productName, orderId, onSuccess }: RatingModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Iltimos, reytingni tanlang');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/rating`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId,
            orderId,
            rating,
            comment,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Reyting muvaffaqiyatli qo\'shildi!');
        onSuccess();
        onClose();
      } else {
        toast.error(data.message || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Rating submission error:', error);
      toast.error('Reytingni yuborishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
        }}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl"
        style={{
          background: isDark ? '#111111' : '#ffffff',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 p-2 rounded-full backdrop-blur-xl transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }}
        >
          <X className="size-5" style={{ color: isDark ? '#ffffff' : '#111827' }} />
        </button>

        {/* Content */}
        <div className="p-6">
          <h2 
            className="text-2xl font-bold mb-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Mahsulotni baholang
          </h2>
          <p 
            className="text-sm mb-6"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {productName}
          </p>

          {/* Star Rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                disabled={submitting}
                className="transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Star
                  className="size-12"
                  style={{
                    color: star <= (hoveredRating || rating) ? '#FCD34D' : isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    fill: star <= (hoveredRating || rating) ? '#FCD34D' : 'none',
                    transition: 'all 0.2s',
                  }}
                />
              </button>
            ))}
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
            >
              Izoh (ixtiyoriy)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              placeholder="Tajribangiz haqida yozing..."
              rows={4}
              className="w-full px-4 py-3 rounded-2xl resize-none outline-none transition-all disabled:opacity-60"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#111827',
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="w-full py-4 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: accentColor.color,
              color: '#ffffff',
              boxShadow: `0 8px 24px ${accentColor.color}66`,
            }}
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
            {submitting ? 'Yuklanmoqda...' : 'Baholash'}
          </button>
        </div>
      </div>
    </div>
  );
}
