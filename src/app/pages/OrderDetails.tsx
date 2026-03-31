import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function OrderDetailsPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: isDark
          ? 'radial-gradient(1100px 600px at 20% 10%, rgba(20,184,166,0.12), transparent 55%), #000'
          : 'radial-gradient(1100px 600px at 20% 10%, rgba(20,184,166,0.12), transparent 55%), #f9fafb',
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border p-5 backdrop-blur-xl"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-xl active:scale-95 transition"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.08)',
            }}
            aria-label="Back to orders"
          >
            <ArrowLeft className="size-5" style={{ color: isDark ? '#fff' : '#111827' }} />
          </button>

          <div
            className="size-10 rounded-2xl flex items-center justify-center border"
            style={{ background: `${accentColor.color}1a`, borderColor: `${accentColor.color}33` }}
          >
            <ReceiptText className="size-5" style={{ color: accentColor.color }} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
            Buyurtma ID
          </p>
          <p className="font-mono text-sm break-all" style={{ color: isDark ? '#fff' : '#111827' }}>
            {orderId || '—'}
          </p>
        </div>

        <div className="mt-5">
          <button
            onClick={() => navigate('/orders')}
            className="w-full py-3 rounded-2xl font-bold active:scale-[0.99] transition"
            style={{ background: accentColor.gradient, color: '#fff' }}
          >
            Buyurtmalar ro‘yxatiga qaytish
          </button>
        </div>
      </div>
    </div>
  );
}

