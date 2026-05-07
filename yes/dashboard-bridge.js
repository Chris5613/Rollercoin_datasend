window.addEventListener("message", (event) => {

  const data = event.data;

  if (
    !data ||
    data.source !== "rollercoin-extension" ||
    data.type !== "ROLLERCOIN_SYNC"
  ) {
    return;
  }

  console.log("Received RollerCoin sync:", data.payload);

  localStorage.setItem(
    "rollercoinSync",
    JSON.stringify(data.payload)
  );

});