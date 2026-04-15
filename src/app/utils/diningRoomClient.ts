/** Mijoz va restoran paneli: xona sig‘imi / rasmlar (KV `dining_room:*`) */

export function diningRoomCapacityRange(
  room: Record<string, unknown> | null | undefined,
): { min: number; max: number } {
  if (!room) return { min: 1, max: 50 };
  const max = Math.min(200, Math.max(1, Math.floor(Number(room.capacityMax ?? room.capacity) || 4)));
  const min = Math.min(max, Math.max(1, Math.floor(Number(room.capacityMin) || 1)));
  return { min, max };
}

export function formatDiningRoomCapacityLabel(room: Record<string, unknown> | null | undefined): string {
  const { min, max } = diningRoomCapacityRange(room);
  if (min === max) return `${max} kishilik`;
  return `${min}–${max} kishilik`;
}

export function diningRoomImageList(room: Record<string, unknown> | null | undefined): string[] {
  if (!room || !Array.isArray(room.images)) return [];
  return room.images
    .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
    .map((u) => u.trim())
    .slice(0, 4);
}
