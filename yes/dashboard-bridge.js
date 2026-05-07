async function pushRollercoinIntoPage() {
  try {
    const res = await chrome.runtime.sendMessage({
      type: "GET_ROLLERCOIN_SYNC",
    });

    if (!res?.ok || !res.payload) return;

    window.postMessage(
      {
        source: "rollercoin-extension",
        type: "ROLLERCOIN_SYNC",
        payload: res.payload,
      },
      window.location.origin
    );

    console.log("[RC BRIDGE] pushed RollerCoin payload into dashboard");
  } catch (err) {
    console.error("[RC BRIDGE] failed", err);
  }
}

pushRollercoinIntoPage();
setInterval(pushRollercoinIntoPage, 15000);