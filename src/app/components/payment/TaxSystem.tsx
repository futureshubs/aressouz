import { useState, useEffect } from 'react';
import { Calculator, Receipt, FileText, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface TaxRate {
  id: string;
  name: string;
  type: 'VAT' | 'INCOME_TAX' | 'PROPERTY_TAX' | 'CUSTOMS' | 'EXCISE' | 'OTHER';
  rate: number;
  description: string;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  conditions?: string[];
}

export interface TaxCalculation {
  id: string;
  amount: number;
  currency: string;
  taxType: string;
  taxRate: number;
  taxAmount: number;
  totalWithTax: number;
  description: string;
  date: Date;
  userId: string;
}

export interface TaxReport {
  id: string;
  period: string;
  startDate: Date;
  endDate: Date;
  totalRevenue: number;
  totalTax: number;
  taxBreakdown: Record<string, number>;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedDate?: Date;
  approvedDate?: Date;
  notes?: string;
}

const defaultTaxRates: TaxRate[] = [
  {
    id: 'vat-standard',
    name: 'QQS - Standart stavka',
    type: 'VAT',
    rate: 15,
    description: 'O\'zbekiston Respublikasida qo\'llaniladigan standart QQS stavkasi',
    isActive: true,
    effectiveFrom: new Date('2023-01-01'),
    conditions: ['Barcha tovarlar va xizmatlar', 'Istisnolar bundan mustasno']
  },
  {
    id: 'vat-reduced',
    name: 'QQS - Kamaytirilgan stavka',
    type: 'VAT',
    rate: 5,
    description: 'Kamaytirilgan QQS stavkasi',
    isActive: true,
    effectiveFrom: new Date('2023-01-01'),
    conditions: ['Ijtimoiy ahamiyatga ega tovarlar', 'Dorilar', 'Ta\'lim xizmatlari']
  },
  {
    id: 'income-tax',
    name: 'Daromad solig\'i',
    type: 'INCOME_TAX',
    rate: 12,
    description: 'Yuridik shaxslar daromad solig\'i',
    isActive: true,
    effectiveFrom: new Date('2023-01-01'),
    conditions: ['Foyda', 'Daromad', 'Boshqa daromadlar']
  },
  {
    id: 'property-tax',
    name: 'Mulk solig\'i',
    type: 'PROPERTY_TAX',
    rate: 0.5,
    description: 'Ko\'chmas mulk solig\'i',
    isActive: true,
    effectiveFrom: new Date('2023-01-01'),
    conditions: ['Bino va inshootlar', 'Yer uchastkalari']
  },
  {
    id: 'customs-duty',
    name: 'Bojxona boji',
    type: 'CUSTOMS',
    rate: 10,
    description: 'Import qilinadigan tovarlar uchun bojxona boji',
    isActive: true,
    effectiveFrom: new Date('2023-01-01'),
    conditions: ['Import tovarlari', 'Chegaradan o\'tkaziladigan mahsulotlar']
  }
];

export function useTax() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>(defaultTaxRates);
  const [calculations, setCalculations] = useState<TaxCalculation[]>([]);
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate tax for amount
  const calculateTax = (amount: number, taxRateId: string, description?: string): TaxCalculation => {
    const taxRate = taxRates.find(rate => rate.id === taxRateId);
    if (!taxRate) throw new Error('Tax rate not found');

    const taxAmount = (amount * taxRate.rate) / 100;
    const totalWithTax = amount + taxAmount;

    return {
      id: `tax_${Date.now()}`,
      amount,
      currency: 'UZS',
      taxType: taxRate.type,
      taxRate: taxRate.rate,
      taxAmount,
      totalWithTax,
      description: description || taxRate.description,
      date: new Date(),
      userId: 'current_user'
    };
  };

  // Calculate multiple taxes
  const calculateMultipleTaxes = (amount: number, taxRateIds: string[]): TaxCalculation[] => {
    return taxRateIds.map(taxRateId => calculateTax(amount, taxRateId));
  };

  // Get applicable tax rates
  const getApplicableTaxRates = (category: string): TaxRate[] => {
    return taxRates.filter(rate => {
      if (!rate.isActive) return false;
      const now = new Date();
      if (rate.effectiveTo && now > rate.effectiveTo) return false;
      if (now < rate.effectiveFrom) return false;
      
      // Check conditions (simplified)
      if (category === 'food' && rate.rate === 5) return true; // Reduced VAT for food
      if (category === 'standard' && rate.rate === 15) return true; // Standard VAT
      if (category === 'service' && rate.type === 'INCOME_TAX') return true;
      
      return rate.type === 'VAT'; // Default to VAT
    });
  };

  // Generate tax report
  const generateTaxReport = async (startDate: Date, endDate: Date): Promise<TaxReport> => {
    setIsLoading(true);
    try {
      // Mock calculation - in real app, this would query actual transactions
      const mockRevenue = 100000000; // 100 million UZS
      const mockVAT = mockRevenue * 0.15; // 15% VAT
      const mockIncomeTax = mockRevenue * 0.05 * 0.12; // 5% profit * 12% tax
      
      const report: TaxReport = {
        id: `report_${Date.now()}`,
        period: `${startDate.toLocaleDateString('uz-UZ')} - ${endDate.toLocaleDateString('uz-UZ')}`,
        startDate,
        endDate,
        totalRevenue: mockRevenue,
        totalTax: mockVAT + mockIncomeTax,
        taxBreakdown: {
          'QQS': mockVAT,
          'Daromad solig\'i': mockIncomeTax
        },
        status: 'draft'
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setReports(prev => [...prev, report]);
      toast.success('Soliq hisoboti yaratildi'); // Fix syntax error here
      return report;
    } catch (error) {
      toast.error('Soliq hisobotini yaratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Submit tax report
  const submitTaxReport = async (reportId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setReports(prev => prev.map(report => 
        report.id === reportId 
          ? { ...report, status: 'submitted', submittedDate: new Date() }
          : report
      ));
      
      toast.success('Soliq hisoboti yuborildi');
    } catch (error) {
      toast.error('Soliq hisobotini yuborishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get tax summary for period
  const getTaxSummary = (startDate: Date, endDate: Date) => {
    const periodCalculations = calculations.filter(calc => 
      calc.date >= startDate && calc.date <= endDate
    );

    const summary = periodCalculations.reduce((acc, calc) => {
      acc.totalAmount += calc.amount;
      acc.totalTax += calc.taxAmount;
      acc.totalWithTax += calc.totalWithTax;
      
      if (!acc.breakdown[calc.taxType]) {
        acc.breakdown[calc.taxType] = 0;
      }
      acc.breakdown[calc.taxType] += calc.taxAmount;
      
      return acc;
    }, {
      totalAmount: 0,
      totalTax: 0,
      totalWithTax: 0,
      breakdown: {} as Record<string, number>
    });

    return summary;
  };

  return {
    taxRates,
    calculations,
    reports,
    isLoading,
    calculateTax,
    calculateMultipleTaxes,
    getApplicableTaxRates,
    generateTaxReport,
    submitTaxReport,
    getTaxSummary
  };
}

export default function TaxCalculator({ amount, category }: { amount: number; category: string }) {
  const { taxRates, calculateTax, getApplicableTaxRates, getTaxSummary } = useTax();
  const [selectedTaxes, setSelectedTaxes] = useState<string[]>([]);
  const [calculations, setCalculations] = useState<TaxCalculation[]>([]);

  const applicableTaxes = getApplicableTaxRates(category);

  useEffect(() => {
    if (selectedTaxes.length > 0) {
      const newCalculations = selectedTaxes.map(taxId => calculateTax(amount, taxId));
      setCalculations(newCalculations);
    } else {
      setCalculations([]);
    }
  }, [selectedTaxes, amount]);

  const totalTax = calculations.reduce((sum, calc) => sum + calc.taxAmount, 0);
  const totalWithTax = amount + totalTax;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center space-x-2 mb-6">
        <Calculator className="w-6 h-6 text-green-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Soliq hisoblagichi
        </h3>
      </div>

      <div className="mb-6">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Hisoblanadigan summa:
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {amount.toLocaleString('uz-UZ')} so'm
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Qo'llaniladigan soliqlar:
        </div>
        <div className="space-y-2">
          {applicableTaxes.map((tax) => (
            <label
              key={tax.id}
              className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTaxes.includes(tax.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTaxes(prev => [...prev, tax.id]);
                  } else {
                    setSelectedTaxes(prev => prev.filter(id => id !== tax.id));
                  }
                }}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {tax.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {tax.rate}% - {tax.description}
                </div>
              </div>
              <div className="text-lg font-bold text-green-600">
                {((amount * tax.rate) / 100).toLocaleString('uz-UZ')} so'm
              </div>
            </label>
          ))}
        </div>
      </div>

      {calculations.length > 0 && (
        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            Hisoblash natijalari
          </h4>
          
          <div className="space-y-3">
            {calculations.map((calc) => (
              <div key={calc.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {calc.taxType === 'VAT' ? 'QQS' : calc.taxType === 'INCOME_TAX' ? 'Daromad solig\'i' : calc.taxType}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {calc.taxRate}% stavka
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-red-600">
                    {calc.taxAmount.toLocaleString('uz-UZ')} so'm
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Asl summa:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {amount.toLocaleString('uz-UZ')} so'm
              </span>
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Jami soliq:</span>
              <span className="font-bold text-red-600">
                {totalTax.toLocaleString('uz-UZ')} so'm
              </span>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                Soliq bilan jami:
              </span>
              <span className="text-xl font-bold text-green-600">
                {totalWithTax.toLocaleString('uz-UZ')} so'm
              </span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Samimiy eslatma:
              </span>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              Soliq hisoblari taxminiy hisoblanadi. Haqiqiy soliq miqdorini soliq maslahatchisi bilan tasdiqlang.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
