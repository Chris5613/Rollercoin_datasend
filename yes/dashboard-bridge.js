// Listen for requests from the page and relay extension data
window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;

  const data = event.data;

  // Handle REQUEST_LATEST from the app
  if (data?.source === "rollercoin-app" && data?.type === "REQUEST_LATEST") {
    console.log("[RC BRIDGE] REQUEST_LATEST received from app");

    try {
      const { rcLastPayload } = await chrome.storage.local.get(["rcLastPayload"]);

      if (rcLastPayload) {
        window.postMessage(
          {
            source: "rollercoin-ext",
            type: "ROLLERCOIN_PUSH",
            payload: rcLastPayload,
          },
          window.location.origin
        );

        console.log("[RC BRIDGE] Sent cached payload to app");
      }
    } catch (err) {
      console.error("[RC BRIDGE] Error retrieving payload:", err);
    }
  }
});

// Send READY signal on page load
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