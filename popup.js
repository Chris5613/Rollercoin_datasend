async function refreshUI() {

  const el =
    document.getElementById("status");

  const {
    rcLastPayload
  } = await chrome.storage.local.get([
    "rcLastPayload"
  ]);

  if (!rcLastPayload) {
    el.innerHTML =
      `<div class="muted">No sync yet</div>`;
    return;
  }

  el.innerHTML = `
    <div>
      <strong>
        ${rcLastPayload.totalTrx.toFixed(6)} TRX
      </strong>
    </div>

    <div class="muted">
      ${rcLastPayload.rows.length} days loaded
    </div>

    <div class="muted">
      Last sync:
      ${new Date(
        rcLastPayload.syncedAt
      ).toLocaleString()}
    </div>
  `;
}

document
  .getElementById("syncBtn")
  .addEventListener("click", async () => {

    const tabs =
      await chrome.tabs.query({
        url: "*://*.rollercoin.com/*"
      });

    if (!tabs.length) {
      alert(
        "Open RollerCoin first."
      );
      return;
    }

    await chrome.tabs.sendMessage(
      tabs[0].id,
      {
        type: "FORCE_SYNC"
      }
    );

    setTimeout(refreshUI, 2000);
  });

refreshUI();