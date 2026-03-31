import { useState, useEffect } from 'react';
import { Wallet, CreditCard, Send, Download, TrendingUp, History, Plus, Minus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'transfer_in' | 'transfer_out';
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  referenceId?: string;
  category?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

export interface WalletTransfer {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  fee: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'mobile_wallet';
  provider: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

export function useWallet() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create wallet
  const createWallet = async (userId: string, currency: string) => {
    setIsLoading(true);
    try {
      const newWallet: Wallet = {
        id: `wallet_${Date.now()}`,
        userId,
        balance: 0,
        currency,
        isActive: true,
        isDefault: wallets.length === 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setWallets(prev => [...prev, newWallet]);
      toast.success('Hamyon yaratildi');
      return newWallet;
    } catch (error) {
      toast.error('Hamyonni yaratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add funds to wallet
  const addFunds = async (walletId: string, amount: number, paymentMethodId: string) => {
    setIsLoading(true);
    try {
      const transaction: WalletTransaction = {
        id: `tx_${Date.now()}`,
        walletId,
        type: 'deposit',
        amount,
        currency: 'UZS',
        description: 'Hamyonni to\'ldirish',
        status: 'pending',
        referenceId: paymentMethodId,
        category: 'topup',
        createdAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update transaction status
      const completedTransaction = { ...transaction, status: 'completed' as const, completedAt: new Date() };
      setTransactions(prev => [...prev, completedTransaction]);
      
      // Update wallet balance
      setWallets(prev => prev.map(wallet => 
        wallet.id === walletId 
          ? { ...wallet, balance: wallet.balance + amount, updatedAt: new Date() }
          : wallet
      ));
      
      toast.success(`${amount.toLocaleString('uz-UZ')} so'm hamyonga qo\'shildi`);
      return completedTransaction;
    } catch (error) {
      toast.error('Pul qo\'shishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Withdraw funds from wallet
  const withdrawFunds = async (walletId: string, amount: number, paymentMethodId: string) => {
    setIsLoading(true);
    try {
      const wallet = wallets.find(w => w.id === walletId);
      if (!wallet || wallet.balance < amount) {
        throw new Error('Yetarli mablag\' mavjud emas');
      }

      const transaction: WalletTransaction = {
        id: `tx_${Date.now()}`,
        walletId,
        type: 'withdrawal',
        amount,
        currency: 'UZS',
        description: 'Hamyondan pul yechish',
        status: 'pending',
        referenceId: paymentMethodId,
        category: 'withdrawal',
        createdAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update transaction status
      const completedTransaction = { ...transaction, status: 'completed' as const, completedAt: new Date() };
      setTransactions(prev => [...prev, completedTransaction]);
      
      // Update wallet balance
      setWallets(prev => prev.map(wallet => 
        wallet.id === walletId 
          ? { ...wallet, balance: wallet.balance - amount, updatedAt: new Date() }
          : wallet
      ));
      
      toast.success(`${amount.toLocaleString('uz-UZ')} so'm yechib olindi`);
      return completedTransaction;
    } catch (error) {
      toast.error('Pul yechishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Transfer between wallets
  const transferFunds = async (fromWalletId: string, toWalletId: string, amount: number, description: string) => {
    setIsLoading(true);
    try {
      const fromWallet = wallets.find(w => w.id === fromWalletId);
      if (!fromWallet || fromWallet.balance < amount) {
        throw new Error('Yetarli mablag\' mavjud emas');
      }

      const transferFee = amount * 0.01; // 1% fee
      const totalAmount = amount + transferFee;

      const transfer: WalletTransfer = {
        id: `transfer_${Date.now()}`,
        fromWalletId,
        toWalletId,
        amount,
        currency: 'UZS',
        description,
        status: 'pending',
        fee: transferFee,
        createdAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update transfer status
      const completedTransfer = { ...transfer, status: 'completed' as const, completedAt: new Date() };
      setTransfers(prev => [...prev, completedTransfer]);
      
      // Create withdrawal transaction
      const withdrawalTx: WalletTransaction = {
        id: `tx_${Date.now()}_out`,
        walletId: fromWalletId,
        type: 'transfer_out',
        amount: totalAmount,
        currency: 'UZS',
        description: `Pul o'tkazish: ${description}`,
        status: 'completed',
        referenceId: transfer.id,
        category: 'transfer',
        createdAt: new Date(),
        completedAt: new Date()
      };

      // Create deposit transaction
      const depositTx: WalletTransaction = {
        id: `tx_${Date.now()}_in`,
        walletId: toWalletId,
        type: 'transfer_in',
        amount,
        currency: 'UZS',
        description: `Pul o'tkazish: ${description}`,
        status: 'completed',
        referenceId: transfer.id,
        category: 'transfer',
        createdAt: new Date(),
        completedAt: new Date()
      };

      setTransactions(prev => [...prev, withdrawalTx, depositTx]);
      
      // Update wallet balances
      setWallets(prev => prev.map(wallet => {
        if (wallet.id === fromWalletId) {
          return { ...wallet, balance: wallet.balance - totalAmount, updatedAt: new Date() };
        } else if (wallet.id === toWalletId) {
          return { ...wallet, balance: wallet.balance + amount, updatedAt: new Date() };
        }
        return wallet;
      }));
      
      toast.success(`${amount.toLocaleString('uz-UZ')} so'm muvaffaqiyatli o'tkazildi`);
      return completedTransfer;
    } catch (error) {
      toast.error('Pul o\'tkazishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get wallet transactions
  const getWalletTransactions = (walletId: string, limit?: number) => {
    const txs = transactions
      .filter(tx => tx.walletId === walletId || tx.referenceId === walletId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? txs.slice(0, limit) : txs;
  };

  // Get wallet balance
  const getWalletBalance = (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    return wallet?.balance || 0;
  };

  // Get total balance across all wallets
  const getTotalBalance = (userId: string, currency?: string) => {
    return wallets
      .filter(wallet => wallet.userId === userId && (!currency || wallet.currency === currency))
      .reduce((total, wallet) => total + wallet.balance, 0);
  };

  return {
    wallets,
    transactions,
    transfers,
    paymentMethods,
    isLoading,
    createWallet,
    addFunds,
    withdrawFunds,
    transferFunds,
    getWalletTransactions,
    getWalletBalance,
    getTotalBalance
  };
}

export default function WalletManager({ userId }: { userId: string }) {
  const { 
    wallets, 
    transactions, 
    isLoading, 
    createWallet, 
    addFunds, 
    withdrawFunds, 
    transferFunds,
    getWalletTransactions,
    getWalletBalance,
    getTotalBalance
  } = useWallet();
  
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const totalBalance = getTotalBalance(userId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: WalletTransaction['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: WalletTransaction['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTransactionIcon = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'deposit': return <Plus className="w-4 h-4 text-green-500" />;
      case 'withdrawal': return <Minus className="w-4 h-4 text-red-500" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'refund': return <TrendingUp className="w-4 h-4 text-purple-500" />;
      case 'transfer_in': return <Download className="w-4 h-4 text-green-500" />;
      case 'transfer_out': return <Send className="w-4 h-4 text-red-500" />;
      default: return <Wallet className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Wallet className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mening hamyonlarim
          </h3>
        </div>
        <button
          onClick={() => createWallet(userId, 'UZS')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Yangi hamyon
        </button>
      </div>

      {/* Total Balance */}
      <div className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white mb-6">
        <div className="text-sm opacity-90 mb-2">Jami balans</div>
        <div className="text-3xl font-bold mb-4">{formatCurrency(totalBalance)}</div>
        <div className="flex items-center space-x-4 text-sm">
          <span>{wallets.length} ta hamyon</span>
          <span>•</span>
          <span>{transactions.length} ta tranzaksiya</span>
        </div>
      </div>

      {/* Wallets List */}
      <div className="space-y-4 mb-6">
        {wallets.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Hali hech qanday hamyon yo'q
            </p>
            <button
              onClick={() => createWallet(userId, 'UZS')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Hamyon yaratish
            </button>
          </div>
        ) : (
          wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {wallet.currency} Hamyoni
                      {wallet.isDefault && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Asosiy
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {wallet.isActive ? 'Faol' : 'Nofaol'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(wallet.balance)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {wallet.id.slice(-8)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => { setSelectedWallet(wallet); setShowAddFunds(true); }}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedWallet(wallet); setShowWithdraw(true); }}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedWallet(wallet); setShowTransfer(true); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Transactions */}
      {selectedWallet && (
        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            So'nggi tranzaksiyalar
          </h4>
          <div className="space-y-3">
            {getWalletTransactions(selectedWallet.id, 5).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Tranzaksiyalar yo'q
              </p>
            ) : (
              getWalletTransactions(selectedWallet.id, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {transaction.createdAt.toLocaleDateString('uz-UZ')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`font-bold ${
                        transaction.type === 'deposit' || transaction.type === 'transfer_in' || transaction.type === 'refund'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {transaction.type === 'deposit' || transaction.type === 'transfer_in' || transaction.type === 'refund' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </div>
                      <div className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transaction.status)}`}>
                        {transaction.status === 'pending' && 'Kutilmoqda'}
                        {transaction.status === 'completed' && 'Bajarilgan'}
                        {transaction.status === 'failed' && 'Xatolik'}
                        {transaction.status === 'cancelled' && 'Bekor qilingan'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
