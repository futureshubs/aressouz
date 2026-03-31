import { useState, useEffect } from 'react';
import { Calendar, Calculator, CreditCard, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export interface InstallmentPlan {
  id: string;
  name: string;
  description: string;
  months: number;
  interestRate: number;
  downPaymentPercent: number;
  processingFee: number;
  latePaymentFee: number;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  bank?: string;
  requirements?: string[];
}

export interface InstallmentApplication {
  id: string;
  userId: string;
  productId: string;
  productPrice: number;
  planId: string;
  downPayment: number;
  monthlyPayment: number;
  totalAmount: number;
  totalInterest: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  applicationDate: Date;
  approvedDate?: Date;
  nextPaymentDate?: Date;
  remainingPayments: number;
  documents?: string[];
}

const defaultPlans: InstallmentPlan[] = [
  {
    id: 'halal-3',
    name: 'Halal 3 oy',
    description: '3 oyga muddatli to\'lov, foizsiz',
    months: 3,
    interestRate: 0,
    downPaymentPercent: 20,
    processingFee: 50000,
    latePaymentFee: 50000,
    minAmount: 500000,
    maxAmount: 10000000,
    isActive: true,
    bank: 'TBC Bank',
    requirements: ['Pasport', 'INN', 'Oylik daromad 1.000.000 so\'mdan yuqori']
  },
  {
    id: 'halal-6',
    name: 'Halal 6 oy',
    description: '6 oyga muddatli to\'lov, foizsiz',
    months: 6,
    interestRate: 0,
    downPaymentPercent: 30,
    processingFee: 75000,
    latePaymentFee: 75000,
    minAmount: 1000000,
    maxAmount: 15000000,
    isActive: true,
    bank: 'TBC Bank',
    requirements: ['Pasport', 'INN', 'Oylik daromad 1.500.000 so\'mdan yuqori']
  },
  {
    id: 'halal-12',
    name: 'Halal 12 oy',
    description: '12 oyga muddatli to\'lov, foizsiz',
    months: 12,
    interestRate: 0,
    downPaymentPercent: 40,
    processingFee: 100000,
    latePaymentFee: 100000,
    minAmount: 2000000,
    maxAmount: 20000000,
    isActive: true,
    bank: 'TBC Bank',
    requirements: ['Pasport', 'INN', 'Oylik daromad 2.000.000 so\'mdan yuqori', 'Zamin talab qilinishi mumkin']
  },
  {
    id: 'anorbank-6',
    name: 'Anorbank 6 oy',
    description: '6 oyga muddatli to\'lov, 20% foiz bilan',
    months: 6,
    interestRate: 20,
    downPaymentPercent: 25,
    processingFee: 0,
    latePaymentFee: 50000,
    minAmount: 800000,
    maxAmount: 12000000,
    isActive: true,
    bank: 'Anorbank',
    requirements: ['Pasport', 'INN', 'Oylik daromad 1.200.000 so\'mdan yuqori']
  },
  {
    id: 'credit-24',
    name: 'Kredit 24 oy',
    description: '24 oyga standart kredit',
    months: 24,
    interestRate: 28,
    downPaymentPercent: 30,
    processingFee: 150000,
    latePaymentFee: 100000,
    minAmount: 5000000,
    maxAmount: 50000000,
    isActive: true,
    bank: 'Agrobank',
    requirements: ['Pasport', 'INN', 'Oylik daromad 3.000.000 so\'mdan yuqori', 'Zamin talab qilinadi']
  }
];

export function useInstallment() {
  const [plans, setPlans] = useState<InstallmentPlan[]>(defaultPlans);
  const [applications, setApplications] = useState<InstallmentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate installment details
  const calculateInstallment = (price: number, plan: InstallmentPlan) => {
    const downPayment = price * (plan.downPaymentPercent / 100);
    const financedAmount = price - downPayment;
    
    // Calculate interest
    const totalInterest = (financedAmount * plan.interestRate / 100) * (plan.months / 12);
    const totalAmount = financedAmount + totalInterest + plan.processingFee;
    const monthlyPayment = totalAmount / plan.months;
    
    return {
      downPayment,
      financedAmount,
      totalInterest,
      totalAmount,
      monthlyPayment,
      effectiveRate: (totalInterest / financedAmount) * 100
    };
  };

  // Apply for installment
  const applyForInstallment = async (application: Omit<InstallmentApplication, 'id' | 'applicationDate' | 'status' | 'remainingPayments'>) => {
    setIsLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newApplication: InstallmentApplication = {
        ...application,
        id: `installment_${Date.now()}`,
        applicationDate: new Date(),
        status: 'pending',
        remainingPayments: application.planId ? plans.find(p => p.id === application.planId)?.months || 0 : 0
      };
      
      setApplications(prev => [...prev, newApplication]);
      toast.success('Muddatli to\'lov arizasi yuborildi');
      return newApplication;
    } catch (error) {
      toast.error('Arizani yuborishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get available plans for product
  const getAvailablePlans = (price: number): InstallmentPlan[] => {
    return plans.filter(plan => 
      plan.isActive && 
      price >= plan.minAmount && 
      price <= plan.maxAmount
    );
  };

  // Get user applications
  const getUserApplications = (userId: string): InstallmentApplication[] => {
    return applications.filter(app => app.userId === userId);
  };

  return {
    plans,
    applications,
    isLoading,
    calculateInstallment,
    applyForInstallment,
    getAvailablePlans,
    getUserApplications
  };
}

export default function InstallmentCalculator({ productPrice }: { productPrice: number }) {
  const { plans, calculateInstallment, getAvailablePlans } = useInstallment();
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
  const [calculations, setCalculations] = useState<any>(null);

  const availablePlans = getAvailablePlans(productPrice);

  useEffect(() => {
    if (selectedPlan) {
      const calc = calculateInstallment(productPrice, selectedPlan);
      setCalculations(calc);
    }
  }, [selectedPlan, productPrice]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center space-x-2 mb-6">
        <Calculator className="w-6 h-6 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Muddatli to\'lov hisoblagichi
        </h3>
      </div>

      <div className="mb-6">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Mahsulot narxi:
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {productPrice.toLocaleString('uz-UZ')} so'm
        </div>
      </div>

      {availablePlans.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Ushbu mahsulot uchun muddatli to\'lov rejasi mavjud emas
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {availablePlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedPlan?.id === plan.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {plan.name}
                  </div>
                  {plan.interestRate === 0 ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Foizsiz
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                      {plan.interestRate}% yillik
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {plan.description}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Boshlang\'ich to\'lov: {plan.downPaymentPercent}%
                </div>
              </button>
            ))}
          </div>

          {calculations && selectedPlan && (
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                Hisoblash natijalari
              </h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Boshlang\'ich to\'lov:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {calculations.downPayment.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Moliyalangan summa:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {calculations.financedAmount.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                {calculations.totalInterest > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Foiz to\'lovlari:</span>
                    <span className="font-medium text-orange-600">
                      {calculations.totalInterest.toLocaleString('uz-UZ')} so'm
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Xizmat haqi:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedPlan.processingFee.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Oylik to\'lov:</span>
                    <span className="font-bold text-lg text-blue-600">
                      {calculations.monthlyPayment.toLocaleString('uz-UZ')} so'm
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Jami to\'lov:</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    {calculations.totalAmount.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Samarali foiz stavkasi:
                  </span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {calculations.effectiveRate.toFixed(1)}%
                </div>
              </div>

              <button className="w-full mt-6 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Ariza qoldirish
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
