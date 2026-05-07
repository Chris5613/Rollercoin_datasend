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
    `${API_URL}?from=${from}&to=${to}&currency=TRX_SMALL`;

  const res = await fetch(url, {
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

(function installAuthCapture() {

  const originalFetch = window.fetch;

  window.fetch = async function(input, init) {

    try {
      const headers = init?.headers;

      let auth = null;

      if (headers instanceof Headers) {
        auth =
          headers.get("authorization") ||
          headers.get("Authorization");
      } else if (headers) {
        auth =
          headers.authorization ||
          headers.Authorization;
      }

      if (auth) {
        chrome.storage.local.set({
          rcAuthToken: auth
        });
      }

    } catch {}

    return originalFetch.apply(this, arguments);
  };

})();

async function syncRollercoin() {

  const { rcAuthToken } =
    await chrome.storage.local.get(["rcAuthToken"]);

  if (!rcAuthToken) {
    console.log("No auth token yet.");
    return;
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