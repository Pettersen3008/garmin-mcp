import {
  GarminAuthError,
  GarminInvalidResponseError,
  GarminNetworkError,
  GarminRateLimitError,
} from "@pettersen/garmin-connect";

export function success(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

export function failure(error: unknown) {
  const detail =
    error instanceof GarminAuthError
      ? { code: "auth", message: error.message }
      : error instanceof GarminRateLimitError
        ? { code: "rate_limit", message: error.message }
        : error instanceof GarminNetworkError
          ? { code: "network", message: error.message }
          : error instanceof GarminInvalidResponseError
            ? { code: "invalid_response", message: error.message }
            : error instanceof RangeError
              ? { code: "invalid_input", message: error.message }
              : { code: "internal", message: "Garmin tool failed" };
  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ error: detail }) },
    ],
    isError: true,
    structuredContent: { error: detail },
  };
}

export async function runTool(action: () => Promise<Record<string, unknown>>) {
  try {
    return success(await action());
  } catch (error) {
    return failure(error);
  }
}
