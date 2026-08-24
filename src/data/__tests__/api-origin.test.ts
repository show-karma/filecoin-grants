import { afterEach, describe, expect, it } from "vitest";
import { KARMA } from "../site";
import { apiOrigin } from "../../lib/api-origin";

/**
 * One indexer serves `/v2/communities/*`, `/v2/kernel/*` and
 * `/v2/indicators/*`, so there is one origin for all of them. These pin that:
 * a second variable would let a deployment point half the page at one host and
 * half at another.
 */
describe("apiOrigin", () => {
  const original = process.env.KARMA_API_ORIGIN;

  afterEach(() => {
    if (original === undefined) delete process.env.KARMA_API_ORIGIN;
    else process.env.KARMA_API_ORIGIN = original;
  });

  it("falls back to the committed production host when unset", () => {
    delete process.env.KARMA_API_ORIGIN;
    expect(apiOrigin()).toBe(KARMA.apiHost);
  });

  it("prefers the runtime variable, which is the only one a function can see", () => {
    process.env.KARMA_API_ORIGIN = "https://staging.example";
    expect(apiOrigin()).toBe("https://staging.example");
  });

  it("trims trailing slashes so a path is never joined onto a double slash", () => {
    process.env.KARMA_API_ORIGIN = "https://staging.example///";
    expect(apiOrigin()).toBe("https://staging.example");
  });

  it("ignores an empty override rather than aiming at a relative path", () => {
    process.env.KARMA_API_ORIGIN = "";
    expect(apiOrigin()).toBe(KARMA.apiHost);
  });
});
