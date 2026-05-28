const PREFIX = '[Rasm yuklash]';

/** Rasm/video yuklash diagnostikasi — brauzer konsolida qidirish: `[Rasm yuklash]` */
export function uploadDebugLog(
  stage: string,
  detail?: Record<string, unknown> | string,
): void {
  const payload =
    typeof detail === 'string'
      ? detail
      : detail != null
        ? detail
        : undefined;
  console.log(PREFIX, stage, payload ?? '');
}

export function uploadDebugError(
  stage: string,
  detail?: Record<string, unknown> | unknown,
): void {
  console.error(PREFIX, stage, detail ?? '');
}
