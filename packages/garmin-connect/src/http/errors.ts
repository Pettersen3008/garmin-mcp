export class GarminError extends Error {
  override readonly name: string = "GarminError";
}

export class GarminAuthError extends GarminError {
  override readonly name = "GarminAuthError";
}

export class GarminRateLimitError extends GarminError {
  override readonly name = "GarminRateLimitError";
}

export class GarminNetworkError extends GarminError {
  override readonly name = "GarminNetworkError";
}

export class GarminHttpError extends GarminError {
  override readonly name = "GarminHttpError";
  readonly status: number;

  constructor(status: number) {
    super(`Garmin request failed with HTTP ${status}`);
    this.status = status;
  }
}

export class GarminInvalidResponseError extends GarminError {
  override readonly name = "GarminInvalidResponseError";
}
