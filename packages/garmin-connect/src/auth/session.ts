import { z } from "zod";
import { GarminInvalidResponseError } from "../http/errors.ts";

const oauth1TokenSchema = z.object({
  oauthToken: z.string().min(1),
  oauthTokenSecret: z.string().min(1),
  mfaToken: z.string().min(1).optional(),
});

const oauth2TokenSchema = z.object({
  accessToken: z.string().min(1),
  expiresAtEpochSeconds: z.number().int().positive(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAtEpochSeconds: z.number().int().positive(),
  scope: z.string(),
  tokenType: z.string().min(1),
});

const garminSessionSchema = z.object({
  oauth1: oauth1TokenSchema,
  oauth2: oauth2TokenSchema,
});

export type OAuth1Token = z.infer<typeof oauth1TokenSchema>;
export type OAuth2Token = z.infer<typeof oauth2TokenSchema>;
export type GarminSession = z.infer<typeof garminSessionSchema>;

export type SessionStore = {
  load(): Promise<GarminSession | null>;
  save(session: GarminSession): Promise<void>;
};

export function parseGarminSession(value: unknown): GarminSession {
  const result = garminSessionSchema.safeParse(value);

  if (!result.success) {
    throw new GarminInvalidResponseError("Stored Garmin session is invalid");
  }

  return result.data;
}
