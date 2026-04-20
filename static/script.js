const API_ENDPOINT = "https://2slvta5ine2l6r2f7m7a44rxdm0mhnol.lambda-url.us-east-1.on.aws/";

const SECTION_ORDER = ["section-demographic", "section-services", "section-billing"];

const INTERNET_DEPENDENT = ["OnlineSecurity", "OnlineBackup", "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies"];

const form = document.getElementById("churnForm");
const resultCard = document.getElementById("resultCard");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const errorToast = document.getElementById("errorToast");

let currentSection = SECTION_ORDER[0];
let toastTimeout;

function getEl(id) {
  return document.getElementById(id);
}

// ── Auto-calculation logic ─────────────────────────────────────

function recalcTotalCharges() {
  const tenure = parseFloat(getEl("tenure").value) || 0;
  const monthly = parseFloat(getEl("MonthlyCharges").value) || 0;
  const totalEl = getEl("TotalCharges");
  if (tenure > 0 && monthly > 0 && !totalEl.dataset.manuallyEdited) {
    totalEl.value = (tenure * monthly).toFixed(2);
    totalEl.classList.add("auto-calculated");
  }
}

function syncPhoneDependents() {
  const noPhone = getEl("PhoneService").value === "No";
  const ml = getEl("MultipleLines");
  if (noPhone) {
    ml.value = "No phone service";
    ml.disabled = true;
    ml.closest(".field-group").classList.add("auto-locked");
  } else {
    if (ml.value === "No phone service") ml.value = "No";
    ml.disabled = false;
    ml.closest(".field-group").classList.remove("auto-locked");
  }
}

function syncInternetDependents() {
  const noInternet = getEl("InternetService").value === "No";
  INTERNET_DEPENDENT.forEach((id) => {
    const el = getEl(id);
    if (noInternet) {
      el.value = "No internet service";
      el.disabled = true;
      el.closest(".field-group").classList.add("auto-locked");
    } else {
      if (el.value === "No internet service") el.value = "No";
      el.disabled = false;
      el.closest(".field-group").classList.remove("auto-locked");
    }
  });
}

// ── Init auto-calc event listeners ────────────────────────────

getEl("tenure").addEventListener("input", recalcTotalCharges);
getEl("MonthlyCharges").addEventListener("input", recalcTotalCharges);

getEl("TotalCharges").addEventListener("input", function () {
  if (this.value) {
    this.dataset.manuallyEdited = "1";
    this.classList.remove("auto-calculated");
  } else {
    delete this.dataset.manuallyEdited;
    recalcTotalCharges();
  }
});

getEl("PhoneService").addEventListener("change", syncPhoneDependents);
getEl("InternetService").addEventListener("change", syncInternetDependents);

// ── Validation ─────────────────────────────────────────────────

function validateSection(sectionEl) {
  const inputs = sectionEl.querySelectorAll("input[required]:not([disabled]), select[required]:not([disabled])");
  let firstInvalid = null;
  inputs.forEach((input) => {
    input.classList.remove("invalid");
    if (!input.value.trim()) {
      input.classList.add("invalid");
      if (!firstInvalid) firstInvalid = input;
    }
  });
  if (firstInvalid) firstInvalid.focus();
  return firstInvalid;
}

// ── Step navigation ────────────────────────────────────────────

function updateStepIndicators(activeSectionId) {
  const activeIdx = SECTION_ORDER.indexOf(activeSectionId);
  document.querySelectorAll(".step").forEach((el, i) => {
    el.classList.remove("active", "done");
    if (i < activeIdx) el.classList.add("done");
    else if (i === activeIdx) el.classList.add("active");
  });
}

function navigateForward(targetSectionId) {
  const currentEl = getEl(currentSection);
  if (validateSection(currentEl)) return;
  currentEl.classList.remove("active");
  getEl(targetSectionId).classList.add("active");
  updateStepIndicators(targetSectionId);
  currentSection = targetSectionId;
}

function navigateBack(targetSectionId) {
  getEl(currentSection).classList.remove("active");
  getEl(targetSectionId).classList.add("active");
  updateStepIndicators(targetSectionId);
  currentSection = targetSectionId;
}

