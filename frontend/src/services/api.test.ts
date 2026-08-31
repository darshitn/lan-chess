import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchHealth } from "./api";

describe("fetchHealth", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns parsed health on 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ status: "ok", version: "0.1.0", environment: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ) as unknown as typeof fetch);

    const data = await fetchHealth();
    expect(data.status).toBe("ok");
    expect(data.version).toBe("0.1.0");
  });

  it("throws on non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })) as unknown as typeof fetch);
    await expect(fetchHealth()).rejects.toThrow(/Health check failed/);
  });
});
