import { MapPin, Camera, Loader2 } from 'lucide-react';

type RentalJob = Record<string, unknown>;

/** Yetkazish yoki faol ijara kartochkasida — garov + rasmlar + yuklash */
export function RentalCourierDepositBlock({
  job,
  isDark,
  mutedTextColor,
  depositBusyId,
  onDepositPhoto,
}: {
  job: RentalJob;
  isDark: boolean;
  mutedTextColor: string;
  depositBusyId: string | null;
  onDepositPhoto: (job: RentalJob, file: File) => void;
}) {
  const id = String(job.id || '');
  const depDesc = String(job.depositDescription || '').trim();
  const depAmt = Math.max(0, Math.round(Number(job.depositAmountUzs) || 0));
  const urls = Array.isArray(job.depositPhotoUrls) ? (job.depositPhotoUrls as string[]) : [];

  return (
    <>
      <div
        className="rounded-lg px-2 py-1.5 text-xs space-y-0.5"
        style={{
          background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)'}`,
        }}
      >
        <p className="font-bold text-amber-700 dark:text-amber-400">Garov</p>
        {depDesc ? <p style={{ color: mutedTextColor }}>{depDesc}</p> : null}
        {depAmt > 0 ? (
          <p className="font-semibold tabular-nums">{depAmt.toLocaleString('uz-UZ')} so‘m</p>
        ) : !depDesc ? (
          <p style={{ color: mutedTextColor }}>—</p>
        ) : null}
      </div>
      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <a
              key={`${u}-${i}`}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-14 h-14 rounded-lg overflow-hidden border shrink-0"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}
            >
              <img src={u} alt="" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      <label
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold border transition-opacity disabled:opacity-50 ${depositBusyId === id ? 'cursor-wait' : 'cursor-pointer'}`}
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          color: mutedTextColor,
        }}
      >
        {depositBusyId === id ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        ) : (
          <Camera className="w-4 h-4 shrink-0" />
        )}
        {depositBusyId === id ? 'Yuklanmoqda…' : 'Garov rasmini qo‘shish'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={depositBusyId === id}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onDepositPhoto(job, f);
              e.target.value = '';
            }
          }}
        />
      </label>
    </>
  );
}

export function RentalCourierDeliveryJobCard({
  job,
  isDark,
  mutedTextColor,
  deliverBusyId,
  depositBusyId,
  onDelivered,
  onDepositPhoto,
}: {
  job: RentalJob;
  isDark: boolean;
  mutedTextColor: string;
  deliverBusyId: string | null;
  depositBusyId: string | null;
  onDelivered: (job: RentalJob) => void;
  onDepositPhoto: (job: RentalJob, file: File) => void;
}) {
  const id = String(job.id || '');
  const deliveryAddr = String(job.deliveryAddress || job.address || '').trim();
  const pickupAddr = String(job.pickupAddress || '').trim();

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{
        background: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      <p className="font-semibold text-sm">{String(job.productName || 'Ijara')}</p>
      <p className="text-[10px] font-mono opacity-45 break-all">ID: {id}</p>
      <p className="text-xs" style={{ color: mutedTextColor }}>
        {String(job.customerName || '—')} · {String(job.customerPhone || '—')}
      </p>
      {job.totalPrice != null && Number(job.totalPrice) > 0 ? (
        <p className="text-xs font-semibold tabular-nums">
          {Number(job.totalPrice).toLocaleString('uz-UZ')} so‘m
          {job.duration ? (
            <span className="font-normal opacity-70"> · {String(job.duration)}</span>
          ) : null}
        </p>
      ) : job.duration ? (
        <p className="text-xs opacity-80">{String(job.duration)}</p>
      ) : null}
      {pickupAddr ? (
        <p className="text-xs flex gap-1 font-medium" style={{ color: '#0d9488' }}>
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <span className="opacity-80">Olib ketish:</span> {pickupAddr}
          </span>
        </p>
      ) : null}
      {deliveryAddr ? (
        <p className="text-xs flex gap-1" style={{ color: mutedTextColor }}>
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <span className="font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : '#374151' }}>
              Mijozga:
            </span>{' '}
            {deliveryAddr}
          </span>
        </p>
      ) : null}
      <RentalCourierDepositBlock
        job={job}
        isDark={isDark}
        mutedTextColor={mutedTextColor}
        depositBusyId={depositBusyId}
        onDepositPhoto={onDepositPhoto}
      />
      <button
        type="button"
        disabled={deliverBusyId === id}
        onClick={() => onDelivered(job)}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed"
        style={{ background: '#d97706' }}
      >
        {deliverBusyId === id ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        ) : null}
        {deliverBusyId === id ? 'Yuborilmoqda...' : 'Mijozga yetkazildi'}
      </button>
    </div>
  );
}
