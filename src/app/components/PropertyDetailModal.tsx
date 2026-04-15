import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Property } from '../data/properties';
import { X, MapPin, Home, Bath, Maximize2, ChevronLeft, ChevronRight, AlertCircle, Phone, Building2, HomeIcon, Wallet, CreditCard, Landmark } from 'lucide-react';

interface PropertyDetailModalProps {
  property: Property;
  onClose: () => void;
}

export function PropertyDetailModal({ property, onClose }: PropertyDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'mortgage'>('cash');
  const [loanYears, setLoanYears] = useState(3);
  const [downPaymentPercent, setDownPaymentPercent] = useState(30);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  const getCategoryLabel = (categoryId: string) => {
    const labels: Record<string, string> = {
      apartment: 'Kvartira',
      house: 'Uy',
      cottage: 'Kottej',
      townhouse: 'Taunxaus',
      commercial: 'Tijorat',
      land: 'Yer',
    };
    return labels[categoryId] || 'Boshqa';
  };

  // Kredit/Ipoteka hisobi
  const calculateLoan = () => {
    const principal = property.price;
    let annualRate = 0;
    let loanAmount = principal;
    
    if (paymentType === 'credit') {
      annualRate = 0.24; // 24% yillik
    } else if (paymentType === 'mortgage') {
      annualRate = 0.18; // 18% yillik
      const downPayment = (principal * downPaymentPercent) / 100;
      loanAmount = principal - downPayment;
    }

    const monthlyRate = annualRate / 12;
    const numberOfPayments = loanYears * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    const totalPayment = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayment - loanAmount;

    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
      downPayment: paymentType === 'mortgage' ? Math.round((principal * downPaymentPercent) / 100) : 0,
      loanAmount: Math.round(loanAmount),
    };
  };

  const loanDetails = paymentType !== 'cash' ? calculateLoan() : null;

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 overflow-y-auto"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={onClose}
    >
      <div 
        className="min-h-screen"
        style={{
          background: isDark ? '#000000' : '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Section with Navigation */}
        <div className="relative w-full h-[50vh] sm:h-[60vh]">
          <img 
            src={property.images[currentImageIndex]} 
            alt={property.title}
            className="w-full h-full object-cover"
          />
          
          {/* Gradient Overlay */}
          <div 
            className="absolute inset-0"
            style={{
              background: isDark 
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)',
            }}
          />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 size-12 rounded-2xl flex items-center justify-center backdrop-blur-xl transition-all duration-300 active:scale-95 z-10"
            style={{
              background: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: isDark ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.1)',
            }}
          >
            <X className="size-6" style={{ color: isDark ? '#ffffff' : '#000000' }} />
          </button>

          {/* Category Badge */}
          <div 
            className="absolute top-4 left-4 px-4 py-2 rounded-xl font-bold text-sm"
            style={{
              background: accentColor.color,
              color: '#ffffff',
              boxShadow: `0 4px 16px ${accentColor.color}40`,
            }}
          >
            {getCategoryLabel(property.categoryId)}
          </div>

          {/* Image Navigation */}
          {property.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 size-12 rounded-full flex items-center justify-center backdrop-blur-xl transition-all duration-300 active:scale-95"
                style={{
                  background: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.1)',
                }}
              >
                <ChevronLeft className="size-6" style={{ color: isDark ? '#ffffff' : '#000000' }} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 size-12 rounded-full flex items-center justify-center backdrop-blur-xl transition-all duration-300 active:scale-95"
                style={{
                  background: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.1)',
                }}
              >
                <ChevronRight className="size-6" style={{ color: isDark ? '#ffffff' : '#000000' }} />
              </button>
            </>
          )}

          {/* Title and Location Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="text-2xl font-black mb-2" style={{ color: isDark ? '#ffffff' : '#ffffff' }}>
              {property.title}
            </h2>
            <div className="flex items-center gap-2">
              <MapPin className="size-5" style={{ color: isDark ? '#ffffff' : '#ffffff' }} />
              <span className="text-base font-semibold" style={{ color: isDark ? '#ffffff' : '#ffffff' }}>
                {property.district}
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-5 pb-8 pt-6" style={{ background: isDark ? '#000000' : '#ffffff' }}>
          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span 
                className="text-4xl font-black"
                style={{ color: accentColor.color }}
              >
                {property.price.toLocaleString()}
              </span>
              <span className="text-xl font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>USD</span>
            </div>
          </div>

          {/* Info Boxes */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div 
              className="p-3 rounded-xl flex flex-col items-center justify-center gap-1"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            >
              <Home className="size-5" style={{ color: accentColor.color }} />
              <span className="text-xl font-black" style={{ color: isDark ? '#ffffff' : '#000000' }}>{property.rooms}</span>
              <span className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Xona</span>
            </div>
            <div 
              className="p-3 rounded-xl flex flex-col items-center justify-center gap-1"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            >
              <Bath className="size-5" style={{ color: accentColor.color }} />
              <span className="text-xl font-black" style={{ color: isDark ? '#ffffff' : '#000000' }}>{Math.max(1, Math.floor(property.rooms / 2))}</span>
              <span className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Hammom</span>
            </div>
            <div 
              className="p-3 rounded-xl flex flex-col items-center justify-center gap-1"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            >
              <Maximize2 className="size-5" style={{ color: accentColor.color }} />
              <span className="text-xl font-black" style={{ color: isDark ? '#ffffff' : '#000000' }}>{property.area}</span>
              <span className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>m²</span>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-xl font-black mb-3" style={{ color: isDark ? '#ffffff' : '#000000' }}>Ta'rif</h3>
            <p className="text-sm leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
              {property.description}
            </p>
          </div>

          {/* Features */}
          {property.features.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-black mb-3" style={{ color: isDark ? '#ffffff' : '#000000' }}>Xususiyatlar</h3>
              <div className="grid grid-cols-2 gap-2">
                {property.features.map((feature, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <div 
                      className="size-1.5 rounded-full"
                      style={{ background: accentColor.color }}
                    />
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Options */}
          <div>
            <h3 className="text-xl font-black mb-4" style={{ color: isDark ? '#ffffff' : '#000000' }}>To'lov uslublari</h3>
            
            {/* Tabs */}
            <div 
              className="flex items-center gap-2 p-1.5 rounded-2xl mb-6"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
              }}
            >
              {[
                { id: 'cash', label: 'Naqd', Icon: Wallet },
                { id: 'credit', label: 'Kredit', Icon: CreditCard },
                { id: 'mortgage', label: 'Ipoteka', Icon: Landmark },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setPaymentType(option.id as any)}
                  className="flex-1 py-3 px-3 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: paymentType === option.id ? accentColor.color : 'transparent',
                    color: paymentType === option.id ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                    boxShadow: paymentType === option.id ? `0 4px 16px ${accentColor.color}40` : 'none',
                  }}
                >
                  <option.Icon className="size-5" />
                  {option.label}
                </button>
              ))}
            </div>

            {/* Cash Payment */}
            {paymentType === 'cash' && (
              <div 
                className="p-6 rounded-2xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.05)',
                }}
              >
                <h4 className="text-lg font-black mb-4" style={{ color: isDark ? '#ffffff' : '#000000' }}>Naqd to'lov</h4>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>To'liq narx:</span>
                  <span 
                    className="text-3xl font-black"
                    style={{ color: accentColor.color }}
                  >
                    {property.price.toLocaleString()} USD
                  </span>
                </div>
                <div 
                  className="flex items-start gap-3 p-4 rounded-xl"
                  style={{
                    background: 'rgba(255, 200, 0, 0.1)',
                    border: '1px solid rgba(255, 200, 0, 0.3)',
                  }}
                >
                  <AlertCircle className="size-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-yellow-100">
                    Naqd to'lovda maxsus chegirmalar mavjud!
                  </p>
                </div>
              </div>
            )}

            {/* Credit Payment */}
            {paymentType === 'credit' && loanDetails && (
              <div 
                className="p-6 rounded-2xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.05)',
                }}
              >
                <h4 className="text-lg font-black mb-4" style={{ color: isDark ? '#ffffff' : '#000000' }}>Kredit - 24% yillik</h4>
                
                {/* Period Selection */}
                <div className="mb-6">
                  <label className="text-sm font-bold block mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                    Kredit muddati:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 6, 12, 20].map((years) => (
                      <button
                        key={years}
                        onClick={() => setLoanYears(years)}
                        className="py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95"
                        style={{
                          background: loanYears === years ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                          color: loanYears === years ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                          boxShadow: loanYears === years ? `0 4px 12px ${accentColor.color}40` : (isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)'),
                        }}
                      >
                        {years} yil
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Oylik to'lov:</span>
                    <span 
                      className="text-xl font-black"
                      style={{ color: accentColor.color }}
                    >
                      {loanDetails.monthlyPayment.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Jami to'lov:</span>
                    <span className="text-base font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {loanDetails.totalPayment.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Ortiqcha to'lov:</span>
                    <span className="text-base font-bold text-red-400">
                      +{loanDetails.totalInterest.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mortgage Payment */}
            {paymentType === 'mortgage' && loanDetails && (
              <div 
                className="p-6 rounded-2xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.05)',
                }}
              >
                <h4 className="text-lg font-black mb-4" style={{ color: isDark ? '#ffffff' : '#000000' }}>Ipoteka - 18% yillik</h4>
                
                {/* Down Payment Slider */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                      Dastlabki to'lov: {downPaymentPercent}%
                    </label>
                    <span className="text-sm font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                      20% - 50%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="50"
                    value={downPaymentPercent}
                    onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: isDark
                        ? `linear-gradient(to right, ${accentColor.color} 0%, ${accentColor.color} ${(downPaymentPercent - 20) / 0.3}%, rgba(255, 255, 255, 0.2) ${(downPaymentPercent - 20) / 0.3}%, rgba(255, 255, 255, 0.2) 100%)`
                        : `linear-gradient(to right, ${accentColor.color} 0%, ${accentColor.color} ${(downPaymentPercent - 20) / 0.3}%, rgba(0, 0, 0, 0.1) ${(downPaymentPercent - 20) / 0.3}%, rgba(0, 0, 0, 0.1) 100%)`,
                    }}
                  />
                </div>

                {/* Period Selection */}
                <div className="mb-6">
                  <label className="text-sm font-bold block mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                    Ipoteka muddati:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 6, 12, 20].map((years) => (
                      <button
                        key={years}
                        onClick={() => setLoanYears(years)}
                        className="py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95"
                        style={{
                          background: loanYears === years ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                          color: loanYears === years ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                          boxShadow: loanYears === years ? `0 4px 12px ${accentColor.color}40` : (isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)'),
                        }}
                      >
                        {years} yil
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Dastlabki to'lov:</span>
                    <span 
                      className="text-lg font-black"
                      style={{ color: accentColor.color }}
                    >
                      {loanDetails.downPayment.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Kredit miqdori:</span>
                    <span className="text-base font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {loanDetails.loanAmount.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Oylik to'lov:</span>
                    <span 
                      className="text-xl font-black"
                      style={{ color: accentColor.color }}
                    >
                      {loanDetails.monthlyPayment.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Jami to'lov:</span>
                    <span className="text-base font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {loanDetails.totalPayment.toLocaleString()} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Ortiqcha to'lov:</span>
                    <span className="text-base font-bold text-red-400">
                      +{loanDetails.totalInterest.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Section */}
        <div 
          className="sticky bottom-0 left-0 right-0 p-5 mt-8"
          style={{
            background: isDark 
              ? 'linear-gradient(to top, #000000 80%, transparent)'
              : 'linear-gradient(to top, #ffffff 80%, transparent)',
          }}
        >
          <a
            href={`tel:${property.phone}`}
            className="w-full py-4 px-6 rounded-2xl font-black text-lg text-white text-center flex items-center justify-center gap-3 transition-all duration-300 active:scale-95"
            style={{
              background: accentColor.color,
              boxShadow: `0 8px 32px ${accentColor.color}80`,
            }}
          >
            <Phone className="size-6" />
            Qo'ng'iroq qilish
          </a>
        </div>
      </div>
    </div>
  );
}