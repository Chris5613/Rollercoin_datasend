// Listen for requests from the page and relay extension data
window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source !== window) return;

  const data = event.data;

if (
  data?.source === "rollercoin-app" &&
  data?.type === "REQUEST_POWER_BY_USERNAME"
) {
  const username = String(data.username || "").trim();

  if (!username) {
    console.warn("[RC BRIDGE] No username provided");
    return;
  }

  console.log("[RC BRIDGE] Fetching power for:", username);

  try {
    const { rcAuthToken } = await chrome.storage.local.get(["rcAuthToken"]);

    const headers = {
      Accept: "application/json",
    };

    if (rcAuthToken) {
      headers.Authorization = rcAuthToken.startsWith("Bearer ")
        ? rcAuthToken
        : `Bearer ${rcAuthToken}`;
    }

    const response = await fetch(
      `https://api.rollercoincalculator.app/api/RollercoinUser?userName=${encodeURIComponent(username)}`,
      {
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const responseData = await response.json();

    const power =
      responseData?.userPowerResponseDto ||
      responseData?.data ||
      responseData;

    console.log("[RC BRIDGE] Power response:", power);

    localStorage.setItem(
      "rollercoin:extension-state",
      JSON.stringify({
        power_payload: power,
        power_last_seen_at: new Date().toISOString(),
      })
    );

    window.dispatchEvent(
      new CustomEvent("rollercoin-power-update", {
        detail: power,
      })
    );

    window.postMessage(
      {
        source: "rollercoin-ext",
        type: "ROLLERCOIN_POWER_PUSH",
        payload: power,
      },
      window.location.origin
    );
  } catch (err) {
    console.error("[RC BRIDGE] Failed to fetch power:", err);
  }

  return;
}

  if (
  data?.source === "rollercoin-ext" &&
  data?.type === "ROLLERCOIN_POWER_PUSH"
) {
  console.log("[RC BRIDGE] POWER PUSH received", data.payload);

  try {
    localStorage.setItem(
      "rollercoin:extension-state",
      JSON.stringify({
        power_payload: data.payload,
        power_last_seen_at: new Date().toISOString(),
      })
    );

    window.dispatchEvent(
      new CustomEvent("rollercoin-power-update", {
        detail: data.payload,
      })
    );

    console.log("[RC BRIDGE] Power payload saved");
  } catch (err) {
    console.error("[RC BRIDGE] Failed to save power payload:", err);
  }

  return;
}

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