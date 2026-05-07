chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ROLLERCOIN_SYNC") {
    chrome.storage.local.set({
      rcLastPayload: msg.payload,
    });

    console.log("[RC BG] Stored RollerCoin payload");

    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "GET_ROLLERCOIN_SYNC") {
    chrome.storage.local.get(["rcLastPayload"]).then(({ rcLastPayload }) => {
      sendResponse({
        ok: true,
        payload: rcLastPayload || null,
      });
    });

    return true;
  }
});