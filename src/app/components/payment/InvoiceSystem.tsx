import { useState, useEffect } from 'react';
import { FileText, Download, Send, Eye, Edit, Trash2, CheckCircle, Clock, AlertCircle, Printer, Mail } from 'lucide-react';
import { toast } from 'sonner';

export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tax?: number;
  discount?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'sale' | 'purchase' | 'service' | 'rental';
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  
  // Client information
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientTaxId?: string;
  
  // Seller information
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  sellerPhone?: string;
  sellerAddress?: string;
  sellerTaxId?: string;
  
  // Financial details
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  
  // Payment terms
  paymentTerms: string;
  lateFee?: number;
  lateFeePercent?: number;
  
  // Additional information
  notes?: string;
  terms?: string;
  attachments?: string[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  isDefault: boolean;
}

const defaultTemplates: InvoiceTemplate[] = [
  {
    id: 'standard',
    name: 'Standart shablon',
    description: 'Oddiy hisob-faktura shabloni',
    template: 'standard',
    isDefault: true
  },
  {
    id: 'detailed',
    name: 'Batafsil shablon',
    description: 'To\'liq ma\'lumotli hisob-faktura',
    template: 'detailed',
    isDefault: false
  },
  {
    id: 'minimal',
    name: 'Minimal shablon',
    description: 'Qisqa hisob-faktura',
    template: 'minimal',
    isDefault: false
  }
];

export function useInvoice() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(defaultTemplates);
  const [isLoading, setIsLoading] = useState(false);

  // Generate invoice number
  const generateInvoiceNumber = (type: Invoice['type']): string => {
    const prefix = type === 'sale' ? 'SAT' : type === 'purchase' ? 'XAR' : type === 'service' ? 'XIZ' : 'IJARA';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${date}-${random}`;
  };

  // Create new invoice
  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>) => {
    setIsLoading(true);
    try {
      const newInvoice: Invoice = {
        ...invoiceData,
        id: `invoice_${Date.now()}`,
        invoiceNumber: generateInvoiceNumber(invoiceData.type),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInvoices(prev => [...prev, newInvoice]);
      toast.success('Hisob-faktura yaratildi');
      return newInvoice;
    } catch (error) {
      toast.error('Hisob-fakturani yaratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update invoice
  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInvoices(prev => prev.map(invoice => 
        invoice.id === id 
          ? { ...invoice, ...updates, updatedAt: new Date() }
          : invoice
      ));
      
      toast.success('Hisob-faktura yangilandi');
    } catch (error) {
      toast.error('Hisob-fakturani yangilashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Send invoice
  const sendInvoice = async (id: string, email?: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await updateInvoice(id, { status: 'sent' });
      toast.success('Hisob-faktura yuborildi');
    } catch (error) {
      toast.error('Hisob-fakturani yuborishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Mark as paid
  const markAsPaid = async (id: string, paidAmount: number) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const invoice = invoices.find(inv => inv.id === id);
      if (!invoice) throw new Error('Invoice not found');
      
      const newPaidAmount = invoice.paidAmount + paidAmount;
      const newRemainingAmount = invoice.totalAmount - newPaidAmount;
      const status = newRemainingAmount <= 0 ? 'paid' : 'sent';
      
      await updateInvoice(id, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status,
        paidDate: newRemainingAmount <= 0 ? new Date() : invoice.paidDate
      });
      
      toast.success('To\'lov qayd etildi');
    } catch (error) {
      toast.error('To\'lovni qayd etishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete invoice
  const deleteInvoice = async (id: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInvoices(prev => prev.filter(invoice => invoice.id !== id));
      toast.success('Hisob-faktura o\'chirildi');
    } catch (error) {
      toast.error('Hisob-fakturani o\'chirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get invoices by status
  const getInvoicesByStatus = (status: Invoice['status']) => {
    return invoices.filter(invoice => invoice.status === status);
  };

  // Get overdue invoices
  const getOverdueInvoices = () => {
    const now = new Date();
    return invoices.filter(invoice => 
      invoice.status === 'sent' && 
      new Date(invoice.dueDate) < now
    );
  };

  // Calculate totals
  const calculateTotals = () => {
    const totals = invoices.reduce((acc, invoice) => {
      acc.total += invoice.totalAmount;
      acc.paid += invoice.paidAmount;
      acc.remaining += invoice.remainingAmount;
      acc.overdue += (invoice.status === 'sent' && new Date(invoice.dueDate) < new Date()) ? invoice.remainingAmount : 0;
      return acc;
    }, { total: 0, paid: 0, remaining: 0, overdue: 0 });

    return totals;
  };

  return {
    invoices,
    templates,
    isLoading,
    createInvoice,
    updateInvoice,
    sendInvoice,
    markAsPaid,
    deleteInvoice,
    getInvoicesByStatus,
    getOverdueInvoices,
    calculateTotals
  };
}

export default function InvoiceManager() {
  const { invoices, isLoading, markAsPaid, sendInvoice, deleteInvoice, getOverdueInvoices, calculateTotals } = useInvoice();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const totals = calculateTotals();
  const overdueInvoices = getOverdueInvoices();

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return <FileText className="w-4 h-4" />;
      case 'sent': return <Send className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <FileText className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Hisob-fakturalar
          </h3>
        </div>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Yangi hisob-faktura
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Jami summa</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
            {totals.total.toLocaleString('uz-UZ')} so'm
          </div>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-sm text-green-600 dark:text-green-400 mb-1">To'langan</div>
          <div className="text-xl font-bold text-green-900 dark:text-green-100">
            {totals.paid.toLocaleString('uz-UZ')} so'm
          </div>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Qolgan</div>
          <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
            {totals.remaining.toLocaleString('uz-UZ')} so'm
          </div>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-sm text-red-600 dark:text-red-400 mb-1">Muddati o'tgan</div>
          <div className="text-xl font-bold text-red-900 dark:text-red-100">
            {totals.overdue.toLocaleString('uz-UZ')} so'm
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Hali hech qanday hisob-faktura yo'q
            </p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusColor(invoice.status)}`}>
                    {getStatusIcon(invoice.status)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {invoice.clientName} • {invoice.totalAmount.toLocaleString('uz-UZ')} so'm
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(invoice.status)}`}>
                    {invoice.status === 'draft' && 'Qoralama'}
                    {invoice.status === 'sent' && 'Yuborilgan'}
                    {invoice.status === 'paid' && 'To\'langan'}
                    {invoice.status === 'overdue' && 'Muddati o\'tgan'}
                    {invoice.status === 'cancelled' && 'Bekor qilingan'}
                  </span>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => sendInvoice(invoice.id)}
                        className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                      <button
                        onClick={() => markAsPaid(invoice.id, invoice.remainingAmount)}
                        className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button className="p-1 text-gray-600 hover:text-gray-800 transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                    
                    <button className="p-1 text-gray-600 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Overdue Invoices Alert */}
      {overdueInvoices.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-900 dark:text-red-100">
              Muddati o'tgan hisob-fakturalar
            </span>
          </div>
          <div className="text-sm text-red-700 dark:text-red-300">
            {overdueInvoices.length} ta hisob-fakturaning muddati o'tgan, jami {totals.overdue.toLocaleString('uz-UZ')} so'm
          </div>
        </div>
      )}
    </div>
  );
}