// ── Payload builder ────────────────────────────────────────────

function buildPayload() {
  const val = (id) => getEl(id).value;
  const num = (id) => parseInt(val(id), 10);
  const flt = (id) => parseFloat(val(id));
  return {
    gender: val("gender"),
    SeniorCitizen: num("SeniorCitizen"),
    Partner: val("Partner"),
    Dependents: val("Dependents"),
    tenure: num("tenure"),
    PhoneService: val("PhoneService"),
    MultipleLines: val("MultipleLines"),
    InternetService: val("InternetService"),
    OnlineSecurity: val("OnlineSecurity"),
    OnlineBackup: val("OnlineBackup"),
    DeviceProtection: val("DeviceProtection"),
    TechSupport: val("TechSupport"),
    StreamingTV: val("StreamingTV"),
    StreamingMovies: val("StreamingMovies"),
    Contract: val("Contract"),
    PaperlessBilling: val("PaperlessBilling"),
    PaymentMethod: val("PaymentMethod"),
    MonthlyCharges: flt("MonthlyCharges"),
    TotalCharges: flt("TotalCharges"),
  };
}

// ── UI helpers ─────────────────────────────────────────────────

function setLoadingState(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
}

function showToast(message) {
  getEl("toastMessage").textContent = message;
  errorToast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => errorToast.classList.add("hidden"), 6000);
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = `${(from + (to - from) * eased).toFixed(1)}%`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Result rendering ───────────────────────────────────────────

function renderResult(result) {
  const isChurn = result.churn_prediction === "Yes";
  const prob = result.churn_probability;

  resultCard.classList.remove("is-churn", "is-safe", "hidden");
  resultCard.classList.add(isChurn ? "is-churn" : "is-safe");

  const iconEl = getEl("resultIcon");
  iconEl.innerHTML = isChurn
    ? '<i class="bi bi-exclamation-triangle-fill"></i>'
    : '<i class="bi bi-shield-fill-check"></i>';

  getEl("predictionText").textContent = isChurn ? "High Risk of Churn" : "Customer is Safe";
  getEl("riskTag").textContent = result.risk_label;

  const gaugeFill = getEl("gaugeFill");
  const probText = getEl("probabilityText");
  gaugeFill.style.width = "0%";
  probText.textContent = "0%";

  requestAnimationFrame(() => {
    setTimeout(() => {
      gaugeFill.style.width = `${prob}%`;
      animateNumber(probText, 0, prob, 900);
    }, 80);
  });

  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Reset ──────────────────────────────────────────────────────

function resetApp() {
  resultCard.classList.add("hidden");
  resultCard.classList.remove("is-churn", "is-safe");
  form.reset();

  // Re-enable any auto-locked selects
  [...INTERNET_DEPENDENT, "MultipleLines"].forEach((id) => {
    const el = getEl(id);
    el.disabled = false;
    el.closest(".field-group").classList.remove("auto-locked");
  });
  delete getEl("TotalCharges").dataset.manuallyEdited;
  getEl("TotalCharges").classList.remove("auto-calculated");

  getEl(currentSection).classList.remove("active");
  getEl(SECTION_ORDER[0]).classList.add("active");
  updateStepIndicators(SECTION_ORDER[0]);
  currentSection = SECTION_ORDER[0];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Event wiring ───────────────────────────────────────────────

document.querySelectorAll(".btn-next").forEach((btn) => {
  btn.addEventListener("click", () => navigateForward(btn.dataset.next));
});

document.querySelectorAll(".btn-back").forEach((btn) => {
  btn.addEventListener("click", () => navigateBack(btn.dataset.back));
});

document.querySelectorAll(".field-input").forEach((input) => {
  input.addEventListener("change", () => input.classList.remove("invalid"));
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (validateSection(getEl("section-billing"))) return;

  setLoadingState(true);
  errorToast.classList.add("hidden");

  try {
    const response = await fetch(`${API_ENDPOINT}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${response.status}`);
    }

    renderResult(await response.json());
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not reach the prediction API. Please try again.");
  } finally {
    setLoadingState(false);
  }
});

resetBtn.addEventListener("click", resetApp);