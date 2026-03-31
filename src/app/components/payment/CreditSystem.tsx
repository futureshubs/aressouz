import { useState, useEffect } from 'react';
import { CreditCard, Calculator, TrendingUp, AlertTriangle, CheckCircle, FileText, Clock, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

export interface CreditProduct {
  id: string;
  name: string;
  type: 'personal' | 'business' | 'mortgage' | 'auto' | 'education';
  minAmount: number;
  maxAmount: number;
  minTerm: number; // months
  maxTerm: number; // months
  interestRate: number; // annual percentage rate
  processingFee: number;
  earlyRepaymentFee: number;
  requirements: string[];
  documents: string[];
  isActive: boolean;
  description: string;
}

export interface CreditApplication {
  id: string;
  userId: string;
  productId: string;
  requestedAmount: number;
  term: number;
  purpose: string;
  monthlyIncome: number;
  employmentStatus: 'employed' | 'self_employed' | 'business_owner' | 'unemployed' | 'student';
  employmentDuration: number; // months
  existingLoans: number;
  creditHistory: 'excellent' | 'good' | 'fair' | 'poor' | 'no_history';
  collateral?: {
    type: 'real_estate' | 'vehicle' | 'deposit' | 'guarantor';
    value: number;
    description: string;
  };
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted';
  submittedDate?: Date;
  approvedDate?: Date;
  rejectedReason?: string;
  approvedAmount?: number;
  approvedRate?: number;
  monthlyPayment?: number;
  totalPayment?: number;
  totalInterest?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditLoan {
  id: string;
  applicationId: string;
  userId: string;
  amount: number;
  term: number;
  interestRate: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  startDate: Date;
  endDate: Date;
  nextPaymentDate: Date;
  remainingBalance: number;
  remainingPayments: number;
  status: 'active' | 'completed' | 'defaulted' | 'restructured';
  earlyRepaymentAllowed: boolean;
  createdAt: Date;
}

export interface CreditPayment {
  id: string;
  loanId: string;
  amount: number;
  principal: number;
  interest: number;
  paymentDate: Date;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  paidAmount: number;
  remainingAmount: number;
  lateFee?: number;
  createdAt: Date;
  paidAt?: Date;
}

const defaultCreditProducts: CreditProduct[] = [
  {
    id: 'personal-standard',
    name: 'Shaxsiy kredit - Standart',
    type: 'personal',
    minAmount: 1000000,
    maxAmount: 50000000,
    minTerm: 6,
    maxTerm: 36,
    interestRate: 28,
    processingFee: 2,
    earlyRepaymentFee: 1,
    requirements: [
      'Oylik daromad kamida 2.000.000 so\'m',
      'Kamida 6 oy ish tajribasi',
      '18 yoshdan yuqori',
      'O\'zbekiston fuqaroligi'
    ],
    documents: [
      'Pasport',
      'INN',
      'Ish haqi to\'g\'risidagi ma\'lumotnoma',
      'Bank ma\'lumotlari'
    ],
    isActive: true,
    description: 'Shaxsiy ehtiyojlari uchun tezkor kredit'
  },
  {
    id: 'business-startup',
    name: 'Biznes kredit - Startap',
    type: 'business',
    minAmount: 5000000,
    maxAmount: 200000000,
    minTerm: 12,
    maxTerm: 60,
    interestRate: 24,
    processingFee: 1.5,
    earlyRepaymentFee: 0.5,
    requirements: [
      'Biznes reja',
      'Kamida 6 oy biznes tajribasi',
      'Moliyaviy hisobotlar',
      'Zamin yoki kafolat'
    ],
    documents: [
      'Pasport',
      'INN',
      'Bank ma\'lumotlari',
      'Biznes reja',
      'Moliyaviy hisobotlar'
    ],
    isActive: true,
    description: 'Yangi bizneslarni qo\'llab-quvvatlash'
  },
  {
    id: 'mortgage-primary',
    name: 'Ipoteka kredit - Boshlang\'ich',
    type: 'mortgage',
    minAmount: 50000000,
    maxAmount: 500000000,
    minTerm: 60,
    maxTerm: 240,
    interestRate: 18,
    processingFee: 1,
    earlyRepaymentFee: 0,
    requirements: [
      'Boshlang\'ich to\'lov kamida 30%',
      'Barqaror daromad',
      'Zamin sifatida ko\'chmas mulk',
      'Kafolatchi'
    ],
    documents: [
      'Pasport',
      'INN',
      'Ish haqi to\'g\'risidagi ma\'lumotnoma',
      'Zamin hujjatlari',
      'Kafolatchi hujjatlari'
    ],
    isActive: true,
    description: 'Uy-joy sotib olish uchun uzoq muddatli kredit'
  },
  {
    id: 'auto-new',
    name: 'Avtokredit - Yangi avtomobil',
    type: 'auto',
    minAmount: 20000000,
    maxAmount: 150000000,
    minTerm: 12,
    maxTerm: 60,
    interestRate: 22,
    processingFee: 1.5,
    earlyRepaymentFee: 0.5,
    requirements: [
      'Boshlang\'ich to\'lov kamida 20%',
      'Barqaror daromad',
      'Avtomobil zamin qilinadi',
      'Haydovchilik guvohnomasi'
    ],
    documents: [
      'Pasport',
      'INN',
      'Ish haqi to\'g\'risidagi ma\'lumotnoma',
      'Haydovchilik guvohnomasi',
      'Avtomobil texnik pasporti'
    ],
    isActive: true,
    description: 'Yangi avtomobil sotib olish uchun kredit'
  }
];

export function useCredit() {
  const [products, setProducts] = useState<CreditProduct[]>(defaultCreditProducts);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loans, setLoans] = useState<CreditLoan[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate loan details
  const calculateLoan = (amount: number, term: number, rate: number, processingFee: number = 0) => {
    const monthlyRate = rate / 12 / 100;
    const monthlyPayment = (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    const totalPayment = monthlyPayment * term;
    const totalInterest = totalPayment - amount;
    const processingFeeAmount = amount * (processingFee / 100);
    
    return {
      monthlyPayment,
      totalPayment,
      totalInterest,
      processingFeeAmount,
      effectiveRate: (totalInterest / amount) * 100
    };
  };

  // Check credit eligibility
  const checkEligibility = (application: Omit<CreditApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const product = products.find(p => p.id === application.productId);
    if (!product) return { eligible: false, reason: 'Kredit mahsuloti topilmadi' };

    // Check amount range
    if (application.requestedAmount < product.minAmount || application.requestedAmount > product.maxAmount) {
      return { eligible: false, reason: `Kredit summasi ${product.minAmount.toLocaleString()} - ${product.maxAmount.toLocaleString()} so'm oralig\'ida bo\'lishi kerak` };
    }

    // Check term range
    if (application.term < product.minTerm || application.term > product.maxTerm) {
      return { eligible: false, reason: `Muddat ${product.minTerm} - ${product.maxTerm} oy oralig\'ida bo\'lishi kerak` };
    }

    // Check income requirement (simplified)
    const minIncome = product.type === 'personal' ? 2000000 : 
                      product.type === 'business' ? 3000000 : 
                      product.type === 'mortgage' ? 5000000 : 2500000;
    
    if (application.monthlyIncome < minIncome) {
      return { eligible: false, reason: `Oylik daromad kamida ${minIncome.toLocaleString()} so'm bo\'lishi kerak` };
    }

    // Check employment duration
    if (application.employmentStatus === 'employed' && application.employmentDuration < 6) {
      return { eligible: false, reason: 'Kamida 6 oy ish tajribasi talab qilinadi' };
    }

    // Check existing loans
    if (application.existingLoans > 2) {
      return { eligible: false, reason: 'Juda ko\'p faol kreditlar mavjud' };
    }

    return { eligible: true };
  };

  // Submit credit application
  const submitApplication = async (applicationData: Omit<CreditApplication, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'submittedDate'>) => {
    setIsLoading(true);
    try {
      const eligibility = checkEligibility(applicationData);
      
      const newApplication: CreditApplication = {
        ...applicationData,
        id: `credit_app_${Date.now()}`,
        status: eligibility.eligible ? 'submitted' : 'draft',
        submittedDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        rejectedReason: eligibility.eligible ? undefined : eligibility.reason
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setApplications(prev => [...prev, newApplication]);
      
      if (eligibility.eligible) {
        toast.success('Kredit arizasi muvaffaqiyatli yuborildi');
      } else {
        toast.error(`Ariza qabul qilinmadi: ${eligibility.reason}`);
      }
      
      return newApplication;
    } catch (error) {
      toast.error('Arizani yuborishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Approve application
  const approveApplication = async (applicationId: string, approvedAmount: number, approvedRate: number) => {
    setIsLoading(true);
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) throw new Error('Application not found');

      const loanCalc = calculateLoan(approvedAmount, application.term, approvedRate);

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setApplications(prev => prev.map(app => 
        app.id === applicationId 
          ? { 
              ...app, 
              status: 'approved', 
              approvedDate: new Date(),
              approvedAmount,
              approvedRate,
              monthlyPayment: loanCalc.monthlyPayment,
              totalPayment: loanCalc.totalPayment,
              totalInterest: loanCalc.totalInterest,
              updatedAt: new Date()
            }
          : app
      ));
      
      toast.success('Ariza tasdiqlandi');
    } catch (error) {
      toast.error('Arizani tasdiqlashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Create loan from approved application
  const createLoan = async (applicationId: string) => {
    setIsLoading(true);
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application || application.status !== 'approved' || !application.approvedAmount) {
        throw new Error('Application not approved');
      }

      const newLoan: CreditLoan = {
        id: `loan_${Date.now()}`,
        applicationId,
        userId: application.userId,
        amount: application.approvedAmount,
        term: application.term,
        interestRate: application.approvedRate || 0,
        monthlyPayment: application.monthlyPayment || 0,
        totalPayment: application.totalPayment || 0,
        totalInterest: application.totalInterest || 0,
        startDate: new Date(),
        endDate: new Date(Date.now() + application.term * 30 * 24 * 60 * 60 * 1000),
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        remainingBalance: application.approvedAmount,
        remainingPayments: application.term,
        status: 'active',
        earlyRepaymentAllowed: true,
        createdAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setLoans(prev => [...prev, newLoan]);
      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { ...app, status: 'active' as const, updatedAt: new Date() } : app
      ));
      
      toast.success('Kredit muvaffaqiyatli ajratildi');
      return newLoan;
    } catch (error) {
      toast.error('Kreditni ajratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Make payment
  const makePayment = async (loanId: string, amount: number) => {
    setIsLoading(true);
    try {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) throw new Error('Loan not found');

      const payment: CreditPayment = {
        id: `payment_${Date.now()}`,
        loanId,
        amount,
        principal: amount * 0.7, // Simplified calculation
        interest: amount * 0.3,
        paymentDate: new Date(),
        dueDate: loan.nextPaymentDate,
        status: 'paid',
        paidAmount: amount,
        remainingAmount: 0,
        createdAt: new Date(),
        paidAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPayments(prev => [...prev, payment]);
      
      // Update loan
      const newRemainingBalance = loan.remainingBalance - payment.principal;
      const newRemainingPayments = loan.remainingPayments - 1;
      const newStatus = newRemainingBalance <= 0 ? 'completed' : 'active';
      
      setLoans(prev => prev.map(l => 
        l.id === loanId 
          ? { 
              ...l, 
              remainingBalance: newRemainingBalance,
              remainingPayments: newRemainingPayments,
              status: newStatus as CreditLoan['status'],
              nextPaymentDate: new Date(l.nextPaymentDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            }
          : l
      ));
      
      toast.success('To\'lov muvaffaqiyatli amalga oshirildi');
    } catch (error) {
      toast.error('To\'lovni amalga oshirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    products,
    applications,
    loans,
    payments,
    isLoading,
    calculateLoan,
    checkEligibility,
    submitApplication,
    approveApplication,
    createLoan,
    makePayment
  };
}

export default function CreditCalculator() {
  const { products, calculateLoan, checkEligibility } = useCredit();
  const [selectedProduct, setSelectedProduct] = useState<CreditProduct | null>(null);
  const [amount, setAmount] = useState(10000000);
  const [term, setTerm] = useState(12);
  const [calculations, setCalculations] = useState<any>(null);

  useEffect(() => {
    if (selectedProduct) {
      const calc = calculateLoan(amount, term, selectedProduct.interestRate, selectedProduct.processingFee);
      setCalculations(calc);
    }
  }, [selectedProduct, amount, term]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center space-x-2 mb-6">
        <Calculator className="w-6 h-6 text-purple-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Kredit kalkulyatori
        </h3>
      </div>

      {/* Product Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Kredit turi
        </label>
        <select
          value={selectedProduct?.id || ''}
          onChange={(e) => {
            const product = products.find(p => p.id === e.target.value);
            setSelectedProduct(product || null);
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">Kredit turini tanlang</option>
          {products.filter(p => p.isActive).map(product => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <>
          {/* Amount and Term */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kredit summasi
              </label>
              <input
                type="range"
                min={selectedProduct.minAmount}
                max={selectedProduct.maxAmount}
                step={1000000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span>{selectedProduct.minAmount.toLocaleString()} so'm</span>
                <span className="font-bold text-lg">{amount.toLocaleString()} so'm</span>
                <span>{selectedProduct.maxAmount.toLocaleString()} so'm</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Muddat
              </label>
              <input
                type="range"
                min={selectedProduct.minTerm}
                max={selectedProduct.maxTerm}
                step={1}
                value={term}
                onChange={(e) => setTerm(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span>{selectedProduct.minTerm} oy</span>
                <span className="font-bold text-lg">{term} oy</span>
                <span>{selectedProduct.maxTerm} oy</span>
              </div>
            </div>
          </div>

          {/* Calculations */}
          {calculations && (
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                Hisoblash natijalari
              </h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Kredit summasi:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {amount.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Yillik foiz stavkasi:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedProduct.interestRate}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Xizmat haqi:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {calculations.processingFeeAmount.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Oylik to\'lov:</span>
                  <span className="font-bold text-lg text-blue-600">
                    {calculations.monthlyPayment.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Jami foiz to\'lovlari:</span>
                  <span className="font-medium text-orange-600">
                    {calculations.totalInterest.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
                
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-lg font-medium text-gray-900 dark:text-white">
                    Jami to\'lov:
                  </span>
                  <span className="text-xl font-bold text-purple-600">
                    {calculations.totalPayment.toLocaleString('uz-UZ')} so'm
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    Samarali foiz stavkasi:
                  </span>
                </div>
                <div className="text-lg font-bold text-purple-600">
                  {calculations.effectiveRate.toFixed(1)}%
                </div>
              </div>

              {/* Requirements */}
              <div className="mt-6">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                  Talablar:
                </h5>
                <ul className="space-y-2">
                  {selectedProduct.requirements.map((req, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Documents */}
              <div className="mt-6">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                  Kerakli hujjatlar:
                </h5>
                <ul className="space-y-2">
                  {selectedProduct.documents.map((doc, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button className="w-full mt-6 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                Ariza qoldirish
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
