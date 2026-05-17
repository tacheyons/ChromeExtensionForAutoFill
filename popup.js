 

const PROFILE_FIELDS = [
  "firstName", "lastName", "email", "phone", "phoneCountryCode",
  "addressLine1", "addressLine2", "city", "zipCode", "state", "country",
  "workAuthorization", "requiresSponsorship",
  "linkedIn", "website", "expectedSalary", "yearsOfExperience",
  "referralSource", "gender", "ethnicity"
];


document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

    if (tab.dataset.tab === "page") loadPageInfo();
  });
});


function loadProfile() {
  chrome.storage.local.get("profile", ({ profile }) => {
    if (!profile) return;
    PROFILE_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && profile[id] !== undefined) el.value = profile[id];
    });
  });
}


document.getElementById("btn-save").addEventListener("click", () => {
  const profile = {};
  PROFILE_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) profile[id] = el.value.trim();
  });

  chrome.storage.local.set({ profile }, () => {
    showStatus("Profile saved!");
    setTimeout(() => showStatus(""), 2500);
  });
});


document.getElementById("btn-fill").addEventListener("click", () => {
  // First save current popup state, then trigger fill
  const profile = {};
  PROFILE_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) profile[id] = el.value.trim();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return showStatus(" No active tab found");

    // Send message to content script to trigger autofill
    chrome.tabs.sendMessage(tab.id, { action: "autofill", profile }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus(" Not a Workday page or page still loading");
        return;
      }
      showStatus(response?.success ? " Filling…" : "Something went wrong");
      setTimeout(() => showStatus(""), 3000);
    });
  });
});


function loadPageInfo() {
  const infoEl = document.getElementById("page-info");
  infoEl.textContent = "Scanning page…";

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      infoEl.textContent = "No active tab found.";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "scanFields" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        infoEl.innerHTML = `
          <div style="color:#ef4444">
            Could not connect to page.<br>
            Make sure you're on a Workday application page and the page has finished loading.
          </div>`;
        return;
      }

      const { fields, company, isApplyPage, url } = response;

      infoEl.innerHTML = `
        <div style="margin-bottom:10px">
          <strong>Company:</strong> ${company}<br>
          <strong>Apply page detected:</strong> ${isApplyPage ? " Yes" : "No"}<br>
          <strong>URL:</strong> <span style="word-break:break-all;color:#0071ce">${url}</span>
        </div>
        <div style="margin-bottom:6px"><strong>Fields found on page (${fields.length}):</strong></div>
        <div>${
          fields.length > 0
            ? fields.map(f => `<span class="field-pill">${f}</span>`).join("")
            : '<span style="color:#64748b">No recognizable Workday fields found on this page.</span>'
        }</div>
      `;
    });
  });
}


function showStatus(msg) {
  document.getElementById("status-msg").textContent = msg;
}


loadProfile();
