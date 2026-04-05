import { ShoppingCart, Check, Package } from 'lucide-react';

export type CheckoutSuccessLine = { name: string; image?: string | null };

type Props = {
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  lines: CheckoutSuccessLine[];
  subtitle?: string;
};

export function CheckoutOrderSuccessAnimation({
  isDark,
  accentColor,
  lines,
  subtitle = "Tez orada siz bilan bog'lanamiz",
}: Props) {
  const display = lines.slice(0, 5);
  const extra = Math.max(0, lines.length - display.length);

  return (
    <>
      <style>{`
        @keyframes cos-cart-enter {
          0% { opacity: 0; transform: translate3d(-58%, 18px, 0) rotate(-16deg) scale(0.82); }
          70% { opacity: 1; transform: translate3d(6%, -6px, 0) rotate(4deg) scale(1.05); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0) scale(1); }
        }
        @keyframes cos-cart-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes cos-drop-in {
          0% { opacity: 0; transform: translate3d(0, 36px, 0) scale(0.5) rotate(-8deg); }
          60% { opacity: 1; transform: translate3d(0, -4px, 0) scale(1.08) rotate(3deg); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1) rotate(0); }
        }
        @keyframes cos-check-pop {
          0% { opacity: 0; transform: scale(0.15) rotate(-40deg); }
          75% { opacity: 1; transform: scale(1.15) rotate(6deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes cos-text-rise {
          0% { opacity: 0; transform: translateY(22px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cos-pulse-ring {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center px-4 py-6 text-center max-w-md mx-auto">
        <div
          className="relative mb-8 flex flex-col items-center"
          style={{
            animation: 'cos-cart-enter 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          <div
            className="relative"
            style={{
              animation: 'cos-cart-float 2.6s ease-in-out 0.9s infinite',
            }}
          >
            <div
              className="absolute inset-0 rounded-[2rem] -z-10"
              style={{
                animation: 'cos-pulse-ring 2s ease-out 1.2s infinite',
                background: `${accentColor.color}33`,
              }}
            />

            <div
              className="relative w-[200px] rounded-[1.75rem] border-2 overflow-hidden shadow-2xl"
              style={{
                borderColor: `${accentColor.color}66`,
                background: isDark
                  ? 'linear-gradient(165deg, rgba(30,30,30,0.95), rgba(12,12,12,0.98))'
                  : 'linear-gradient(165deg, #ffffff, #f1f5f9)',
              }}
            >
              <div
                className="flex items-center justify-center pt-5 pb-2"
                style={{ color: accentColor.color }}
              >
                <ShoppingCart className="w-[4.5rem] h-[4.5rem]" strokeWidth={1.35} />
              </div>

              <div className="flex flex-wrap gap-1.5 justify-center px-3 pb-3 min-h-[3.25rem] content-end">
                {display.map((line, i) => (
                  <div
                    key={`${line.name}-${i}`}
                    className="w-9 h-9 rounded-lg overflow-hidden border shrink-0 shadow-md"
                    style={{
                      borderColor: `${accentColor.color}55`,
                      opacity: 0,
                      animation: `cos-drop-in 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) ${0.55 + i * 0.14}s forwards`,
                    }}
                    title={line.name}
                  >
                    {line.image ? (
                      <img src={line.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: `${accentColor.color}18`, color: accentColor.color }}
                      >
                        <Package className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {extra > 0 ? (
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold border shrink-0"
                    style={{
                      borderColor: `${accentColor.color}55`,
                      color: accentColor.color,
                      background: `${accentColor.color}14`,
                      opacity: 0,
                      animation: `cos-drop-in 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) ${0.55 + display.length * 0.14}s forwards`,
                    }}
                  >
                    +{extra}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="absolute -right-1 -top-1 w-[3.25rem] h-[3.25rem] rounded-full flex items-center justify-center shadow-xl z-10"
              style={{
                background: accentColor.gradient,
                opacity: 0,
                animation: 'cos-check-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s forwards',
              }}
            >
              <Check className="w-7 h-7 text-white" strokeWidth={2.8} />
            </div>
          </div>
        </div>

        <h2
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{
            color: isDark ? '#ffffff' : '#0f172a',
            opacity: 0,
            animation: 'cos-text-rise 0.65s ease-out 1.45s forwards',
          }}
        >
          Buyurtma muvaffaqiyatli!
        </h2>
        <p
          className="text-sm sm:text-base max-w-xs leading-relaxed"
          style={{
            color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.62)',
            opacity: 0,
            animation: 'cos-text-rise 0.65s ease-out 1.58s forwards',
          }}
        >
          {subtitle}
        </p>
      </div>
    </>
  );
}
