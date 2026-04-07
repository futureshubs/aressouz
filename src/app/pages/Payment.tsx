import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle, XCircle, Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import { checkPaymentStatus, formatAmount, getPaymentByOrderId } from '../services/paymentService';
import { useTheme } from '../context/ThemeContext';

export default function Payment() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'cancelled'>('checking');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const urlPaymentId = searchParams.get('paymentId');
  const orderId = searchParams.get('orderId');
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | null>(null);

  const activePaymentId = urlPaymentId || resolvedPaymentId;
  const isAuctionParticipationOrder = Boolean(orderId?.startsWith('AUC_FEE__'));

  useEffect(() => {
    if (urlPaymentId) return;
    if (!orderId) {
      setStatus('failed');
      setError("To'lov ID yoki buyurtma ID topilmadi");
      return;
    }

    let cancelled = false;
    setStatus('checking');
    void getPaymentByOrderId(orderId).then((r) => {
      if (cancelled) return;
      const pay = r.success && r.payment ? r.payment : null;
      const pid = pay && (pay.paymentId ?? (pay as { payment_id?: string }).payment_id);
      if (pid) {
        setResolvedPaymentId(String(pid));
      } else {
        setStatus('failed');
        setError(r.error || 'To\'lov topilmadi');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [urlPaymentId, orderId]);

  useEffect(() => {
    if (!activePaymentId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (cancelled) return;
      try {
        const result = await checkPaymentStatus(activePaymentId);

        if (!result.success) {
          setStatus('failed');
          setError(result.error || 'Status tekshirishda xatolik');
          return;
        }

        setPaymentData(result);

        if (result.status === 'paid') {
          setStatus('success');
        } else if (result.status === 'cancelled') {
          setStatus('cancelled');
        } else if (result.status === 'failed') {
          setStatus('failed');
        } else {
          timeoutId = setTimeout(run, 3000);
        }
      } catch (err: unknown) {
        setStatus('failed');
        setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activePaymentId]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoToOrder = () => {
    if (orderId && !orderId.startsWith('AUC_FEE__')) {
      navigate(`/orders/${orderId}`);
    } else {
      navigate('/orders');
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 app-safe-pt ${
        isDark
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
          : 'bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100'
      }`}
    >
      <div className="max-w-md w-full">
        <div
          className={`backdrop-blur-lg border rounded-2xl shadow-2xl p-8 ${
            isDark
              ? 'bg-gray-800/50 border-gray-700/50'
              : 'bg-white/95 border-gray-200 shadow-gray-200/50'
          }`}
        >
          <div className="flex justify-center mb-8">
            <div className="bg-[#14b8a6] p-4 rounded-2xl">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>

          {status === 'checking' && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-[#14b8a6] animate-spin mx-auto mb-4" />
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                To'lov tekshirilmoqda...
              </h2>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Iltimos, kuting</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="bg-green-500/10 p-4 rounded-full inline-flex mb-4">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                To'lov muvaffaqiyatli!
              </h2>
              <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Buyurtmangiz qabul qilindi</p>

              {paymentData?.amount && (
                <div
                  className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-gray-700/30' : 'bg-gray-100 border border-gray-200'}`}
                >
                  <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>To'lov summasi</p>
                  <p className="text-2xl font-bold text-[#14b8a6]">{formatAmount(paymentData.amount)}</p>
                </div>
              )}

              <div className="space-y-3">
                {!isAuctionParticipationOrder && (
                  <button
                    onClick={handleGoToOrder}
                    className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-105"
                  >
                    Buyurtmani ko'rish
                  </button>
                )}
                <button
                  onClick={handleGoHome}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  {isAuctionParticipationOrder ? 'Auksion / bosh sahifa' : 'Bosh sahifa'}
                </button>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center">
              <div className="bg-red-500/10 p-4 rounded-full inline-flex mb-4">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                To'lov amalga oshmadi
              </h2>
              <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {error || 'Xatolik yuz berdi'}
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleGoHome}
                  className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white py-3 px-6 rounded-xl font-semibold transition-all"
                >
                  <ArrowLeft className="w-5 h-5 inline mr-2" />
                  Bosh sahifa
                </button>
              </div>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="text-center">
              <div className="bg-yellow-500/10 p-4 rounded-full inline-flex mb-4">
                <XCircle className="w-16 h-16 text-yellow-500" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                To'lov bekor qilindi
              </h2>
              <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Siz to'lovni bekor qildingiz</p>
              <div className="space-y-3">
                <button
                  onClick={handleGoHome}
                  className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white py-3 px-6 rounded-xl font-semibold transition-all"
                >
                  <ArrowLeft className="w-5 h-5 inline mr-2" />
                  Bosh sahifa
                </button>
              </div>
            </div>
          )}

          {activePaymentId && (
            <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
              <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                To'lov ID: {activePaymentId}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className={isDark ? 'text-sm text-gray-500' : 'text-sm text-gray-500'}>Himoyalangan to'lov</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
            Powered by <span className="text-[#14b8a6] font-semibold">ARESSO</span>
          </p>
        </div>
      </div>
    </div>
  );
}
