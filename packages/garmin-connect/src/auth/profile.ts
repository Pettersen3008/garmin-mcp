import { z } from "zod";
import { GarminInvalidResponseError } from "../http/errors.ts";
import type { GetJson } from "../http/request.ts";

const profileSchema = z.object({ displayName: z.string().min(1) });

export async function getProfileDisplayName(getJson: GetJson): Promise<string> {
  const result = profileSchema.safeParse(
    await getJson({ path: "/userprofile-service/socialProfile" }),
  );
  if (!result.success) {
    throw new GarminInvalidResponseError("Garmin returned an invalid profile");
  }
  return result.data.displayName;
}
