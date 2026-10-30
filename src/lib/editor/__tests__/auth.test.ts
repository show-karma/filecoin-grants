import { describe, expect, it } from "vitest";
import {
  cleanName,
  createSessionToken,
  passwordMatches,
  readSessionToken,
  signingKey,
} from "../auth";

const SECRET = "test-secret-with-enough-length";

describe("session tokens", () => {
  it("round-trips the name", () => {
    const token = createSessionToken("Ada Lovelace", SECRET);
    expect(readSessionToken(token, SECRET)?.name).toBe("Ada Lovelace");
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken("Ada", SECRET);
    const [, mac] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ name: "Mallory", exp: Date.now() + 1e9 }),
    ).toString("base64url");
    expect(readSessionToken(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    expect(
      readSessionToken(createSessionToken("Ada", "other-secret"), SECRET),
    ).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(
      "Ada",
      SECRET,
      Date.now() - 30 * 86_400_000,
    );
    expect(readSessionToken(token, SECRET)).toBeNull();
  });

  it("rejects junk", () => {
    expect(readSessionToken(undefined, SECRET)).toBeNull();
    expect(readSessionToken("abc", SECRET)).toBeNull();
    expect(readSessionToken("a.b.c", SECRET)).toBeNull();
  });

  it("refuses to sign without a secret", () => {
    expect(() => createSessionToken("Ada", "")).toThrow();
  });
});

describe("signingKey", () => {
  it("signs everyone out when the password changes", () => {
    const token = createSessionToken(
      "Ada",
      signingKey(SECRET, "old-password-1234"),
    );
    expect(
      readSessionToken(token, signingKey(SECRET, "old-password-1234"))?.name,
    ).toBe("Ada");
    expect(
      readSessionToken(token, signingKey(SECRET, "new-password-5678")),
    ).toBeNull();
  });

  it("is empty, so nothing verifies, when either part is missing", () => {
    expect(signingKey("", "pw")).toBe("");
    expect(signingKey(SECRET, "")).toBe("");
  });
});

describe("passwordMatches", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches("hunter2", "hunter2")).toBe(true);
    expect(passwordMatches("hunter3", "hunter2")).toBe(false);
    expect(passwordMatches("", "hunter2")).toBe(false);
  });

  it("never matches when no password is configured", () => {
    expect(passwordMatches("", "")).toBe(false);
  });
});

describe("cleanName", () => {
  it("trims, collapses whitespace and strips control characters and angle brackets", () => {
    expect(cleanName("  Ada \n\t Lovelace  ")).toBe("Ada Lovelace");
    expect(cleanName("<b>Ada</b>")).toBe("bAda/b");
  });

  it("requires at least two characters", () => {
    expect(cleanName("A")).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});
