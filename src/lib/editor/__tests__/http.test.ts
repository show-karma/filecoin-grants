import { describe, expect, it } from "vitest";
import { sameOrigin } from "../http";

const req = (headers: Record<string, string>, method = "POST") =>
  new Request("https://filpgf-abc123.vercel.app/api/editor/login", {
    method,
    headers,
  });

describe("sameOrigin", () => {
  it("accepts a write from the site's own host, as the proxy forwards it", () => {
    expect(
      sameOrigin(
        req({
          origin: "https://www.filpgf.io",
          "x-forwarded-host": "www.filpgf.io",
          host: "filpgf-abc123.vercel.app",
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        req({ origin: "http://localhost:4321", host: "localhost:4321" }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(req({ origin: "https://filpgf-abc123.vercel.app" })),
    ).toBe(true);
  });

  it("refuses another site, a missing origin, and a malformed one", () => {
    expect(
      sameOrigin(
        req({
          origin: "https://evil.example",
          "x-forwarded-host": "www.filpgf.io",
        }),
      ),
    ).toBe(false);
    expect(sameOrigin(req({ "x-forwarded-host": "www.filpgf.io" }))).toBe(
      false,
    );
    expect(sameOrigin(req({ origin: "null", host: "www.filpgf.io" }))).toBe(
      false,
    );
  });

  it("lets reads through", () => {
    expect(sameOrigin(req({}, "GET"))).toBe(true);
  });
});
