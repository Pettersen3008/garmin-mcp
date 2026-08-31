export class GarminAuthError extends Error {
  override readonly name = "GarminAuthError";
}

export class GarminRateLimitError extends Error {
  override readonly name = "GarminRateLimitError";
}

export class GarminNetworkError extends Error {
  override readonly name = "GarminNetworkError";
}

export class GarminInvalidResponseError extends Error {
  override readonly name = "GarminInvalidResponseError";
}
