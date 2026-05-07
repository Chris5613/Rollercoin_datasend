let latestRollercoinPayload = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg?.type === "ROLLERCOIN_SYNC") {

    latestRollercoinPayload = msg.payload;

    console.log(
      "[RC BG] Stored RollerCoin payload"
    );
  }

  if (msg?.type === "GET_ROLLERCOIN_SYNC") {

    sendResponse({
      ok: true,
      payload: latestRollercoinPayload,
    });

    return true;
  }
});