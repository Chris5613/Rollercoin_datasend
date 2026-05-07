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

function installAuthCapture() {
  const script = document.createElement("script");

  script.textContent = `
    (function () {
      const AUTH_KEY = "__rcIncomeAuthHeader";

      function saveAuth(auth) {
        if (!auth) return;
        window[AUTH_KEY] = auth;
        window.postMessage({
          source: "rollercoin-page-auth",
          type: "RC_AUTH_CAPTURED",
          auth
        }, window.location.origin);
      }

      const originalFetch = window.fetch;

      if (typeof originalFetch === "function") {
        window.fetch = function(input, init) {
          try {
            let auth = null;

            const headers = init && init.headers;

            if (headers) {
              if (typeof headers.get === "function") {
                auth = headers.get("authorization") || headers.get("Authorization");
              } else if (typeof headers === "object") {
                auth = headers.authorization || headers.Authorization;
              }
            }

            if (!auth && input && typeof input === "object" && input.headers && typeof input.headers.get === "function") {
              auth = input.headers.get("authorization") || input.headers.get("Authorization");
            }

            if (auth) saveAuth(auth);
          } catch (e) {}

          return originalFetch.apply(this, arguments);
        };
      }

      const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

      XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        try {
          if (name && /^authorization$/i.test(String(name))) {
            saveAuth(value);
          }
        } catch (e) {}

        return originalSetHeader.apply(this, arguments);
      };

      console.log("[RC PAGE] Auth sniffer injected");
    })();
  `;

  (document.head || document.documentElement).appendChild(script);
  script.remove();

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;

    const data = event.data;

    if (
      !data ||
      data.source !== "rollercoin-page-auth" ||
      data.type !== "RC_AUTH_CAPTURED" ||
      !data.auth
    ) {
      return;
    }

    console.log("[RC EXT] Captured page auth:", data.auth);

    chrome.storage.local.set({
      rcAuthToken: data.auth,
    });
  });

  console.log("[RC EXT] Auth bridge installed");
}

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