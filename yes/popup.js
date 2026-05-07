function formatTrx(value) {
  return `${Number(value || 0).toFixed(6)} TRX`;
}

async function refreshUI() {
  const el = document.getElementById("status");

  const { rcLastPayload } = await chrome.storage.local.get(["rcLastPayload"]);

  if (!rcLastPayload) {
    el.innerHTML = `<div class="muted">No sync yet</div>`;
    return;
  }

  el.innerHTML = `
    <div style="font-size:22px;font-weight:800;margin-bottom:6px;">
      ${formatTrx(rcLastPayload.totalTrx)}
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
  `;
}

document.getElementById("syncBtn").addEventListener("click", async () => {
  const btn = document.getElementById("syncBtn");
  const el = document.getElementById("status");

  btn.textContent = "Syncing...";
  btn.disabled = true;

  try {
    const tabs = await chrome.tabs.query({
      url: ["*://rollercoin.com/*", "*://www.rollercoin.com/*"],
    });

    if (!tabs.length) {
      el.innerHTML = `<div class="muted">Open RollerCoin first.</div>`;
      return;
    }

    const res = await chrome.tabs.sendMessage(tabs[0].id, {
      type: "FORCE_SYNC",
    });

    if (!res?.ok) {
      throw new Error(res?.error || "Sync failed");
    }

    await refreshUI();
  } catch (err) {
    el.innerHTML = `<div class="muted">Sync failed: ${err.message}</div>`;
  } finally {
    btn.textContent = "Sync Now";
    btn.disabled = false;
  }
});

refreshUI();