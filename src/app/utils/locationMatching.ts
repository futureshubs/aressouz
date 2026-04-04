import { regions } from '../data/regions';

type LocationRecord = Record<string, unknown>;

interface SelectedLocationOptions {
  selectedRegionId?: string;
  selectedDistrictId?: string;
}

const normalizeLocationValue = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[`'’‘ʻʼ-]/g, '')
    .replace(/\s+/g, '');

const getRegionNameById = (regionId?: string) =>
  regions.find(region => region.id === regionId)?.name ?? '';

const getDistrictNameById = (regionId?: string, districtId?: string) =>
  regions
    .find(region => region.id === regionId)
    ?.districts.find(district => district.id === districtId)?.name ?? '';

const collectFieldValues = (item: LocationRecord, fieldNames: string[]) =>
  fieldNames
    .map(fieldName => item[fieldName])
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string | number => value !== undefined && value !== null && value !== '');

const matchesAnyCandidate = (itemValues: Array<string | number>, selectedValues: string[]) => {
  if (selectedValues.length === 0) {
    return true;
  }

  const normalizedItemValues = itemValues.map(normalizeLocationValue).filter(Boolean);
  if (normalizedItemValues.length === 0) {
    return false;
  }

  return normalizedItemValues.some(itemValue =>
    selectedValues.some(
      selectedValue =>
        itemValue === selectedValue ||
        itemValue.includes(selectedValue) ||
        selectedValue.includes(itemValue)
    )
  );
};

export const matchesSelectedLocation = (
  item: LocationRecord,
  { selectedRegionId, selectedDistrictId }: SelectedLocationOptions,
  regionFieldNames = ['region', 'regionId', 'region_id'],
  districtFieldNames = ['district', 'districtId', 'district_id']
) => {
  const selectedRegionValues = [selectedRegionId, getRegionNameById(selectedRegionId)]
    .map(normalizeLocationValue)
    .filter(Boolean);

  const selectedDistrictValues = [selectedDistrictId, getDistrictNameById(selectedRegionId, selectedDistrictId)]
    .map(normalizeLocationValue)
    .filter(Boolean);

  const regionMatches = matchesAnyCandidate(collectFieldValues(item, regionFieldNames), selectedRegionValues);
  if (!regionMatches) {
    return false;
  }

  return matchesAnyCandidate(collectFieldValues(item, districtFieldNames), selectedDistrictValues);
};

/**
 * Filial paneli: branchId bo'sh restoranlarni filial hududida ko'rsatish (FoodsView bilan bir xil mintaqa).
 * Kamida bitta viloyat va bitta tuman hint'i bo'lishi kerak.
 */
export function restaurantMatchesBranchArea(
  item: LocationRecord,
  opts: {
    regionId?: string;
    districtId?: string;
    regionName?: string;
    districtName?: string;
  },
): boolean {
  const regionHints = [
    opts.regionId,
    opts.regionName,
    getRegionNameById(opts.regionId),
  ]
    .map(normalizeLocationValue)
    .filter(Boolean);
  const districtHints = [
    opts.districtId,
    opts.districtName,
    getDistrictNameById(opts.regionId, opts.districtId),
  ]
    .map(normalizeLocationValue)
    .filter(Boolean);

  if (regionHints.length === 0 || districtHints.length === 0) {
    return false;
  }

  const regionMatches = matchesAnyCandidate(
    collectFieldValues(item, ['region', 'regionId', 'region_id']),
    regionHints,
  );
  if (!regionMatches) return false;

  return matchesAnyCandidate(
    collectFieldValues(item, ['district', 'districtId', 'district_id']),
    districtHints,
  );
}
