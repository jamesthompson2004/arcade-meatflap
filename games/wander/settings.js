const form = document.getElementById("settings-form");
const savedBanner = document.getElementById("saved-banner");
const resetBtn = document.getElementById("reset-btn");

function populateForm(values) {
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    const input = form.elements.namedItem(key);
    if (input) input.value = values[key];
  }
}

function readForm() {
  const values = {};
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    const input = form.elements.namedItem(key);
    const num = Number(input.value);
    values[key] = Number.isFinite(num) ? num : CONFIG_DEFAULTS[key];
  }
  return values;
}

function flashSaved(text) {
  savedBanner.textContent = text;
  savedBanner.classList.remove("hidden");
  clearTimeout(flashSaved.timer);
  flashSaved.timer = setTimeout(() => savedBanner.classList.add("hidden"), 2200);
}

populateForm(loadWanderConfig());

form.addEventListener("submit", (e) => {
  e.preventDefault();
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(readForm()));
  flashSaved("Saved! Reload Wander to see it.");
});

resetBtn.addEventListener("click", () => {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  populateForm(CONFIG_DEFAULTS);
  flashSaved("Reset to defaults — hit Save to apply.");
});
