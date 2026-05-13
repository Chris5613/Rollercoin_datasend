const API_URL = "https://rollercoin.com/api/profile/income-stats";
const TRX_SCALE = 1e10;
const START_DATE = "2026-03-01";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function scrapePowerTextValue(label) {
  const elements = [...document.querySelectorAll("*")];

  for (const el of elements) {
    const text = el.textContent?.trim();

    if (text === label) {
      const parent = el.parentElement;

      if (!parent) continue;

      const children = [...parent.children];
      const index = children.indexOf(el);

      if (index !== -1 && children[index + 1]) {
        return children[index + 1].textContent?.trim() || null;
      }

      const lines = parent.innerText.split("\n").map(t => t.trim()).filter(Boolean);
      const labelIndex = lines.indexOf(label);

      if (labelIndex !== -1 && lines[labelIndex + 1]) {
        return lines[labelIndex + 1];
      }
    }
  }

  return null;
}

function scrapeRollercoinPower() {
  const bonusPowerRaw = scrapePowerTextValue("Bonus Power");
  const hamsterBonusRaw = scrapePowerTextValue("Hamster Bonus Power");

  const powerPayload = {
    league: scrapePowerTextValue("League"),
    maxPower: scrapePowerTextValue("Maximum power"),
    currentPower: scrapePowerTextValue("Current power"),
    miners: scrapePowerTextValue("Miners"),
    bonusPower: bonusPowerRaw,
    bonusPercent:
      bonusPowerRaw?.match(/([+-]?\d+(?:\.\d+)?)%/)?.[1] || null,
    hamsterBonusPower: hamsterBonusRaw,
    hamsterBonusPercent:
      hamsterBonusRaw?.match(/([+-]?\d+(?:\.\d+)?)%/)?.[1] || null,
    rackBonus: scrapePowerTextValue("Rack Bonus"),
    games: scrapePowerTextValue("Games"),
    temporary: scrapePowerTextValue("Temporary"),
    synced_at: new Date().toISOString(),
  };

  const hasUsefulData =
    powerPayload.currentPower ||
    powerPayload.miners ||
    powerPayload.bonusPower;

  if (!hasUsefulData) {
    return null;
  }

  return powerPayload;
}

async function syncRollercoinPower() {
  const powerPayload = scrapeRollercoinPower();

  if (!powerPayload) {
    console.log("[RC EXT] Power panel not found yet");
    return null;
  }

  await chrome.storage.local.set({
    rcPowerPayload: powerPayload,
  });

  window.postMessage(
    {
      source: "rollercoin-ext",
      type: "ROLLERCOIN_POWER_PUSH",
      payload: powerPayload,
    },
    window.location.origin
  );

  chrome.runtime.sendMessage({
    type: "ROLLERCOIN_POWER_SYNC",
    payload: powerPayload,
  });

  console.log("[RC EXT] RollerCoin power synced:", powerPayload);

  return powerPayload;
}

async function fetchIncomeStats(auth) {
  const to = getToday();

  const url =
    `${API_URL}?from=${encodeURIComponent(START_DATE)}` +
    `&to=${encodeURIComponent(to)}` +
    `&currency=TRX_SMALL`;

  const headers = {
    Accept: "application/json",
  };

if (auth) {
  headers.Authorization = auth.startsWith("Bearer ")
    ? auth
    : `Bearer ${auth}`;
}

  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    console.error("[RC EXT] income-stats failed", res.status);
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
  } catch {}

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

async function syncRollercoin() {
  const { rcAuthToken } = await chrome.storage.local.get(["rcAuthToken"]);

  if (!rcAuthToken) {
    console.log("[RC EXT] No auth token yet, trying cookie session...");
  }

  const payload = await fetchIncomeStats(rcAuthToken);

  const rows = (payload.data || []).map((r) => ({
    date: r.date,
    raw: Number(r.value) || 0,
    trx: (Number(r.value) || 0) / TRX_SCALE,
  }));

  const totalTrx = rows.reduce((sum, r) => sum + r.trx, 0);

  const syncPayload = {
    total_trx: totalTrx,
    today_trx: rows.find(r => r.date === getToday())?.trx || 0,
    balance_trx: totalTrx,
    synced_at: new Date().toISOString(),
    rows,
    from: START_DATE,
    to: getToday(),
  };

  await chrome.storage.local.set({
    rcLastPayload: syncPayload,
  });

  window.postMessage(
    {
      source: "rollercoin-ext",
      type: "ROLLERCOIN_PUSH",
      payload: syncPayload,
    },
    window.location.origin
  );

chrome.runtime.sendMessage({
  type: "ROLLERCOIN_SYNC",
  payload: syncPayload,
});

  console.log("[RC EXT] RollerCoin synced:", syncPayload);

  return syncPayload;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "FORCE_SYNC") {
    console.log("[RC EXT] FORCE_SYNC received");

    syncRollercoin()
      .then((payload) => {
        sendResponse({ ok: true, payload });
      })
      .catch((err) => {
        console.error("[RC EXT] FORCE_SYNC failed:", err);
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }
});

function waitForPowerPanel() {
  const text = document.body?.innerText || "";

  if (
    text.includes("My power") ||
    text.includes("Maximum power") ||
    text.includes("Current power")
  ) {
    console.log("[RC EXT] Power panel detected");

    syncRollercoinPower();

    setInterval(() => {
      syncRollercoinPower();
    }, 30000);

    window.addEventListener("focus", () => {
      syncRollercoinPower();
    });

    return;
  }

  console.log("[RC EXT] Waiting for power panel...");

  setTimeout(waitForPowerPanel, 2000);
}

setTimeout(sendTokenIfChanged, 500);
setTimeout(sendTokenIfChanged, 2000);
setTimeout(sendTokenIfChanged, 5000);

setInterval(sendTokenIfChanged, 30000);

window.addEventListener("focus", sendTokenIfChanged);

waitForPowerPanel();