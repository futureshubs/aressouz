import { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle, Clock, XCircle, MessageSquare, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

export interface RefundRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  // Product information
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  
  // Refund details
  reason: string;
  reasonCategory: 'defective' | 'wrong_item' | 'damaged' | 'not_as_described' | 'changed_mind' | 'other';
  description: string;
  images?: string[];
  
  // Status and timeline
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Dates
  requestDate: Date;
  approvedDate?: Date;
  rejectedDate?: Date;
  completedDate?: Date;
  estimatedCompletion?: Date;
  
  // Financial details
  refundAmount: number;
  refundMethod: 'original' | 'wallet' | 'bank_transfer' | 'cash';
  refundStatus: 'pending' | 'processing' | 'completed';
  
  // Resolution
  resolution?: string;
  adminNotes?: string;
  customerNotified: boolean;
  
  // Metadata
  assignedTo?: string;
  createdBy: string;
  updatedAt: Date;
}

export interface RefundPolicy {
  id: string;
  name: string;
  description: string;
  timeLimit: number; // days
  conditions: string[];
  restockingFee?: number;
  shippingFee?: number;
  categories: string[];
  isActive: boolean;
}

const defaultPolicies: RefundPolicy[] = [
  {
    id: 'standard-30',
    name: 'Standart 30 kun',
    description: 'Ko\'pchilik mahsulotlar uchun 30 kunlik qaytarish siyosati',
    timeLimit: 30,
    conditions: [
      'Mahsulot qadoqi o\'zgarmagan bo\'lishi kerak',
      'Mahsulot ishlatilmagan bo\'lishi kerak',
      'Chek yoki xarid guvohnomi talab qilinadi'
    ],
    restockingFee: 0.1, // 10%
    shippingFee: 0,
    categories: ['electronics', 'clothing', 'home'],
    isActive: true
  },
  {
    id: 'food-7',
    name: 'Oziq-ovqat 7 kun',
    description: 'Oziq-ovqat mahsulotlari uchun 7 kunlik qaytarish siyosati',
    timeLimit: 7,
    conditions: [
      'Mahsulot muddati otmagan bo\'lishi kerak',
      'Qadoq yopiq bo\'lishi kerak',
      'Sifat nuqsonlari bo\'lishi kerak'
    ],
    restockingFee: 0,
    shippingFee: 0,
    categories: ['food', 'beverages'],
    isActive: true
  },
  {
    id: 'digital-no-return',
    name: 'Raqamli mahsulotlar',
    description: 'Raqamli mahsulotlar qaytarilmaydi',
    timeLimit: 0,
    conditions: [
      'Raqamli kontent yuklab olingandan so\'ng qaytarib bo\'lmaydi',
      'Litsenziya kalitlari qaytarilmaydi'
    ],
    restockingFee: 0,
    shippingFee: 0,
    categories: ['digital', 'software', 'games'],
    isActive: true
  }
];

