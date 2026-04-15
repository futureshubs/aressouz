import { useState } from 'react';
import { X, Star, Send, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  placeName: string;
  onSuccess: () => void;
}

export function ReviewModal({ isOpen, onClose, placeId, placeName, onSuccess }: ReviewModalProps) {
  const { theme, accentColor } = useTheme();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Iltimos, baho qo\'ying');
      return;
    }

    if (!comment.trim()) {
      setError('Iltimos, sharh yozing');
      return;
    }

    if (!user) {
      setError('Sharh qoldirish uchun tizimga kiring');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places/${placeId}/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            rating,
            comment: comment.trim(),
            userName: `${user.firstName} ${user.lastName}`,
            userId: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sharh qo\'shishda xatolik');
      }

      console.log('✅ Review submitted successfully:', data);
      
      // Reset form
      setRating(0);
      setComment('');
      
      // Call success callback
      onSuccess();
      
      // Show success message briefly then close
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (err: any) {
      console.error('❌ Review submission error:', err);
      setError(err.message || 'Sharh qo\'shishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-[60] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(25, 25, 25, 0.98), rgba(15, 15, 15, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
          backdropFilter: 'blur(40px)',
          borderRadius: '32px',
          boxShadow: isDark
            ? '0 24px 64px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 24px 64px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-6 right-6 p-2 rounded-xl transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="size-5" style={{ color: isDark ? '#ffffff' : '#000000' }} strokeWidth={2.5} />
          </button>

          <div className="pr-12">
            <h2 
              className="text-2xl font-bold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Baholab o'ting
            </h2>
            <p 
              className="text-sm"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              {placeName}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-6">
          {/* Rating Stars */}
          <div>
            <label 
              className="block text-sm font-semibold mb-3"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Bahongiz *
            </label>
            <div className="flex items-center justify-center gap-3 py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  disabled={isSubmitting}
                  className="transition-transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    transform: (hoveredRating >= star || rating >= star) ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  <Star
                    className="size-12"
                    fill={(hoveredRating >= star || rating >= star) ? '#FBBF24' : 'transparent'}
                    stroke={(hoveredRating >= star || rating >= star) ? '#FBBF24' : (isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')}
                    strokeWidth={2}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p 
                className="text-center text-sm font-semibold mt-2"
                style={{ color: accentColor.color }}
              >
                {rating === 5 ? 'Ajoyib! ⭐️' : rating === 4 ? 'Yaxshi! 👍' : rating === 3 ? 'Yoqimli 😊' : rating === 2 ? 'O\'rtacha 😐' : 'Yomon 😞'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label 
              className="block text-sm font-semibold mb-3"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Sharhingiz *
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              placeholder="Tajribangiz haqida yozing..."
              rows={4}
              className="w-full px-4 py-3 rounded-2xl resize-none text-sm disabled:opacity-60"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                color: isDark ? '#ffffff' : '#000000',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = `2px solid ${accentColor.color}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = isDark 
                  ? '1px solid rgba(255, 255, 255, 0.1)' 
                  : '1px solid rgba(0, 0, 0, 0.08)';
              }}
            />
            <p 
              className="text-xs mt-2"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            >
              {comment.length} / 500 belgi
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div 
              className="p-3 rounded-xl"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <p className="text-sm text-red-500 font-semibold">
                {error}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0 || !comment.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundImage: accentColor.gradient,
              boxShadow: `0 8px 24px ${accentColor.color}44`,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                Yuborilmoqda...
              </>
            ) : (
              <>
                <Send className="size-5" strokeWidth={2.5} />
                Sharh qoldirish
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
