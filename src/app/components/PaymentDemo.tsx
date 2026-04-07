import { useState } from 'react';
import { CreditCard, ShoppingCart, Package } from 'lucide-react';
import PaymentButton from './PaymentButton';
import { formatAmount } from '../services/paymentService';

export default function PaymentDemo() {
  const [amount, setAmount] = useState<number>(50000);
  const [description, setDescription] = useState<string>('Test buyurtma');

  const handleSuccess = () => {
    console.log('✅ Payment completed successfully!');
  };

  const handleError = (error: string) => {
    console.error('❌ Payment error:', error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 app-safe-pt">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="bg-[#14b8a6] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            ARESSO To'lov Tizimi
          </h1>
          <p className="text-gray-400">
            Xavfsiz va qulay online to'lovlar
          </p>
        </div>

        {/* Demo Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Configuration Card */}
          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#14b8a6]" />
              To'lov Sozlamalari
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Summa (so'm)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#14b8a6]"
                  placeholder="Summa"
                  min="1000"
                  step="1000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimal: 1,000 so'm
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Tavsif
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#14b8a6]"
                  placeholder="To'lov tavsifi"
                />
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#14b8a6]" />
              Buyurtma Xulasasi
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-700/30 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Mahsulot</p>
                <p className="text-white font-medium">{description}</p>
              </div>

              <div className="bg-gray-700/30 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-1">Summa</p>
                <p className="text-2xl font-bold text-[#14b8a6]">
                  {formatAmount(amount)}
                </p>
              </div>

              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-xs text-green-400 mb-1">✓ Xavfsiz to'lov</p>
                <p className="text-xs text-gray-400">
                  ARESSO to'lov tizimi orqali himoyalangan
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Button */}
        <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8">
          <div className="max-w-md mx-auto">
            <PaymentButton
              amount={amount}
              description={description}
              onSuccess={handleSuccess}
              onError={handleError}
              className="w-full bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:from-[#0d9488] hover:to-[#0a7a6e] text-white text-lg py-4"
            >
              {formatAmount(amount)} to'lash
            </PaymentButton>

            <p className="text-xs text-gray-500 text-center mt-4">
              To'lovni amalga oshirish uchun tugmani bosing.
              <br />
              SANDBOX muhiti - test rejimi
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-400 mb-2">
            📌 DEMO MODE - Test Muhiti
          </h3>
          <div className="text-sm text-gray-400 space-y-1">
            <p>✓ Bu DEMO test muhiti - haqiqiy pul yechilmaydi</p>
            <p>✓ Barcha to'lovlar avtomatik muvaffaqiyatli bo'ladi</p>
            <p>✓ To'lov oynasi ochilmaydi (simulatsiya qilinadi)</p>
            <p>✓ Real ARESSO API ga ulanish talab qilinmaydi</p>
            <p className="text-yellow-400 mt-3">⚠️ Real to'lovlar uchun DEMO_MODE ni o'chiring</p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-gray-800/30 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-white font-semibold mb-1">Xavfsiz</p>
            <p className="text-xs text-gray-400">256-bit shifrlash</p>
          </div>
          <div className="bg-gray-800/30 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">⚡</div>
            <p className="text-white font-semibold mb-1">Tez</p>
            <p className="text-xs text-gray-400">Bir lahzada to'lov</p>
          </div>
          <div className="bg-gray-800/30 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">💳</div>
            <p className="text-white font-semibold mb-1">Qulay</p>
            <p className="text-xs text-gray-400">Barcha kartalar</p>
          </div>
        </div>
      </div>
    </div>
  );
}