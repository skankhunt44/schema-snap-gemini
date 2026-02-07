import { ColumnProfile, DataType } from '../types/schema';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isBoolean = (v: string) => /^(true|false|yes|no|0|1)$/i.test(v);
const isCurrency = (v: string) => /^[\$€£]\s?\d+(,\d{3})*(\.\d+)?$/.test(v);
const isDateLike = (v: string) => {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.valueOf());
};

const normalizeValue = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

export const inferColumnProfile = (name: string, values: unknown[]): ColumnProfile => {
  const cleaned = values.map(normalizeValue).filter(Boolean);
  const total = values.length || 1;
  const nulls = values.length - cleaned.length;

  let numberCount = 0;
  let booleanCount = 0;
  let dateCount = 0;
  let uuidCount = 0;
  let currencyCount = 0;

  for (const v of cleaned) {
    if (UUID_REGEX.test(v)) uuidCount++;
    if (isCurrency(v)) currencyCount++;
    if (isBoolean(v)) booleanCount++;
    if (!Number.isNaN(Number(v))) numberCount++;
    if (isDateLike(v)) dateCount++;
  }

  const ratio = (n: number) => (cleaned.length ? n / cleaned.length : 0);

  let dataType: DataType = 'string';
  if (ratio(uuidCount) >= 0.8) dataType = 'uuid';
  else if (ratio(currencyCount) >= 0.8) dataType = 'currency';
  else if (ratio(numberCount) >= 0.8) dataType = 'number';
  else if (ratio(booleanCount) >= 0.8) dataType = 'boolean';
  else if (ratio(dateCount) >= 0.8) dataType = 'date';

  const unique = new Set(cleaned);
  const sampleValues = Array.from(unique).slice(0, 5).map(v => (dataType === 'number' ? Number(v) : v));

  return {
    name,
    dataType,
    nullRatio: nulls / total,
    uniqueRatio: cleaned.length ? unique.size / cleaned.length : 0,
    sampleValues
  };
};