export function useRefund() {
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [policies, setPolicies] = useState<RefundPolicy[]>(defaultPolicies);
  const [isLoading, setIsLoading] = useState(false);

  // Create refund request
  const createRefundRequest = async (requestData: Omit<RefundRequest, 'id' | 'requestDate' | 'status' | 'customerNotified' | 'updatedAt'>) => {
    setIsLoading(true);
    try {
      const newRequest: RefundRequest = {
        ...requestData,
        id: `refund_${Date.now()}`,
        requestDate: new Date(),
        status: 'pending',
        customerNotified: false,
        updatedAt: new Date()
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRefundRequests(prev => [...prev, newRequest]);
      toast.success('Qaytarish arizasi yuborildi');
      return newRequest;
    } catch (error) {
      toast.error('Arizani yuborishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update refund request status
  const updateRefundStatus = async (id: string, status: RefundRequest['status'], notes?: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRefundRequests(prev => prev.map(request => {
        if (request.id === id) {
          const updatedRequest = {
            ...request,
            status,
            adminNotes: notes,
            updatedAt: new Date(),
            customerNotified: true
          };

          // Set appropriate dates
          if (status === 'approved') {
            updatedRequest.approvedDate = new Date();
          } else if (status === 'rejected') {
            updatedRequest.rejectedDate = new Date();
          } else if (status === 'completed') {
            updatedRequest.completedDate = new Date();
          }

          return updatedRequest;
        }
        return request;
      }));
      
      toast.success(`Ariza holati o'zgartirildi: ${status}`);
    } catch (error) {
      toast.error('Holatni o\'zgartirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Process refund
  const processRefund = async (id: string, refundMethod: RefundRequest['refundMethod']) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setRefundRequests(prev => prev.map(request => {
        if (request.id === id) {
          return {
            ...request,
            status: 'processing',
            refundMethod,
            refundStatus: 'processing',
            updatedAt: new Date()
          };
        }
        return request;
      }));
      
      toast.success('Pul qaytarish jarayoni boshlandi');
    } catch (error) {
      toast.error('Pul qaytarishni boshlashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Complete refund
  const completeRefund = async (id: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRefundRequests(prev => prev.map(request => {
        if (request.id === id) {
          return {
            ...request,
            status: 'completed',
            refundStatus: 'completed',
            completedDate: new Date(),
            updatedAt: new Date()
          };
        }
        return request;
      }));
      
      toast.success('Pul qaytarish muvaffaqiyatli amalga oshirildi');
    } catch (error) {
      toast.error('Pul qaytarishni yakunlashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get refund requests by status
  const getRefundsByStatus = (status: RefundRequest['status']) => {
    return refundRequests.filter(request => request.status === status);
  };

  // Get pending refunds count
  const getPendingRefundsCount = () => {
    return refundRequests.filter(request => request.status === 'pending').length;
  };

  // Check if order is eligible for refund
  const isEligibleForRefund = (orderDate: Date, category: string): { eligible: boolean; reason?: string; policy?: RefundPolicy } => {
    const policy = policies.find(p => p.categories.includes(category) && p.isActive);
    
    if (!policy) {
      return { eligible: false, reason: 'Ushbu kategoriya uchun qaytarish siyosati mavjud emas' };
    }
    
    if (policy.timeLimit === 0) {
      return { eligible: false, reason: 'Ushbu mahsulotlar qaytarilmaydi', policy };
    }
    
    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceOrder > policy.timeLimit) {
      return { eligible: false, reason: `Qaytarish muddati o'tgan (${policy.timeLimit} kun)`, policy };
    }
    
    return { eligible: true, policy };
  };

  return {
    refundRequests,
    policies,
    isLoading,
    createRefundRequest,
    updateRefundStatus,
    processRefund,
    completeRefund,
    getRefundsByStatus,
    getPendingRefundsCount,
    isEligibleForRefund
  };
}

export default function RefundManager() {
  const { refundRequests, isLoading, updateRefundStatus, processRefund, completeRefund, getPendingRefundsCount, getRefundsByStatus } = useRefund();
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);

  const pendingCount = getPendingRefundsCount();

  const getStatusColor = (status: RefundRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: RefundRequest['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'processing': return <RotateCcw className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: RefundRequest['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <RotateCcw className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pul qaytarish boshqaruvi
          </h3>
          {pendingCount > 0 && (
            <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
              {pendingCount} kutilmoqda
            </span>
          )}
        </div>
        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
          Yangi ariza
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Kutilayotgan</div>
          <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
            {getRefundsByStatus('pending').length}
          </div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Tasdiqlangan</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
            {getRefundsByStatus('approved').length}
          </div>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Jarayonda</div>
          <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
            {getRefundsByStatus('processing').length}
          </div>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-sm text-green-600 dark:text-green-400 mb-1">Bajarilgan</div>
          <div className="text-xl font-bold text-green-900 dark:text-green-100">
            {getRefundsByStatus('completed').length}
          </div>
        </div>
      </div>

      {/* Refunds List */}
      <div className="space-y-3">
        {refundRequests.length === 0 ? (
          <div className="text-center py-8">
            <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Hali hech qanday qaytarish arizasi yo'q
            </p>
          </div>
        ) : (
          refundRequests.map((request) => (
            <div
              key={request.id}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(request.priority)}`} />
                  <div className={`p-2 rounded-lg ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {request.orderNumber} • {request.productName}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {request.customerName} • {request.refundAmount.toLocaleString('uz-UZ')} so'm
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {request.reasonCategory === 'defective' && 'Nuqsonli mahsulot'}
                      {request.reasonCategory === 'wrong_item' && 'Noto\'g\'ri mahsulot'}
                      {request.reasonCategory === 'damaged' && 'Shikastlangan'}
                      {request.reasonCategory === 'not_as_described' && 'Tavsifga mos emas'}
                      {request.reasonCategory === 'changed_mind' && 'O\'y o\'zgartirildi'}
                      {request.reasonCategory === 'other' && 'Boshqa sabab'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                    {request.status === 'pending' && 'Kutilmoqda'}
                    {request.status === 'approved' && 'Tasdiqlangan'}
                    {request.status === 'rejected' && 'Rad etilgan'}
                    {request.status === 'processing' && 'Jarayonda'}
                    {request.status === 'completed' && 'Bajarilgan'}
                    {request.status === 'cancelled' && 'Bekor qilingan'}
                  </span>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateRefundStatus(request.id, 'approved')}
                          className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateRefundStatus(request.id, 'rejected')}
                          className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    {request.status === 'approved' && (
                      <button
                        onClick={() => processRefund(request.id, 'original')}
                        className="p-1 text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    
                    {request.status === 'processing' && (
                      <button
                        onClick={() => completeRefund(request.id)}
                        className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Urgent Refunds Alert */}
      {refundRequests.some(r => r.priority === 'urgent' && r.status === 'pending') && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-900 dark:text-red-100">
              Favqulodda arizalar
            </span>
          </div>
          <div className="text-sm text-red-700 dark:text-red-300">
            {refundRequests.filter(r => r.priority === 'urgent' && r.status === 'pending').length} ta 
            favqulodda qaytarish arizasi ko'rib chiqilishi kerak
          </div>
        </div>
      )}
    </div>
  );
}
