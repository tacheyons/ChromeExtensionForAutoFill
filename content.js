
const FIELD_MAP = {
  // Personal Info
  "legalNameSection_firstName":        "firstName",
  "legalNameSection_lastName":         "lastName",
  "legalNameSection_middleName":       "middleName",
  "email":                             "email",
  "phone-number":                      "phone",

  // Address
  "addressSection_addressLine1":       "addressLine1",
  "addressSection_addressLine2":       "addressLine2",
  "addressSection_city":               "city",
  "addressSection_postalCode":         "zipCode",

  // Application questions (common across Workday)
  "howDidYouHearAboutUs":              "referralSource",
  "linkedIn":                          "linkedIn",
  "website":                           "website",
  "coverLetter":                       "coverLetter",
  "salary":                            "expectedSalary",
  "yearsOfExperience":                 "yearsOfExperience",
};

// Dropdowns that require special handling (select by visible text)
const DROPDOWN_MAP = {
  "country-phone-number":              "phoneCountryCode",
  "addressSection_countryRegion":      "country", 
  "addressSection_countryRegionState": "state",            
  "workAuthorizationType":             "workAuthorization",
  "willSponsor":                       "requiresSponsorship",
  "gender":                            "gender",
  "race":                              "ethnicity",
  "veteranStatus":                     "veteranStatus",
  "disabilityStatus":                  "disabilityStatus",
};

 
function setReactInputValue(element, value) {
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value"
  ).set;
  const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, "value"
  )?.set;

  const setter = element.tagName === "TEXTAREA" ? nativeTextareaSetter : nativeInputSetter;
  if (setter) setter.call(element, value);

  // Fire all events React might be listening to
  element.dispatchEvent(new Event("focus",  { bubbles: true }));
  element.dispatchEvent(new Event("input",  { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur",   { bubbles: true }));
}

 
function parseWorkdayURL() {
  const url = window.location.href;
  const hostname = window.location.hostname; 
  const company = hostname.split(".")[0];    
  const isApplyPage = url.includes("/apply") || url.includes("step=");

  return { url, company, hostname, isApplyPage };
}

 
function scanFormFields() {
  const found = {};


  document.querySelectorAll("[data-automation-id]").forEach(el => {
    const id = el.getAttribute("data-automation-id");
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      found[id] = el;
    }
  });


  document.querySelectorAll("div[data-automation-id]").forEach(wrapper => {
    const id = wrapper.getAttribute("data-automation-id");
    const input = wrapper.querySelector("input, textarea");
    if (input && !found[id]) {
      found[id] = input;
    }
  });

  return found;
}

 
async function fillDropdown(automationId, value) {
  const widget = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!widget || !value) return false;

 
  widget.click();
  await sleep(500);

   
  const options = document.querySelectorAll(
    '[role="option"], [data-automation-id="promptOption"]'
  );

  for (const option of options) {
    if (option.textContent.trim().toLowerCase().includes(value.toLowerCase())) {
      option.click();
      await sleep(300);
      return true;
    }
  }

  
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  console.warn(`[Workday Autofill] No dropdown option matching "${value}" for field "${automationId}"`);
  return false;
}

 
async function autofill(profile) {
  const { company, isApplyPage } = parseWorkdayURL();
  console.log(`[Workday Autofill] Running on ${company}. Apply page: ${isApplyPage}`);

  const fields = scanFormFields();
  let filled = 0;
  let skipped = 0;

 
  for (const [automationId, profileKey] of Object.entries(FIELD_MAP)) {
    const value = profile[profileKey];
    const element = fields[automationId];

    if (!element) { skipped++; continue; }
    if (!value)   { skipped++; continue; }

    setReactInputValue(element, value);
    filled++;
    await sleep(100); 
  }


  for (const [automationId, profileKey] of Object.entries(DROPDOWN_MAP)) {
    const value = profile[profileKey];
    if (!value) { skipped++; continue; }

    const success = await fillDropdown(automationId, value);
    if (success) filled++;
    else skipped++;
  }

  showToast(`Autofill complete — ${filled} fields filled, ${skipped} skipped`);
  console.log(`[Workday Autofill] Done. Filled: ${filled}, Skipped: ${skipped}`);
}

// ─── Floating Button ──────────────────────────────────────────────────────────
function injectAutofillButton() {
  if (document.getElementById("wd-autofill-btn")) return; // Already injected

  const btn = document.createElement("button");
  btn.id = "wd-autofill-btn";
  btn.textContent = "⚡ Autofill";
  btn.title = "Fill this form with your saved Workday profile";

  Object.assign(btn.style, {
    position:     "fixed",
    bottom:       "24px",
    right:        "24px",
    zIndex:       "999999",
    padding:      "12px 20px",
    background:   "#0071ce",
    color:        "#fff",
    border:       "none",
    borderRadius: "8px",
    fontSize:     "14px",
    fontWeight:   "600",
    cursor:       "pointer",
    boxShadow:    "0 4px 12px rgba(0,0,0,0.25)",
    transition:   "opacity 0.2s",
    fontFamily:   "system-ui, sans-serif",
  });

  btn.addEventListener("mouseenter", () => btn.style.opacity = "0.85");
  btn.addEventListener("mouseleave", () => btn.style.opacity = "1");

  btn.addEventListener("click", async () => {
    btn.textContent = "⏳ Filling…";
    btn.disabled = true;

    chrome.storage.local.get("profile", async ({ profile }) => {
      if (!profile || Object.keys(profile).length === 0) {
        showToast("⚠️ No profile saved. Click the extension icon to set up your profile.");
        btn.textContent = "⚡ Autofill";
        btn.disabled = false;
        return;
      }
      await autofill(profile);
      btn.textContent = "⚡ Autofill";
      btn.disabled = false;
    });
  });

  document.body.appendChild(btn);
}

 
function showToast(message) {
  const existing = document.getElementById("wd-autofill-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "wd-autofill-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position:     "fixed",
    bottom:       "80px",
    right:        "24px",
    zIndex:       "999999",
    padding:      "12px 18px",
    background:   "#1a1a2e",
    color:        "#fff",
    borderRadius: "8px",
    fontSize:     "13px",
    fontFamily:   "system-ui, sans-serif",
    boxShadow:    "0 4px 12px rgba(0,0,0,0.3)",
    maxWidth:     "320px",
    lineHeight:   "1.4",
    opacity:      "0",
    transition:   "opacity 0.3s",
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = "1");

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

 
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

 
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "autofill") {
    autofill(message.profile).then(() => sendResponse({ success: true }));
    return true; // Keep channel open for async response
  }

  if (message.action === "scanFields") {
    const fields = scanFormFields();
    const { company, isApplyPage } = parseWorkdayURL();
    sendResponse({
      fields: Object.keys(fields),
      company,
      isApplyPage,
      url: window.location.href
    });
  }
});

 

(function init() {
  injectAutofillButton();

  const observer = new MutationObserver(() => {
    injectAutofillButton(); 
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
