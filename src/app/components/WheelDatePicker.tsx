import { useRef, useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { useTheme } from '../context/ThemeContext';

interface WheelDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  className?: string;
  style?: CSSProperties;
}

export function WheelDatePicker({ value, onChange, className = '', style }: WheelDatePickerProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Parse initial value
  const parseDate = (dateStr: string) => {
    if (!dateStr) return { day: 1, month: 1, year: new Date().getFullYear() - 20 };
    const [year, month, day] = dateStr.split('-').map(Number);
    return { day: day || 1, month: month || 1, year: year || new Date().getFullYear() - 20 };
  };

  const initialDate = parseDate(value);
  const [selectedDay, setSelectedDay] = useState(initialDate.day);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.month);
  const [selectedYear, setSelectedYear] = useState(initialDate.year);

  const dayRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  const months = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  };
  const days = Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, i) => i + 1);

  // Update parent when values change
  useEffect(() => {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onChange(dateStr);
  }, [selectedDay, selectedMonth, selectedYear, onChange]);

  const handleScroll = (ref: HTMLDivElement, setValue: (val: number) => void, items: any[]) => {
    const scrollTop = ref.scrollTop;
    const itemHeight = 44;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    
    // Snap to position
    ref.scrollTo({
      top: clampedIndex * itemHeight,
      behavior: 'smooth'
    });

    setValue(typeof items[clampedIndex] === 'number' ? items[clampedIndex] : clampedIndex + 1);
  };

  // Debounced scroll handler to prevent excessive updates
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedScroll = (ref: HTMLDivElement, setValue: (val: number) => void, items: any[]) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      handleScroll(ref, setValue, items);
    }, 50); // Reduced timeout for better responsiveness
  };

  useEffect(() => {
    const dayEl = dayRef.current;
    const monthEl = monthRef.current;
    const yearEl = yearRef.current;

    if (!dayEl || !monthEl || !yearEl) return;

    // Initial scroll position
    const itemHeight = 44;
    dayEl.scrollTop = (selectedDay - 1) * itemHeight;
    monthEl.scrollTop = (selectedMonth - 1) * itemHeight;
    yearEl.scrollTop = years.indexOf(selectedYear) * itemHeight;

    const dayScrollHandler = () => debouncedScroll(dayEl!, setSelectedDay, days);
    const monthScrollHandler = () => debouncedScroll(monthEl!, setSelectedMonth, months);
    const yearScrollHandler = () => debouncedScroll(yearEl!, setSelectedYear, years);

    // Add touch support for mobile devices
    const dayTouchHandler = () => debouncedScroll(dayEl!, setSelectedDay, days);
    const monthTouchHandler = () => debouncedScroll(monthEl!, setSelectedMonth, months);
    const yearTouchHandler = () => debouncedScroll(yearEl!, setSelectedYear, years);

    dayEl.addEventListener('scroll', dayScrollHandler);
    monthEl.addEventListener('scroll', monthScrollHandler);
    yearEl.addEventListener('scroll', yearScrollHandler);
    
    // Touch events for mobile
    dayEl.addEventListener('touchend', dayTouchHandler);
    monthEl.addEventListener('touchend', monthTouchHandler);
    yearEl.addEventListener('touchend', yearTouchHandler);

    return () => {
      dayEl.removeEventListener('scroll', dayScrollHandler);
      monthEl.removeEventListener('scroll', monthScrollHandler);
      yearEl.removeEventListener('scroll', yearScrollHandler);
      dayEl.removeEventListener('touchend', dayTouchHandler);
      monthEl.removeEventListener('touchend', monthTouchHandler);
      yearEl.removeEventListener('touchend', yearTouchHandler);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [days.length, selectedDay, selectedMonth, selectedYear, years]);

  const WheelColumn = ({ 
    items, 
    selectedIndex, 
    scrollRef, 
    type 
  }: { 
    items: any[]; 
    selectedIndex: number; 
    scrollRef: RefObject<HTMLDivElement | null>; 
    type: 'day' | 'month' | 'year' 
  }) => (
    <div className="flex-1 relative">
      <div 
        ref={scrollRef}
        className="h-[220px] overflow-y-scroll scrollbar-hide relative"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Top padding */}
        <div style={{ height: '88px' }} />
        
        {items.map((item, index) => {
          const displayValue = type === 'month' ? item : item;
          const actualIndex = type === 'year' ? years.indexOf(item) : (type === 'month' ? index : item - 1);
          const isSelected = type === 'year' 
            ? item === selectedYear 
            : (type === 'month' 
              ? index + 1 === selectedMonth 
              : item === selectedDay);
          
          return (
            <div
              key={index}
              className="flex items-center justify-center transition-all"
              style={{
                height: '44px',
                scrollSnapAlign: 'center',
                fontSize: isSelected ? '20px' : '16px',
                fontWeight: isSelected ? 600 : 400,
                color: isSelected 
                  ? (isDark ? '#ffffff' : '#111827')
                  : (isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'),
                opacity: isSelected ? 1 : 0.4,
              }}
            >
              {displayValue}
            </div>
          );
        })}
        
        {/* Bottom padding */}
        <div style={{ height: '88px' }} />
      </div>

      {/* Selection indicator */}
      <div 
        className="absolute top-1/2 left-0 right-0 pointer-events-none"
        style={{
          transform: 'translateY(-50%)',
          height: '44px',
          borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
          background: isDark 
            ? 'linear-gradient(to bottom, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(to bottom, rgba(0, 0, 0, 0.01), rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.01))',
        }}
      />

      {/* Top fade */}
      <div 
        className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent)'
            : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), transparent)',
        }}
      />

      {/* Bottom fade */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent)'
            : 'linear-gradient(to top, rgba(255, 255, 255, 0.9), transparent)',
        }}
      />
    </div>
  );

  return (
    <div
      className={`w-full rounded-2xl p-4 ${className}`.trim()}
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
          : 'linear-gradient(145deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.01))',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
        ...style,
      }}
    >
      <div className="flex gap-2">
        <WheelColumn items={days} selectedIndex={selectedDay - 1} scrollRef={dayRef} type="day" />
        <WheelColumn items={months} selectedIndex={selectedMonth - 1} scrollRef={monthRef} type="month" />
        <WheelColumn items={years} selectedIndex={years.indexOf(selectedYear)} scrollRef={yearRef} type="year" />
      </div>
    </div>
  );
}
