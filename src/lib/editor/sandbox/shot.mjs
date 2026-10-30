/*
 * Full-page screenshots of the preview for before/after cards.
 *
 *   node .editor/shot.mjs <base64 JSON {path, out}>
 *
 * Drives the sandbox's Google Chrome over the DevTools protocol (Node's
 * built-in WebSocket). One headless Chrome is kept running between shots so
 * each takes a second or two. Output: a half-scale JPEG of the page, up to
 * 7,000 px tall, and {ok, height} on stdout.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const PROFILE = "/tmp/editor-chrome";
const PORT_FILE = `${PROFILE}/DevToolsActivePort`;
const WIDTH = 1280;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserUrl() {
  if (existsSync(PORT_FILE)) {
    const [port, path] = readFileSync(PORT_FILE, "utf8").trim().split("\n");
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return `ws://127.0.0.1:${port}${path}`;
    } catch {}
    rmSync(PORT_FILE, { force: true });
  }
  mkdirSync(PROFILE, { recursive: true });
  spawn(
    "google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${PROFILE}`,
      "about:blank",
    ],
    { detached: true, stdio: "ignore" },
  ).unref();
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    if (existsSync(PORT_FILE)) {
      const [port, path] = readFileSync(PORT_FILE, "utf8").trim().split("\n");
      if (port && path) return `ws://127.0.0.1:${port}${path}`;
    }
  }
  throw new Error("Chrome did not start");
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else listeners.forEach((fn) => fn(msg));
  };
  const opened = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("DevTools connection failed"));
  });
  return {
    opened,
    send(method, params = {}, sessionId) {
      const msg = {
        id: ++id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      };
      return new Promise((resolve, reject) => {
        pending.set(msg.id, { resolve, reject });
        ws.send(JSON.stringify(msg));
      });
    },
    once(method, sessionId, timeoutMs) {
      return new Promise((resolve) => {
        const t = setTimeout(
          () => (listeners.delete(fn), resolve(null)),
          timeoutMs,
        );
        const fn = (msg) => {
          if (msg.method === method && msg.sessionId === sessionId) {
            clearTimeout(t);
            listeners.delete(fn);
            resolve(msg.params);
          }
        };
        listeners.add(fn);
      });
    },
    close: () => ws.close(),
  };
}

async function shoot({ path, out }) {
  const cdp = connect(await browserUrl());
  await cdp.opened;
  const { targetId } = await cdp.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  try {
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    const loaded = cdp.once("Page.loadEventFired", sessionId, 25_000);
    await cdp.send(
      "Page.navigate",
      { url: `http://127.0.0.1:4321${path}` },
      sessionId,
    );
    await loaded;
    await sleep(500);
    const { result } = await cdp.send(
      "Runtime.evaluate",
      {
        expression:
          "Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)",
        returnByValue: true,
      },
      sessionId,
    );
    const height = Math.min(7000, Math.max(900, Number(result.value) || 900));
    const shot = await cdp.send(
      "Page.captureScreenshot",
      {
        format: "jpeg",
        quality: 70,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: WIDTH, height, scale: 0.5 },
      },
      sessionId,
    );
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    return { ok: true, height };
  } finally {
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    cdp.close();
  }
}

try {
  const req = JSON.parse(
    Buffer.from(process.argv[2] ?? "", "base64").toString("utf8"),
  );
  if (
    !/^\/[A-Za-z0-9/_.-]*$/.test(req.path) ||
    !/^\/home\/user\/\.editor\/shots\/[a-z0-9-]+\.jpg$/.test(req.out)
  ) {
    throw new Error("bad request");
  }
  const res = await Promise.race([
    shoot(req),
    sleep(40_000).then(() => ({ ok: false, reason: "timeout" })),
  ]);
  process.stdout.write(JSON.stringify(res) + "\n");
  process.exit(0);
} catch (e) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      reason: String(e && e.message).slice(0, 200),
    }) + "\n",
  );
  process.exit(0);
}
