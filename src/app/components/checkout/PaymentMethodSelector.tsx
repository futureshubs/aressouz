import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  CreditCard, 
  Wallet, 
  Smartphone,
  Globe,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { coerceUiPaymentTestMode } from '../../utils/paymentTestMode';
import { SkeletonBox } from '../skeletons';

interface PaymentMethod {
  type: string;
  name: string;
  enabled: boolean;
  isTestMode: boolean;
  icon: any;
  color: string;
  description: string;
}

interface PaymentMethodSelectorProps {
  amount: number;
  orderId: string;
  userId: string;
  onPaymentInitiated: (transactionId: string, paymentUrl: string) => void;
  onCancel?: () => void;
}

export default function PaymentMethodSelector({ 
  amount, 
  orderId, 
  userId,
  onPaymentInitiated,
  onCancel 
}: PaymentMethodSelectorProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const methodIcons: {[key: string]: any} = {
    payme: Wallet,
    click: Smartphone,
    openbudget: Globe,
    uzumnasiya: CreditCard,
    uzumbank: DollarSign,
    atmos: ShieldCheck,
  };

  const methodColors: {[key: string]: string} = {
    payme: '#00b4cc',
    click: '#00a0e3',
    openbudget: '#6366f1',
    uzumnasiya: '#7000ff',
    uzumbank: '#7000ff',
    atmos: '#1e40af',
  };

  const methodNames: {[key: string]: string} = {
    payme: 'Payme',
    click: 'Click',
    openbudget: 'OpenBudget',
    uzumnasiya: 'Uzum Nasiya',
    uzumbank: 'Uzum Bank',
    atmos: 'Atmos',
  };

  const methodDescriptions: {[key: string]: string} = {
    payme: 'Payme orqali to\'lash',
    click: 'Click orqali to\'lash',
    openbudget: 'OpenBudget orqali to\'lash',
    uzumnasiya: 'Bo\'lib to\'lash (3-12 oy)',
    uzumbank: 'Uzum Bank orqali to\'lash',
    atmos: 'Atmos.uz orqali to\'lash',
  };

  const methodSubtitles: Record<PaymentMethod, string> = {
    cash: 'Naqd pul',
    online: 'Online to\'lov',
    openbudget: 'OpenBudget orqali to\'lash',
    uzumnasiya: 'Bo\'lib to\'lash (3-12 oy)',
    uzumbank: 'Uzum Bank orqali to\'lash',
    atmos: 'Bank kartasi bilan to\'lash (Uzcard, Humo)',
  };

  useEffect(() => {
    loadPaymentMethods();
  }, [visibilityRefetchTick]);

  const loadPaymentMethods = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/payment-methods`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        const enabledMethods = data.methods
          .filter((m: any) => m.enabled)
          .map((m: any) => ({
            type: m.type,
            name: methodNames[m.type] || m.type,
            enabled: m.enabled,
            isTestMode: coerceUiPaymentTestMode(m.isTestMode),
            icon: methodIcons[m.type] || CreditCard,
            color: methodColors[m.type] || accentColor.color,
            description: methodDescriptions[m.type] || '',
          }));
        
        setPaymentMethods(enabledMethods);
        
        // Auto-select first method if only one available
        if (enabledMethods.length === 1) {
          setSelectedMethod(enabledMethods[0].type);
        }
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
      toast.error('To\'lov usullarini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast.error('To\'lov usulini tanlang');
      return;
    }

    setIsProcessing(true);
    try {
      let endpoint = '';
      
      switch (selectedMethod) {
        case 'payme':
          endpoint = '/payments/payme/create';
          break;
        case 'click':
          endpoint = '/payments/click/create';
          break;
        default:
          toast.error('Bu to\'lov usuli hozircha ishlamaydi');
          setIsProcessing(false);
          return;
      }

      const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            orderId,
            userId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create payment');
      }

      const data = await response.json();
      
      toast.success('To\'lov sahifasiga yo\'naltirilmoqda...');
      
      // Call parent component with transaction details
      onPaymentInitiated(data.transaction.id, data.paymentUrl);
      
      // Open payment URL in new window
      window.open(data.paymentUrl, '_blank');
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('To\'lovni boshlashda xatolik');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-4" role="status" aria-label="To‘lov usullari yuklanmoqda">
        <SkeletonBox isDark={isDark} className="h-14 w-full rounded-2xl" />
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} isDark={isDark} className="h-[72px] w-full rounded-2xl" />
        ))}
        <span className="sr-only">Yuklanmoqda</span>
      </div>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <div 
        className="p-6 rounded-3xl border text-center"
        style={{
          background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
        }}
      >
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <p className="font-medium text-red-500 mb-2">
          To'lov usullari mavjud emas
        </p>
        <p 
          className="text-sm"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
        >
          Administrator to'lov usullarini sozlashi kerak
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Amount Display */}
      <div
        className="p-6 rounded-3xl border text-center"
        style={{
          background: isDark 
            ? `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`
            : `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`,
          borderColor: `${accentColor.color}50`,
          boxShadow: `0 10px 30px ${accentColor.color}20`,
        }}
      >
        <p 
          className="text-sm mb-2"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          To'lov miqdori
        </p>
        <p className="text-4xl font-bold" style={{ color: accentColor.color }}>
          {formatAmount(amount)}
        </p>
      </div>

      {/* Payment Methods */}
      <div>
        <h3 className="text-lg font-bold mb-4">To'lov usulini tanlang</h3>
        <div className="space-y-3">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.type;
            
            return (
              <button
                key={method.type}
                onClick={() => setSelectedMethod(method.type)}
                className="w-full p-4 rounded-2xl border transition-all active:scale-98"
                style={{
                  background: isSelected
                    ? isDark 
                      ? `linear-gradient(145deg, ${method.color}30, ${method.color}20)`
                      : `linear-gradient(145deg, ${method.color}20, ${method.color}10)`
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isSelected ? method.color : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  boxShadow: isSelected ? `0 4px 16px ${method.color}30` : 'none',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-3 rounded-2xl"
                    style={{ background: `${method.color}30` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: method.color }} />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold">{method.name}</p>
                      {method.isTestMode && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b',
                          }}
                        >
                          Test
                        </span>
                      )}
                    </div>
                    <p 
                      className="text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {method.description}
                    </p>
                  </div>

                  {isSelected && (
                    <CheckCircle2 className="w-6 h-6" style={{ color: method.color }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security Notice */}
      <div 
        className="p-4 rounded-2xl border flex items-start gap-3"
        style={{
          background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
        }}
      >
        <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-green-600 mb-1">Xavfsiz to'lov</p>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Barcha to'lovlar xavfsiz tarzda qayta ishlanadi. Sizning karta ma'lumotlaringiz shifrlangan holda saqlanadi.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-2xl font-medium border transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              color: isDark ? '#ffffff' : '#111827',
            }}
          >
            Bekor qilish
          </button>
        )}
        
        <button
          onClick={handlePayment}
          disabled={!selectedMethod || isProcessing}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: selectedMethod ? accentColor.gradient : 'rgba(156, 163, 175, 0.5)',
            color: '#ffffff',
            boxShadow: selectedMethod ? `0 4px 16px ${accentColor.color}40` : 'none',
          }}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Yuklanmoqda...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              To'lovga o'tish
            </>
          )}
        </button>
      </div>
    </div>
  );
}