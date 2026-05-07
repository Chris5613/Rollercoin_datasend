// Listen for requests from the page and relay extension data
window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source !== window) return;

  const data = event.data;

  if (data?.source === "rollercoin-app" && data?.type === "REQUEST_LATEST") {
    console.log("[RC BRIDGE] REQUEST_LATEST received from app");

    try {
      const { rcLastPayload } = await chrome.storage.local.get(["rcLastPayload"]);

      window.postMessage(
        {
          source: "rollercoin-ext",
          type: "ROLLERCOIN_PUSH",
          payload: rcLastPayload || null,
        },
        window.location.origin
      );

      console.log("[RC BRIDGE] Sent payload to app", rcLastPayload);
    } catch (err) {
      console.error("[RC BRIDGE] Error retrieving payload:", err);
    }
  }
});

setTimeout(() => {
  window.postMessage(
    {
      source: "rollercoin-ext",
      type: "READY",
    },
    window.location.origin
  );

  console.log("[RC BRIDGE] READY signal sent to app");
}, 500);