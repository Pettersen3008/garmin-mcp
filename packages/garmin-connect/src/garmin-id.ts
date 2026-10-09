import { z } from "zod";

const idPattern = /^[1-9]\d*$/;

export const garminIdSchema = z
  .union([
    z.string().regex(idPattern),
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  ])
  .transform(String);

export function assertGarminId(id: string, label: string): void {
  if (!idPattern.test(id)) {
    throw new RangeError(`${label} must be a positive decimal string`);
  }
}
