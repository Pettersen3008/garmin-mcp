import {
  GarminAuthError,
  GarminHttpError,
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

function errorCode(error: unknown): string {
  if (error instanceof GarminAuthError) return "auth";
  if (error instanceof GarminRateLimitError) return "rate_limit";
  if (error instanceof GarminNetworkError) return "network";
  if (error instanceof GarminInvalidResponseError) return "invalid_response";
  if (error instanceof GarminHttpError) {
    if (error.status === 404) return "not_found";
    return error.status < 500 ? "invalid_request" : "upstream";
  }
  if (error instanceof RangeError) return "invalid_input";
  return "internal";
}

export function failure(error: unknown) {
  const code = errorCode(error);
  if (code === "internal") {
    console.error(error);
  }
  const detail = {
    code,
    message:
      code === "internal" || !(error instanceof Error) ? "Garmin tool failed" : error.message,
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: detail }) }],
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
