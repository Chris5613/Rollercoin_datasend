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

function installAuthCapture() {

  // FETCH HOOK
  const originalFetch = window.fetch;

  window.fetch = async function(input, init) {

    try {

      let auth = null;

      // init.headers
      const headers = init?.headers;

      if (headers instanceof Headers) {
        auth =
          headers.get("authorization") ||
          headers.get("Authorization");
      }
      else if (headers && typeof headers === "object") {
        auth =
          headers.authorization ||
          headers.Authorization;
      }

      // Request object headers
      if (!auth && input instanceof Request) {
        auth =
          input.headers.get("authorization") ||
          input.headers.get("Authorization");
      }

      // Save token
      if (auth) {

        console.log(
          "[RC EXT] Captured fetch auth:",
          auth
        );

        chrome.storage.local.set({
          rcAuthToken: auth
        });
      }

    } catch (err) {
      console.error(
        "[RC EXT] fetch hook error",
        err
      );
    }

    return originalFetch.apply(this, arguments);
  };

  // XHR HOOK
  const originalSetHeader =
    XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.setRequestHeader =
    function(name, value) {

      try {

        if (
          name &&
          /^authorization$/i.test(String(name))
        ) {

          console.log(
            "[RC EXT] Captured XHR auth:",
            value
          );

          chrome.storage.local.set({
            rcAuthToken: value
          });
        }

      } catch (err) {
        console.error(
          "[RC EXT] xhr hook error",
          err
        );
      }

      return originalSetHeader.apply(
        this,
        arguments
      );
    };

  console.log("[RC EXT] Auth capture installed");
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