import { Smartphone, Laptop, Headphones, Camera, Gamepad2, Grid3x3 } from 'lucide-react';

const categories = [
  { name: 'Barchasi', icon: Grid3x3 },
  { name: 'Telefonlar', icon: Smartphone },
  { name: 'Kompyuterlar', icon: Laptop },
  { name: 'Audio', icon: Headphones },
  { name: 'Kameralar', icon: Camera },
  { name: "O'yinlar", icon: Gamepad2 },
];

interface CategoriesProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function Categories({ selected, onSelect }: CategoriesProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto">
        {/* Horizontal scroll with snap */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selected === category.name;
            
            return (
              <button
                key={category.name}
                onClick={() => onSelect(category.name)}
                className={`
                  flex-shrink-0 snap-start flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl whitespace-nowrap transition-all border
                  ${isSelected 
                    ? 'bg-[#14b8a6] text-white border-[#14b8a6] shadow-lg shadow-[#14b8a6]/25' 
                    : 'bg-white/5 text-white/80 active:bg-white/10 border-white/10'
                  }
                `}
                style={{
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <Icon className="size-4" />
                <span className="text-sm">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}