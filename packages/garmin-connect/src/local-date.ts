declare const localDateBrand: unique symbol;

export type LocalDate = string & { readonly [localDateBrand]: true };

const localDatePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export function parseLocalDate(value: string): LocalDate {
  const timestamp = Date.parse(`${value}T00:00:00Z`);

  if (
    !localDatePattern.test(value) ||
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError("Expected a valid calendar date in YYYY-MM-DD format");
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the checks above are what make this a LocalDate
  return value as LocalDate;
}
