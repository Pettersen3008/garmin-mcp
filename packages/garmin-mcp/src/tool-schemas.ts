import { z } from "zod";

export const readOnly = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
};
export const write = { ...readOnly, readOnlyHint: false };
export const destructive = { ...write, destructiveHint: true };

export const approval =
  "Only set confirm=true after the user has explicitly approved this exact change.";
export const confirm = z.literal(true);
export const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Local calendar date, YYYY-MM-DD");
export const dateInput = z.object({ date: localDate });
export const garminId = z.string().regex(/^[1-9]\d*$/);
