 

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[Workday Autofill] Extension installed. Open the popup to set up your profile.");
  }
});

 
