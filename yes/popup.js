function formatSol(value) {
  return `${Number(value || 0).toFixed(6)} SOL`;
}

async function refreshUI(message = null) {
  const el = document.getElementById("status");

  const { rcLastPayload } = await chrome.storage.local.get(["rcLastPayload"]);

  if (!rcLastPayload) {
    el.innerHTML = `
      <div class="muted">
        ${message || "No sync yet"}
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div style="font-size:22px;font-weight:800;margin-bottom:6px;">
      ${formatSol(rcLastPayload.total_sol ?? rcLastPayload.total_trx)}
    </div>

    <div class="muted">
      Total earned since March 1, 2026
    </div>

    <div class="muted" style="margin-top:6px;">
      ${rcLastPayload.rows?.length || 0} days loaded
    </div>

    <div class="muted">
      Last sync: ${new Date(rcLastPayload.syncedAt).toLocaleString()}
    </div>

    ${
      message
        ? `<div class="muted" style="margin-top:6px;color:#facc15;">${message}</div>`
        : ""
    }
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
    await refreshUI(`Sync failed, showing last saved total.`);
    console.error("Popup sync failed:", err);
  } finally {
    btn.textContent = "Sync Now";
    btn.disabled = false;
  }
});

refreshUI();