import { describe, expect, it } from "vitest";
import {
  describeDoc,
  fetchGoogleDoc,
  findGoogleDocs,
  withGoogleDocs,
} from "../google-docs";

const ID = "1g5n0Sf-e7HUZocLsiQGD8lg0N6vHvOUabcdefghij";
const URL = `https://docs.google.com/document/d/${ID}/edit?tab=t.0`;

const fake = (status: number, body = "", type = "text/plain; charset=utf-8") =>
  (async () =>
    new Response(status >= 300 && status < 400 ? null : body, {
      status,
      headers: { "content-type": type },
    })) as unknown as typeof fetch;

describe("google docs in a request", () => {
  it("finds document links once each, up to three", () => {
    const text = `Please add RFPs 6-9. ${URL} and again ${URL} plus https://docs.google.com/spreadsheets/d/${ID}/edit`;
    expect(findGoogleDocs(text)).toEqual([{ url: URL, id: ID }]);
    expect(findGoogleDocs("no links")).toEqual([]);
  });

  it("fetches the plain-text export of a shared document", async () => {
    const doc = await fetchGoogleDoc(
      ID,
      fake(200, "﻿R&D RFPs\r\n\r\nRFP 8: Light client"),
    );
    expect(doc).toEqual({
      ok: true,
      title: "R&D RFPs",
      text: "R&D RFPs\n\nRFP 8: Light client",
      truncated: false,
    });
  });

  it("calls a document private when Google redirects to sign-in or answers with a page", async () => {
    expect(await fetchGoogleDoc(ID, fake(302))).toEqual({
      ok: false,
      reason: "private",
    });
    expect(
      await fetchGoogleDoc(ID, fake(200, "<html>Sign in</html>", "text/html")),
    ).toEqual({
      ok: false,
      reason: "private",
    });
    expect(await fetchGoogleDoc(ID, fake(404))).toEqual({
      ok: false,
      reason: "not-found",
    });
    const failing = (async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    expect(await fetchGoogleDoc(ID, failing)).toEqual({
      ok: false,
      reason: "unreachable",
    });
  });

  it("appends the text, or the reason it could not be read, to the request", async () => {
    const got = await withGoogleDocs(
      `Please add RFPs 6-9. ${URL}`,
      fake(200, "RFPs\n\nRFP 8"),
    );
    expect(got).toContain("— Editor context —");
    expect(got).toContain("They linked a Google Doc (“RFPs”");
    expect(got).toContain("do not fetch it yourself:\n\nRFPs\n\nRFP 8");

    const withCtx = await withGoogleDocs(
      `Add this ${URL}\n\n— Editor context —\nThe person is looking at /rnd (R&D) in the preview.`,
      fake(302),
    );
    expect(withCtx.split("— Editor context —")).toHaveLength(2);
    expect(withCtx).toMatch(/not shared publicly.*Anyone with the link/s);
  });

  it("ignores links the editor itself added to the context", async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return new Response("x", { status: 200 });
    }) as unknown as typeof fetch;
    const prompt = `Shorten this.\n\n— Editor context —\nThey pasted a document with a link ${URL}`;
    expect(await withGoogleDocs(prompt, counting)).toBe(prompt);
    expect(calls).toBe(0);
  });

  it("words a long document and an unreachable one", () => {
    expect(
      describeDoc(
        { url: URL, id: ID },
        { ok: true, title: "T", text: "x", truncated: true },
      ),
    ).toContain("only the first part");
    expect(
      describeDoc({ url: URL, id: ID }, { ok: false, reason: "unreachable" }),
    ).toMatch(/could not be reached right now/);
  });
});
