const API_URL =
  "https://rollercoin.com/api/profile/income-stats";

const TRX_SCALE = 1e10;

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchIncomeStats(auth) {

  const from = "2026-03-01";
  const to = getToday();

  const url =
    `${API_URL}?from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}` +
    `&currency=TRX_SMALL`;

  const headers = {
    Accept: "application/json",
  };

  // only attach auth if captured
  if (auth) {
    headers.Authorization = auth;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) {

    console.error(
      "[RC EXT] income-stats failed",
      res.status
    );

    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}


window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;

  const data = event.data;

  if (
    !data ||
    data.source !== "rollercoin-page-sniffer" ||
    data.type !== "RC_AUTH_CAPTURED" ||
    !data.auth
  ) {
    return;
  }

  await chrome.storage.local.set({
    rcAuthToken: data.auth,
  });

  console.log("[RC EXT] Auth token captured and saved");
});


function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function extractToken(value) {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object") {
      if (typeof parsed.access_token === "string") return parsed.access_token;
      if (typeof parsed.token === "string") return parsed.token;
      if (typeof parsed.jwt === "string") return parsed.jwt;

      if (parsed.currentSession?.access_token) {
        return parsed.currentSession.access_token;
      }

      if (parsed.auth?.session?.access_token) {
        return parsed.auth.session.access_token;
      }

      if (parsed.session?.access_token) {
        return parsed.session.access_token;
      }
    }
  } catch {
    // not JSON
  }

  const jwtMatch = value.match(
    /([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
  );

  return jwtMatch ? jwtMatch[1] : null;
}

function isValidToken(token) {
  if (!token || typeof token !== "string") return false;

  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  if (typeof payload.exp === "number") {
    return payload.exp >= Math.floor(Date.now() / 1000);
  }

  return true;
}

function findAuthTokensInStorage() {
  const tokens = [];

  function scanStore(store) {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        const value = store.getItem(key);
        if (!value) continue;

        const token = extractToken(value);
        if (!token || !isValidToken(token)) continue;

        if (!tokens.includes(token)) {
          tokens.push(token);
        }
      }
    } catch {}
  }

  scanStore(localStorage);
  scanStore(sessionStorage);

  return tokens;
}

let lastSentTokens = null;

async function sendTokenIfChanged() {
  const tokens = findAuthTokensInStorage();
  const normalized = JSON.stringify(tokens.sort());

  if (normalized === lastSentTokens) return;

  lastSentTokens = normalized;

  if (tokens.length > 0) {
    await chrome.storage.local.set({
      rcAuthToken: tokens[0],
      rcAuthTokens: tokens,
    });

    console.log("[RC EXT] Stored RollerCoin auth token from storage");
  } else {
    console.log("[RC EXT] No token found in storage yet");
  }
}

setTimeout(sendTokenIfChanged, 500);
setTimeout(sendTokenIfChanged, 2000);
setTimeout(sendTokenIfChanged, 5000);
setInterval(sendTokenIfChanged, 30000);
window.addEventListener("focus", sendTokenIfChanged);
   



async function syncRollercoin() {

  const { rcAuthToken } =
    await chrome.storage.local.get(["rcAuthToken"]);

if (!rcAuthToken) {
  console.log("No auth token yet, trying cookie session...");
}

  try {

    const payload =
      await fetchIncomeStats(rcAuthToken);

    const rows =
      (payload.data || []).map((r) => ({
        date: r.date,
        trx: Number(r.value) / TRX_SCALE,
      }));

    const totalTrx =
      rows.reduce((sum, r) => sum + r.trx, 0);

    const syncPayload = {
      source: "rollercoin",
      currency: "TRX",
      totalTrx,
      rows,
      syncedAt: new Date().toISOString(),
    };

    await chrome.storage.local.set({
      rcLastPayload: syncPayload
    });

    window.postMessage({
      source: "rollercoin-extension",
      type: "ROLLERCOIN_SYNC",
      payload: syncPayload,
    });

    console.log("RollerCoin synced:", syncPayload);

  } catch (err) {
    console.error(err);
  }
}

installAuthCapture();

setInterval(syncRollercoin, 5 * 60 * 1000);

setTimeout(syncRollercoin, 10000);

chrome.runtime.onMessage.addListener(
  (msg) => {

    if (
      msg?.type === "FORCE_SYNC"
    ) {
      syncRollercoin();
    }

  }
);