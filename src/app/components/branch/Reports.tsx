import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  Search, 
  RefreshCw, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Plus,
  X,
  Printer,
  Share2,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Users,
  ShoppingCart,
  Target,
  Activity,
  Award,
  Zap,
  Star,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FileSpreadsheet,
  FileImage,
  FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface Report {
  id: string;
  branchId: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  category: 'sales' | 'inventory' | 'employees' | 'customers' | 'financial' | 'performance';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  status: 'generating' | 'completed' | 'failed';
  description: string;
  parameters: {
    startDate: string;
    endDate: string;
    filters: Record<string, any>;
  };
  generatedAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  createdAt: string;
  createdBy: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  format: string;
  icon: string;
  parameters: Array<{
    name: string;
    type: 'date' | 'select' | 'number' | 'text';
    required: boolean;
    options?: string[];
  }>;
}

interface ReportsProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export function Reports({ branchId, branchInfo }: ReportsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportParams, setReportParams] = useState<Record<string, any>>({});
  const visibilityRefetchTick = useVisibilityTick();

  const loadReports = async () => {
    try {
      setIsLoading(true);
      console.log('📊 Loading reports for branch:', branchId);

      const params = new URLSearchParams({
        branchId,
        search: searchTerm,
        category: categoryFilter !== 'all' ? categoryFilter : '',
        status: statusFilter !== 'all' ? statusFilter : '',
      });
      const branchToken = getStoredBranchToken();
      if (branchToken) {
        params.set('branchToken', branchToken);
      }

      const response = await fetch(`${apiBaseUrl}/reports?${params}`, {
        headers: buildBranchHeaders({
          'Content-Type': 'application/json',
        }),
      });

      if (!response.ok) {
        setReports([]);
        console.error('❌ Reports API response not ok:', response.status, response.statusText);
        toast.error('Hisobotlarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setReports(data.reports);
        console.log('✅ Reports loaded from API');
      }
    } catch (error) {
      console.error('❌ Error loading reports:', error);
      toast.error('Hisobotlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const tplParams = new URLSearchParams();
      const branchTokenTpl = getStoredBranchToken();
      if (branchTokenTpl) {
        tplParams.set('branchToken', branchTokenTpl);
      }
      const tplQs = tplParams.toString();
      const response = await fetch(
        `${apiBaseUrl}/report-templates${tplQs ? `?${tplQs}` : ''}`,
        {
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
        },
      );

      if (!response.ok) {
        setTemplates([]);
        console.error('❌ Templates API response not ok:', response.status, response.statusText);
        toast.error('Shablonlarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('❌ Error loading templates:', error);
      toast.error('Shablonlarni yuklashda xatolik');
    }
  };

  useEffect(() => {
    loadReports();
    loadTemplates();
  }, [branchId, searchTerm, categoryFilter, statusFilter, visibilityRefetchTick]);

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;

    try {
      setIsGenerating(true);
      console.log('📊 Generating report:', selectedTemplate.name);

      const genParams = new URLSearchParams();
      const branchTokenGen = getStoredBranchToken();
      if (branchTokenGen) {
        genParams.set('branchToken', branchTokenGen);
      }
      const genQs = genParams.toString();
      const response = await fetch(
        `${apiBaseUrl}/reports/generate${genQs ? `?${genQs}` : ''}`,
        {
          method: 'POST',
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            templateId: selectedTemplate.id,
            branchId,
            parameters: reportParams,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Hisobotni generatsiya qilishda xatolik');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Hisobot generatsiya qilinmoqda');
        setShowGenerateModal(false);
        setSelectedTemplate(null);
        setReportParams({});
        loadReports();
      }
    } catch (error) {
      console.error('❌ Error generating report:', error);
      toast.error('Hisobotni generatsiya qilishda xatolik');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async (report: Report) => {
    try {
      if (report.downloadUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = report.downloadUrl;
        link.download = report.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Hisobot yuklandi');
      }
    } catch (error) {
      console.error('❌ Error downloading report:', error);
      toast.error('Hisobotni yuklashda xatolik');
    }
  };

  const handleShareReport = async (report: Report) => {
    try {
      if (navigator.share && report.downloadUrl) {
        await navigator.share({
          title: report.name,
          text: report.description,
          url: report.downloadUrl
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(report.downloadUrl || '');
        toast.success('Hisobot havolasi nusxalandi');
      }
    } catch (error) {
      console.error('❌ Error sharing report:', error);
      toast.error('Hisobotni ulashishda xatolik');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'generating': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Bajarildi';
      case 'generating': return 'Generatsiya qilinmoqda';
      case 'failed': return 'Xatolik';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'generating': return Clock;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales': return ShoppingCart;
      case 'inventory': return FileSpreadsheet;
      case 'employees': return Users;
      case 'customers': return Star;
      case 'financial': return DollarSign;
      case 'performance': return Activity;
      default: return FileText;
    }
  };

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'sales': return 'Sotuvlar';
      case 'inventory': return 'Inventarizatsiya';
      case 'employees': return 'Xodimlar';
      case 'customers': return 'Mijozlar';
      case 'financial': return 'Moliyaviy';
      case 'performance': return 'Samaradorlik';
      default: return category;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return FileText;
      case 'excel': return FileSpreadsheet;
      case 'csv': return FileCheck;
      case 'json': return FileText;
      default: return FileText;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Hisobotlar yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Hisobotlar</h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Filial hisobotlarini generatsiya qilish va boshqarish
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              background: accentColor.gradient,
              color: '#ffffff'
            }}
          >
            <Plus className="w-4 h-4" />
            Yangi hisobot
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} />
            <input
              type="text"
              placeholder="Hisobot nomi orqali qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            />
          </div>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barcha kategoriyalar</option>
          <option value="sales">Sotuvlar</option>
          <option value="inventory">Inventarizatsiya</option>
          <option value="employees">Xodimlar</option>
          <option value="customers">Mijozlar</option>
          <option value="financial">Moliyaviy</option>
          <option value="performance">Samaradorlik</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barcha holatlar</option>
          <option value="completed">Bajarildi</option>
          <option value="generating">Generatsiya qilinmoqda</option>
          <option value="failed">Xatolik</option>
        </select>
        <button
          onClick={loadReports}
          className="p-2 rounded-xl border transition-all hover:shadow-lg"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const CategoryIcon = getCategoryIcon(report.category);
          const FormatIcon = getFormatIcon(report.format);
          const StatusIcon = getStatusIcon(report.status);
          
          return (
            <div 
              key={report.id}
              className="p-6 rounded-2xl border transition-all hover:shadow-lg"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <CategoryIcon className="w-6 h-6" style={{ color: accentColor.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{report.name}</h3>
                    <p className="text-sm" style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                    }}>
                      {report.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{
                      background: `${getStatusColor(report.status)}20`,
                      color: getStatusColor(report.status)
                    }}
                  >
                    {getStatusText(report.status)}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">{getCategoryText(report.category)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FormatIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm uppercase">{report.format}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Yaratilgan:
                  </span>
                  <span>{formatDate(report.createdAt)}</span>
                </div>

                {report.generatedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                    }}>
                      Generatsiya qilingan:
                    </span>
                    <span>{formatDate(report.generatedAt)}</span>
                  </div>
                )}

                {report.fileSize && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                    }}>
                      Hajmi:
                    </span>
                    <span>{formatFileSize(report.fileSize)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {report.status === 'completed' && (
                  <>
                    <button
                      onClick={() => handleDownloadReport(report)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border text-sm transition-all hover:shadow-lg"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Yuklash
                    </button>
                    <button
                      onClick={() => handleShareReport(report)}
                      className="p-2 rounded-lg border transition-all hover:shadow-lg"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {report.status === 'generating' && (
                  <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generatsiya qilinmoqda...
                  </div>
                )}
                {report.status === 'failed' && (
                  <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm text-red-500"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Xatolik yuz berdi
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-2xl p-6 rounded-2xl max-h-[80vh] overflow-y-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Yangi hisobot generatsiya qilish</h2>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setSelectedTemplate(null);
                  setReportParams({});
                }}
                className="p-2 rounded-lg border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!selectedTemplate ? (
              <div>
                <h3 className="font-semibold mb-4">Hisobot shablonini tanlang</h3>
                <div className="space-y-3">
                  {templates.map((template) => {
                    const CategoryIcon = getCategoryIcon(template.category);
                    
                    return (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-3 rounded-lg"
                            style={{ background: `${accentColor.color}20` }}
                          >
                            <CategoryIcon className="w-6 h-6" style={{ color: accentColor.color }} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{template.name}</h4>
                            <p className="text-sm" style={{ 
                              color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                            }}>
                              {template.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span style={{ color: accentColor.color }}>
                                {getCategoryText(template.category)}
                              </span>
                              <span style={{ color: accentColor.color }}>
                                {template.type}
                              </span>
                              <span style={{ color: accentColor.color }}>
                                {template.format.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">{selectedTemplate.name}</h3>
                  <p className="text-sm" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    {selectedTemplate.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {selectedTemplate.parameters.map((param, index) => (
                    <div key={index}>
                      <label className="block text-sm font-medium mb-1">
                        {param.name} {param.required && '*'}
                      </label>
                      {param.type === 'date' ? (
                        <input
                          type="date"
                          value={reportParams[param.name] || ''}
                          onChange={(e) => setReportParams({ ...reportParams, [param.name]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                          }}
                        />
                      ) : param.type === 'select' ? (
                        <select
                          value={reportParams[param.name] || ''}
                          onChange={(e) => setReportParams({ ...reportParams, [param.name]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                          }}
                        >
                          <option value="">Tanlang...</option>
                          {param.options?.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={reportParams[param.name] || ''}
                          onChange={(e) => setReportParams({ ...reportParams, [param.name]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="flex-1 py-2 rounded-xl border font-medium transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    Orqaga
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="flex-1 py-2 rounded-xl font-medium transition-all"
                    style={{
                      background: isGenerating ? '#6b7280' : accentColor.gradient,
                      color: '#ffffff'
                    }}
                  >
                    {isGenerating ? 'Generatsiya qilinmoqda...' : 'Generatsiya qilish'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
