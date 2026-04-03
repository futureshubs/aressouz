/** Production buildda konsolni ifloslamaslik uchun faqat dev rejimida log */
export function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
