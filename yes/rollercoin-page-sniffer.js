(function () {
  function sendAuth(auth) {
    if (!auth) return;

    window.postMessage(
      {
        source: "rollercoin-page-sniffer",
        type: "RC_AUTH_CAPTURED",
        auth,
      },
      window.location.origin
    );
  }

  const originalFetch = window.fetch;

  if (typeof originalFetch === "function") {
    window.fetch = function (input, init) {
      try {
        let auth = null;

        const headers = init?.headers;

        if (headers instanceof Headers) {
          auth = headers.get("authorization") || headers.get("Authorization");
        } else if (headers && typeof headers === "object") {
          auth = headers.authorization || headers.Authorization;
        }

        if (!auth && input instanceof Request) {
          auth =
            input.headers.get("authorization") ||
            input.headers.get("Authorization");
        }

        if (auth) sendAuth(auth);
      } catch {}

      return originalFetch.apply(this, arguments);
    };
  }

  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (name && /^authorization$/i.test(String(name))) {
        sendAuth(value);
      }
    } catch {}

    return originalSetHeader.apply(this, arguments);
  };

  console.log("[RC PAGE] Auth sniffer running in MAIN world");
})();