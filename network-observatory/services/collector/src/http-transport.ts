import type { Observation } from "../../../packages/contracts/src/index.ts";
import type { ObservationTransport } from "./types.ts";

export class CollectorTransportError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "CollectorTransportError";
    this.status = status;
  }
}

export interface HttpObservationTransportOptions {
  baseUrl: string;
  collectorId: string;
  token: string;
  timeoutMs?: number;
  /** Must remain false until TLS and external deployment policies exist. */
  allowNonLocalhost?: false;
}

function assertLocalBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (url.protocol !== "http:" || !localHosts.has(url.hostname)) {
    throw new CollectorTransportError(
      "Collector HTTP v0.1 accepts only http://localhost, http://127.0.0.1 or http://[::1]",
    );
  }
  return url;
}

export class HttpObservationTransport implements ObservationTransport {
  private readonly baseUrl: URL;
  private readonly collectorId: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: HttpObservationTransportOptions) {
    this.baseUrl = assertLocalBaseUrl(options.baseUrl);
    this.collectorId = options.collectorId;
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    if (!this.token) throw new CollectorTransportError("Collector token is required");
  }

  async send(observations: readonly Observation[]): Promise<readonly string[]> {
    const endpoint = new URL(
      `/v1/collectors/${encodeURIComponent(this.collectorId)}/observations`,
      this.baseUrl,
    );
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ observations }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new CollectorTransportError(
        `Control Plane unavailable: ${error instanceof Error ? error.message : "network error"}`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CollectorTransportError("Control Plane returned invalid JSON", response.status);
    }
    if (!response.ok) {
      const apiError = body as { error?: { code?: string; message?: string } };
      throw new CollectorTransportError(
        apiError.error?.message ?? `Control Plane rejected the request (${response.status})`,
        response.status,
      );
    }

    const result = body as { acknowledgedIdempotencyKeys?: unknown };
    if (
      !Array.isArray(result.acknowledgedIdempotencyKeys) ||
      !result.acknowledgedIdempotencyKeys.every((item) => typeof item === "string")
    ) {
      throw new CollectorTransportError(
        "Control Plane response is missing acknowledgedIdempotencyKeys",
        response.status,
      );
    }
    return result.acknowledgedIdempotencyKeys;
  }
}
