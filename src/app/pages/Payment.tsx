import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle, XCircle, Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import { checkPaymentStatus, formatAmount } from '../services/paymentService';

export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'cancelled'>('checking');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const paymentId = searchParams.get('paymentId');
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (paymentId) {
      checkStatus();
    } else {
      setStatus('failed');
      setError('To\'lov ID topilmadi');
    }
  }, [paymentId]);

  const checkStatus = async () => {
    if (!paymentId) return;

    try {
      const result = await checkPaymentStatus(paymentId);

      if (!result.success) {
        setStatus('failed');
        setError(result.error || 'Status tekshirishda xatolik');
        return;
      }

      setPaymentData(result);

      // Map status
      if (result.status === 'paid') {
        setStatus('success');
      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
      } else if (result.status === 'failed') {
        setStatus('failed');
      } else {
        // Still pending, check again in 3 seconds
        setTimeout(checkStatus, 3000);
      }
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Xatolik yuz berdi');
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoToOrder = () => {
    if (orderId) {
      navigate(`/orders/${orderId}`);
    } else {
      navigate('/orders');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-[#14b8a6] p-4 rounded-2xl">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Status */}
          {status === 'checking' && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-[#14b8a6] animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                To'lov tekshirilmoqda...
              </h2>
              <p className="text-gray-400">
                Iltimos, kuting
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="bg-green-500/10 p-4 rounded-full inline-flex mb-4">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                To'lov muvaffaqiyatli!
              </h2>
              <p className="text-gray-400 mb-6">
                Buyurtmangiz qabul qilindi
              </p>

              {paymentData?.amount && (
                <div className="bg-gray-700/30 rounded-xl p-4 mb-6">
                  <p className="text-gray-400 text-sm mb-1">To'lov summasi</p>
                  <p className="text-2xl font-bold text-[#14b8a6]">
                    {formatAmount(paymentData.amount)}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleGoToOrder}
                  className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-105"
                >
                  Buyurtmani ko'rish
                </button>
                <button
                  onClick={handleGoHome}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-xl font-semibold transition-all"
                >
                  Bosh sahifa
                </button>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center">
              <div className="bg-red-500/10 p-4 rounded-full inline-flex mb-4">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                To'lov amalga oshmadi
              </h2>
              <p className="text-gray-400 mb-6">
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
              <h2 className="text-2xl font-bold text-white mb-2">
                To'lov bekor qilindi
              </h2>
              <p className="text-gray-400 mb-6">
                Siz to'lovni bekor qildingiz
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

          {/* Payment ID */}
          {paymentId && (
            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <p className="text-xs text-gray-500 text-center">
                To'lov ID: {paymentId}
              </p>
            </div>
          )}
        </div>

        {/* ARESSO Badge */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Himoyalangan to'lov
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Powered by <span className="text-[#14b8a6] font-semibold">ARESSO</span>
          </p>
        </div>
      </div>
    </div>
  );
}
