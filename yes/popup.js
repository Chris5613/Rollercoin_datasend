function formatTrx(value) {
  return `${Number(value || 0).toFixed(6)} TRX`;
}

async function refreshUI(message = null) {
  const el = document.getElementById("status");
  const { rcLastPayload } = await chrome.storage.local.get(["rcLastPayload"]);

  if (!rcLastPayload) {
    el.innerHTML = `
      ${message || "No sync yet"}
    `;
    return;
  }

  el.innerHTML = `
    ${formatTrx(rcLastPayload.total_trx)}

    Total earned since March 1, 2026

    ${rcLastPayload.rows?.length || 0} days loaded
    Last sync: ${new Date(rcLastPayload.synced_at || rcLastPayload.syncedAt).toLocaleString()}

    ${message ? `${message}` : ""}
  `;
}

document.getElementById("syncBtn").addEventListener("click", async () => {
  const btn = document.getElementById("syncBtn");
  btn.textContent = "Syncing...";
  btn.disabled = true;

  try {
    const tabs = await chrome.tabs.query({
      url: ["*://rollercoin.com/*", "*://www.rollercoin.com/*"],
    });

    if (!tabs.length) {
      await refreshUI("Open RollerCoin first.");
      return;
    }

    const res = await chrome.tabs.sendMessage(tabs[0].id, {
      type: "FORCE_SYNC",
    });

    if (!res?.ok) {
      throw new Error(res?.error || "Sync failed");
    }

    await refreshUI("Sync complete");
  } catch (err) {
    await refreshUI("Sync failed, showing last saved total.");
    console.error("Popup sync failed:", err);
  } finally {
    btn.textContent = "Sync Now";
    btn.disabled = false;
  }
});

refreshUI();