import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  flag: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

const defaultCurrencies: Currency[] = [
  { code: 'UZS', name: "O'zbekiston So'mi", symbol: 'soʻm', rate: 1, flag: '🇺🇿' },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 12900, flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 14100, flag: '🇪🇺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', rate: 140, flag: '🇷🇺' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 1800, flag: '🇨🇳' },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 16300, flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 86, flag: '🇯🇵' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', rate: 28, flag: '🇰🇿' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', rate: 380, flag: '🇹🇷' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 3510, flag: '🇦🇪' }
];

export function useCurrency() {
  const [currencies, setCurrencies] = useState<Currency[]>(defaultCurrencies);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(defaultCurrencies[0]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Convert amount between currencies
  const convertCurrency = (amount: number, from: string, to: string): number => {
    const fromCurrency = currencies.find(c => c.code === from);
    const toCurrency = currencies.find(c => c.code === to);
    
    if (!fromCurrency || !toCurrency) return amount;
    
    // Convert to base currency (UZS) first, then to target currency
    const amountInBase = amount * fromCurrency.rate;
    return amountInBase / toCurrency.rate;
  };

  // Format currency with symbol
  const formatCurrency = (amount: number, currency: Currency = selectedCurrency): string => {
    const formatted = new Intl.NumberFormat('uz-UZ', {
      minimumFractionDigits: currency.code === 'UZS' ? 0 : 2,
      maximumFractionDigits: currency.code === 'UZS' ? 0 : 2,
    }).format(amount);
    
    return `${currency.symbol} ${formatted}`;
  };

  // Update exchange rates (mock API call)
  const updateExchangeRates = async () => {
    setIsLoading(true);
    try {
      // Mock API call - real implementation would call actual exchange rate API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedCurrencies = currencies.map(currency => {
        // Simulate rate changes (±2%)
        const change = 0.98 + Math.random() * 0.04; // 98% to 102%
        return {
          ...currency,
          rate: currency.code === 'UZS' ? 1 : Math.round(currency.rate * change * 100) / 100
        };
      });
      
      setCurrencies(updatedCurrencies);
      setLastUpdated(new Date());
      toast.success('Valyuta kurslari yangilandi');
    } catch (error) {
      toast.error('Valyuta kurslarini yangilashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  // Get currency by code
  const getCurrency = (code: string): Currency | undefined => {
    return currencies.find(c => c.code === code);
  };

  // Calculate price in different currencies
  const calculatePriceInCurrencies = (priceUZS: number): Record<string, string> => {
    const prices: Record<string, string> = {};
    currencies.forEach(currency => {
      const convertedPrice = convertCurrency(priceUZS, 'UZS', currency.code);
      prices[currency.code] = formatCurrency(convertedPrice, currency);
    });
    return prices;
  };

  // Auto-update rates every hour
  useEffect(() => {
    const interval = setInterval(() => {
      updateExchangeRates();
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  return {
    currencies,
    selectedCurrency,
    setSelectedCurrency,
    exchangeRates,
    lastUpdated,
    isLoading,
    convertCurrency,
    formatCurrency,
    updateExchangeRates,
    getCurrency,
    calculatePriceInCurrencies
  };
}

export default function CurrencySelector() {
  const { currencies, selectedCurrency, setSelectedCurrency, updateExchangeRates, isLoading, lastUpdated } = useCurrency();

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Valyuta tanlash
        </h3>
        <button
          onClick={updateExchangeRates}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Yangilash</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {currencies.map((currency) => (
          <button
            key={currency.code}
            onClick={() => setSelectedCurrency(currency)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedCurrency.code === currency.code
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">{currency.flag}</div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">
              {currency.code}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {currency.symbol}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {currency.rate.toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Oxirgi yangilanish:</span>
          <span>{lastUpdated.toLocaleTimeString('uz-UZ')}</span>
        </div>
      </div>
    </div>
  );
}
