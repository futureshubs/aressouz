import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Store, Lock, User, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { readValidSellerSession } from '../utils/sellerSession';

export default function SellerLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  /** Saqlangan sessiya tekshirilguncha forma ko‘rinmasin — «kirilgan» holatda darhol dashboard */
  const [sessionCheckDone, setSessionCheckDone] = useState(false);

  useEffect(() => {
    const saved = readValidSellerSession();
    if (saved) {
      navigate('/seller/dashboard', { replace: true });
      return;
    }
    setSessionCheckDone(true);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.login || !formData.password) {
      toast.error('Login va parol majburiy!');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 ===== SELLER LOGIN REQUEST =====');
      console.log('📤 Login:', formData.login);
      console.log('📤 Sending request to server...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/login`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);
      
      const data = await response.json();
      console.log('📥 Response data:', data);

      if (response.ok && data.success) {
        const sessionData = {
          token: data.session.token,
          shopId: data.session.shop.id,
          shopName: data.session.shop.name,
          branchId: data.session.shop.branchId,
        };
        
        console.log('✅ Login successful!');
        console.log('🔑 Token received:', sessionData.token);
        console.log('🔑 Token format check:', sessionData.token.substring(0, 30) + '...');
        console.log('🔑 Shop ID:', sessionData.shopId);
        console.log('🔑 Shop Name:', sessionData.shopName);
        
        // Validate token format before saving
        if (sessionData.token.includes('seller-shop-')) {
          console.error('❌ CRITICAL: Server returned OLD token format!');
          toast.error('Server xatoligi: Eski token formati. Iltimos administrator bilan bog\'laning.');
          return;
        }
        
        console.log('✅ Token format validation PASSED');
        console.log('💾 Saving to localStorage...');
        
        // Save session
        localStorage.setItem('sellerSession', JSON.stringify(sessionData));
        
        console.log('✅ Session saved to localStorage');
        console.log('🔑 ===== SELLER LOGIN COMPLETE =====\n');

        toast.success(data.message);
        navigate('/seller/dashboard');
      } else {
        console.error('❌ Login failed:', data.error);
        toast.error(data.error || 'Kirishda xatolik');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionCheckDone) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 app-safe-pt"
        style={{ background: isDark ? '#000000' : '#f9fafb' }}
      >
        <div
          className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor.color}55`, borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
          Tekshirilmoqda…
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
      }}
    >
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Ortga
        </button>

        {/* Login Card */}
        <div
          className="rounded-3xl p-8 border"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: isDark
              ? '0 25px 50px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="inline-flex p-5 rounded-3xl mb-4"
              style={{ background: `${accentColor.color}20` }}
            >
              <Store className="w-12 h-12" style={{ color: accentColor.color }} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Seller Panel</h1>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Do'kon paneliga kirish
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Login
              </label>
              <div className="relative">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                  placeholder="Loginingizni kiriting"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Parol
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                  placeholder="Parolingizni kiriting"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-bold transition-all active:scale-98"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 10px 30px ${accentColor.color}40`,
              }}
            >
              {isLoading ? 'Yuklanmoqda...' : 'Kirish'}
            </button>
          </form>

          {/* Info */}
          <div
            className="mt-6 p-4 rounded-2xl text-sm text-center"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
            }}
          >
            Login va parolni filialdan olishingiz mumkin
          </div>
        </div>
      </div>
    </div>
  );
}