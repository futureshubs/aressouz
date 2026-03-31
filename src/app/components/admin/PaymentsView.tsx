import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  CreditCard, 
  Search, 
  Check, 
  X, 
  Clock, 
  DollarSign,
  Settings,
  History,
  Save,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Key,
  Globe,
  Smartphone,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { coerceUiPaymentTestMode } from '../../utils/paymentTestMode';

interface Payment {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  method: string;
  status: 'completed' | 'pending' | 'failed';
  orderId: string;
  createdAt: string;
  transactionId?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: 'payme' | 'click' | 'openbudget' | 'uzumnasiya' | 'uzumbank' | 'atmos';
  enabled: boolean;
  isTestMode: boolean;
  credentials: {
    merchantId?: string;
    merchantUserId?: string;
    serviceId?: string;
    secretKey?: string;
    apiKey?: string;
    login?: string;
    password?: string;
    callbackUrl?: string;
    storeId?: string;
    consumerKey?: string;
    consumerSecret?: string;
    apiBaseUrl?: string;
    terminalId?: string;
  };
  icon: any;
  color: string;
  description: string;
}

interface PaymentsViewProps {
  onStatsUpdate?: () => void;
}

export default function PaymentsView({ onStatsUpdate }: PaymentsViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Payment methods configuration
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: 'payme',
      name: 'Payme',
      type: 'payme',
      enabled: false,
      isTestMode: false,
      credentials: {},
      icon: Wallet,
      color: '#00b4cc',
      description: 'Payme to\'lov tizimi - Karta, Wallet va Click orqali'
    },
    {
      id: 'click',
      name: 'Click',
      type: 'click',
      enabled: false,
      isTestMode: false,
      credentials: {},
      icon: Smartphone,
      color: '#00a0e3',
      description: 'Click to\'lov tizimi - Bank kartalari orqali'
    },
    {
      id: 'openbudget',
      name: 'OpenBudget',
      type: 'openbudget',
      enabled: false,
      isTestMode: false,
      credentials: {},
      icon: Globe,
      color: '#6366f1',
      description: 'OpenBudget - Davlat xizmatlari uchun to\'lov'
    },
    {
      id: 'uzumnasiya',
      name: 'Uzum Nasiya',
      type: 'uzumnasiya',
      enabled: false,
      isTestMode: false,
      credentials: {},
      icon: CreditCard,
      color: '#7000ff',
      description: 'Uzum Nasiya - Bo\'lib to\'lash xizmati'
    },
    {
      id: 'uzumbank',
      name: 'Uzum Bank',
      type: 'uzumbank',
      enabled: false,
      isTestMode: false,
      credentials: {},
      icon: DollarSign,
      color: '#7000ff',
      description: 'Uzum Bank - Bank kartalari orqali to\'lov'
    },
    {
      id: 'atmos',
      name: 'Atmos',
      type: 'atmos',
      enabled: false,
      isTestMode: false,
      credentials: {},
      icon: ShieldCheck,
      color: '#1e40af',
      description: 'Atmos.uz - Xavfsiz bank kartalari to\'lovi (Uzcard, Humo)'
    },
  ]);

  const [showSecrets, setShowSecrets] = useState<{[key: string]: boolean}>({});
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadPayments();
    loadPaymentMethods();
  }, [visibilityRefetchTick]);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      // TODO: Load from Supabase
      const stored = localStorage.getItem('payments');
      if (stored) {
        setPayments(JSON.parse(stored));
      }
      onStatsUpdate?.();
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('To\'lovlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/payment-methods`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.methods && data.methods.length > 0) {
          setPaymentMethods(prev => 
            prev.map(method => {
              const savedMethod = data.methods.find((m: any) => m.type === method.type);
              if (savedMethod) {
                return {
                  ...method,
                  enabled: savedMethod.enabled,
                  isTestMode: coerceUiPaymentTestMode(savedMethod.isTestMode),
                  credentials: savedMethod.config,
                };
              }
              return method;
            })
          );
        }
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const handleSavePaymentMethod = async (method: PaymentMethod) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/payment-methods`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: method.type,
            enabled: method.enabled,
            isTestMode: method.isTestMode,
            config: method.credentials,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save payment method');
      }

      toast.success(`${method.name} sozlamalari saqlandi`);
      setEditingMethod(null);
      await loadPaymentMethods();
    } catch (error) {
      console.error('Error saving payment method:', error);
      toast.error('Sozlamalarni saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMethod = (methodId: string) => {
    setPaymentMethods(prev =>
      prev.map(m => m.id === methodId ? { ...m, enabled: !m.enabled } : m)
    );
  };

  const handleToggleTestMode = (methodId: string) => {
    setPaymentMethods(prev =>
      prev.map(m => m.id === methodId ? { ...m, isTestMode: !m.isTestMode } : m)
    );
  };

  const handleConfigChange = (methodId: string, field: string, value: string) => {
    setPaymentMethods(prev =>
      prev.map(m => 
        m.id === methodId 
          ? { ...m, credentials: { ...m.credentials, [field]: value } }
          : m
      )
    );
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.orderId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <X className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
      case 'pending':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
      case 'failed':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    }
  };

  const getStatusLabel = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'Bajarildi';
      case 'pending':
        return 'Kutilmoqda';
      case 'failed':
        return 'Bekor qilindi';
    }
  };

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const enabledMethodsCount = paymentMethods.filter(m => m.enabled).length;

  const renderPaymentMethodConfig = (method: PaymentMethod) => {
    const isEditing = editingMethod === method.id;
    const Icon = method.icon;

    const getConfigFields = () => {
      switch (method.type) {
        case 'payme':
          return [
            { key: 'merchantId', label: 'ID кассы (Subscribe) — Payme Business', type: 'text', required: true },
            { key: 'secretKey', label: 'Secret Key (shu muhit: test yoki prod)', type: 'password', required: true },
            { key: 'callbackUrl', label: 'Callback URL', type: 'text', required: false },
          ];
        case 'click':
          return [
            { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
            { key: 'serviceId', label: 'Service ID', type: 'text', required: true },
            { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
            { key: 'merchantUserId', label: 'Merchant User ID', type: 'text', required: false },
          ];
        case 'openbudget':
          return [
            { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
            { key: 'apiKey', label: 'API Key', type: 'password', required: true },
          ];
        case 'uzumnasiya':
          return [
            { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
            { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
          ];
        case 'uzumbank':
          return [
            { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
            { key: 'apiKey', label: 'API Key', type: 'password', required: true },
            { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
          ];
        case 'atmos':
          return [
            { key: 'storeId', label: 'Store ID (do‘kon)', type: 'text', required: true },
            { key: 'consumerKey', label: 'Consumer Key (OAuth2)', type: 'text', required: true },
            { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true },
            {
              key: 'apiBaseUrl',
              label: 'API URL (bo‘sh = prod: https://api.atmos.uz; rasmiy apigw: https://apigw.atmos.uz)',
              type: 'text',
              required: false,
            },
            {
              key: 'terminalId',
              label: 'Terminal ID (ixtiyoriy, apigw)',
              type: 'text',
              required: false,
            },
          ];
        default:
          return [];
      }
    };

    return (
      <div
        key={method.id}
        className="p-6 rounded-3xl border"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
          borderColor: method.enabled 
            ? `${method.color}50`
            : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          boxShadow: method.enabled
            ? `0 10px 30px ${method.color}20`
            : 'none',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-2xl"
              style={{ background: `${method.color}20` }}
            >
              <Icon className="w-6 h-6" style={{ color: method.color }} />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                {method.name}
                {method.enabled && (
                  <CheckCircle2 className="w-5 h-5" style={{ color: method.color }} />
                )}
              </h3>
              <p 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                {method.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleMethod(method.id)}
              className="px-4 py-2 rounded-xl font-medium transition-all active:scale-95"
              style={{
                background: method.enabled 
                  ? 'rgba(16, 185, 129, 0.15)' 
                  : 'rgba(239, 68, 68, 0.15)',
                color: method.enabled ? '#10b981' : '#ef4444',
              }}
            >
              {method.enabled ? 'Faol' : 'O\'chiq'}
            </button>
          </div>
        </div>

        {/* Test Mode Toggle */}
        <div 
          className="flex items-center justify-between p-3 rounded-2xl mb-4"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" style={{ color: method.isTestMode ? '#f59e0b' : '#10b981' }} />
            <span className="text-sm font-medium">
              {method.isTestMode ? 'Test rejim' : 'Production rejim'}
            </span>
          </div>
          <button
            onClick={() => handleToggleTestMode(method.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{
              background: method.isTestMode 
                ? 'rgba(245, 158, 11, 0.15)' 
                : 'rgba(16, 185, 129, 0.15)',
              color: method.isTestMode ? '#f59e0b' : '#10b981',
            }}
          >
            O'zgartirish
          </button>
        </div>

        {/* Configuration */}
        {isEditing ? (
          <div className="space-y-4">
            {getConfigFields().map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-2">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showSecrets[`${method.id}_${field.key}`] ? 'password' : 'text'}
                    value={(method.credentials as any)[field.key] || ''}
                    onChange={(e) => handleConfigChange(method.id, field.key, e.target.value)}
                    placeholder={`${field.label} kiriting`}
                    className="w-full px-4 py-3 pr-12 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility(`${method.id}_${field.key}`)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all active:scale-90"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      {showSecrets[`${method.id}_${field.key}`] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleSavePaymentMethod(method)}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 4px 16px ${accentColor.color}40`,
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Saqlash
                  </>
                )}
              </button>
              <button
                onClick={() => setEditingMethod(null)}
                disabled={isSaving}
                className="px-6 py-3 rounded-2xl font-medium border transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Show configured status */}
            <div className="flex items-center gap-2 text-sm">
              {Object.keys(method.credentials).length > 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Sozlangan
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Sozlanmagan
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => setEditingMethod(method.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border font-medium transition-all active:scale-95"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: method.color,
              }}
            >
              <Settings className="w-4 h-4" />
              Sozlash
            </button>
          </div>
        )}

        {/* Security Notice */}
        {method.enabled && (
          <div 
            className="mt-4 p-3 rounded-2xl flex items-start gap-3 text-sm"
            style={{
              background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-600 mb-1">Xavfsizlik</p>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Barcha ma'lumotlar shifrlangan holda saqlanadi. Hech qachon maxfiy kalitlarni uchinchi shaxslar bilan bo'lishmang.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div>
        <h2 className="text-2xl font-bold mb-4">To'lovlar</h2>
        
        <div className="flex gap-2 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
          <button
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all relative"
            style={{
              color: activeTab === 'history' ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
            }}
          >
            <History className="w-5 h-5" />
            To'lovlar tarixi
            {activeTab === 'history' && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: accentColor.gradient }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all relative"
            style={{
              color: activeTab === 'settings' ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
            }}
          >
            <Settings className="w-5 h-5" />
            To'lov sozlamalari
            {activeTab === 'settings' && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: accentColor.gradient }}
              />
            )}
          </button>
        </div>
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Qidirish..."
                className="w-full pl-12 pr-4 py-2.5 rounded-2xl border outline-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 rounded-2xl border outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: isDark ? '#ffffff' : '#111827',
              }}
            >
              <option value="all">Barchasi</option>
              <option value="completed">Bajarildi</option>
              <option value="pending">Kutilmoqda</option>
              <option value="failed">Bekor qilindi</option>
            </select>
          </div>

          {/* Stats */}
          <div
            className="p-6 rounded-3xl border"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(20, 184, 166, 0.1), rgba(20, 184, 166, 0.05))'
                : 'linear-gradient(145deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.08))',
              borderColor: `${accentColor.color}33`,
              boxShadow: `0 10px 30px ${accentColor.color}20`,
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-4 rounded-2xl"
                style={{ background: `${accentColor.color}30` }}
              >
                <DollarSign className="w-8 h-8" style={{ color: accentColor.color }} />
              </div>
              <div>
                <p 
                  className="text-sm mb-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                >
                  Jami summa
                </p>
                <p className="text-3xl font-bold">
                  {(totalAmount / 1000000).toFixed(1)}M so'm
                </p>
              </div>
            </div>
          </div>

          {/* Payments Table */}
          {filteredPayments.length === 0 ? (
            <div 
              className="text-center py-12 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <CreditCard 
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
              />
              <p 
                className="text-lg font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                To'lovlar topilmadi
              </p>
            </div>
          ) : (
            <div
              className="rounded-3xl border overflow-hidden"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr 
                      className="border-b"
                      style={{ 
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <th className="text-left px-6 py-4 text-sm font-semibold">Buyurtma ID</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Foydalanuvchi</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Summa</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">To'lov turi</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Holat</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Sana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => {
                      const statusColor = getStatusColor(payment.status);
                      return (
                        <tr 
                          key={payment.id}
                          className="border-b last:border-b-0 hover:bg-opacity-50 transition-colors"
                          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono font-semibold">{payment.orderId}</span>
                          </td>
                          <td className="px-6 py-4">{payment.userName}</td>
                          <td className="px-6 py-4 font-semibold">
                            {payment.amount.toLocaleString()} so'm
                          </td>
                          <td className="px-6 py-4">
                            <span 
                              className="inline-flex px-3 py-1 rounded-full text-xs font-medium"
                              style={{
                                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                color: isDark ? '#ffffff' : '#111827',
                              }}
                            >
                              {payment.method}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span 
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                              style={{
                                background: statusColor.bg,
                                color: statusColor.color,
                              }}
                            >
                              {getStatusIcon(payment.status)}
                              {getStatusLabel(payment.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {new Date(payment.createdAt).toLocaleString('uz-UZ', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Stats */}
          <div
            className="p-6 rounded-3xl border"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(20, 184, 166, 0.1), rgba(20, 184, 166, 0.05))'
                : 'linear-gradient(145deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.08))',
              borderColor: `${accentColor.color}33`,
              boxShadow: `0 10px 30px ${accentColor.color}20`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="p-4 rounded-2xl"
                  style={{ background: `${accentColor.color}30` }}
                >
                  <Key className="w-8 h-8" style={{ color: accentColor.color }} />
                </div>
                <div>
                  <p 
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    Faol to'lov usullari
                  </p>
                  <p className="text-3xl font-bold">
                    {enabledMethodsCount} / {paymentMethods.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {paymentMethods.map(method => renderPaymentMethodConfig(method))}
          </div>

          {/* Important Notice */}
          <div 
            className="p-6 rounded-3xl border"
            style={{
              background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)',
              borderColor: 'rgba(245, 158, 11, 0.3)',
            }}
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-yellow-600 mb-2">Muhim ma'lumot</h4>
                <ul className="space-y-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  <li>• Har bir to'lov tizimi uchun merchant akkaunt ochish kerak</li>
                  <li>• Test rejimda real to'lovlar amalga oshirilmaydi</li>
                  <li>• Production rejimga o'tishdan oldin barcha sozlamalarni tekshiring</li>
                  <li>• Merchant ID va Secret Key'larni hech kimga bermang</li>
                  <li>• Callback URL manzilini to'g'ri sozlang</li>
                  <li>• Barcha ma'lumotlar shifrlangan holda saqlanadi</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}