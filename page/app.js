(() => {
  "use strict";

  const DEFAULTS = { enabled: true, tier: "priority" };
  const WRITE_INTERVAL_MS = 1000;
  const SLOW_OPERATION_MS = 10000;
  const controls = document.getElementById("controls");
  const enabledInput = document.getElementById("enabled");
  const tierInputs = [...document.querySelectorAll('input[name="tier"]')];
  const toggleLabel = document.getElementById("toggle-label");
  const status = document.getElementById("save-status");
  const errorMessage = document.getElementById("error-message");
  const errorText = document.getElementById("error-text");
  const retrySave = document.getElementById("retry-save");
  const retryLoad = document.getElementById("retry-load");
  const reloadPage = document.getElementById("reload-page");
  const reloadNote = document.getElementById("reload-note");
  const invalidNotice = document.getElementById("invalid-notice");
  const pendingRecovery = document.getElementById("pending-recovery");
  const pendingText = document.getElementById("pending-text");
  const reloadPending = document.getElementById("reload-pending");
  const confirmedValue = document.getElementById("confirmed-value");
  const confirmedDetail = document.getElementById("confirmed-detail");

  let bridge;
  let desired = { ...DEFAULTS };
  let confirmed = null;
  let loaded = false;
  let loading = false;
  let writing = false;
  let needsSave = false;
  let savedOnce = false;
  let invalidOptions = false;
  let loadError = false;
  let saveError = false;
  let lastWriteSettled = -Infinity;
  let slowOperation = false;

  function watchOperation() {
    slowOperation = false;
    return setTimeout(() => {
      slowOperation = true;
      render();
    }, SLOW_OPERATION_MS);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function decodeOptions(raw) {
    const options = isObject(raw) ? raw : {};
    const enabled = Object.hasOwn(options, "enabled") ? options.enabled : DEFAULTS.enabled;
    const tier = Object.hasOwn(options, "tier") ? options.tier : DEFAULTS.tier;
    const validTier = tier === "priority" || tier === "ultrafast";
    const invalid = (raw != null && !isObject(raw))
      || typeof enabled !== "boolean"
      || !validTier;

    // Missing settings use the install defaults; malformed settings stay OFF.
    return {
      value: {
        enabled: !invalid && enabled,
        tier: validTier ? tier : DEFAULTS.tier,
      },
      invalid,
    };
  }

  function sameSettings(left, right) {
    return left.enabled === right.enabled && left.tier === right.tier;
  }

  function tierName(tier) {
    return tier === "ultrafast" ? "Ultrafast" : "Fast";
  }

  function render() {
    controls.disabled = !loaded || loading;
    enabledInput.checked = desired.enabled;
    toggleLabel.textContent = desired.enabled ? "ON" : "OFF";
    for (const input of tierInputs) input.checked = input.value === desired.tier;

    if (loading) {
      status.textContent = "Loading…";
      status.dataset.state = "loading";
    } else if (loadError) {
      status.textContent = "Settings unavailable";
      status.dataset.state = "error";
    } else if (writing) {
      status.textContent = "Saving…";
      status.dataset.state = "saving";
    } else if (saveError) {
      status.textContent = "Save not confirmed";
      status.dataset.state = "error";
    } else {
      status.textContent = savedOnce ? "Saved" : "Auto-save on";
      status.dataset.state = "saved";
    }

    errorMessage.hidden = !loadError && !saveError;
    errorText.textContent = loadError
      ? "Unable to load settings. Try again or reload."
      : "Save not confirmed. Retry or load saved settings.";
    retrySave.hidden = !saveError;
    retryLoad.hidden = !loadError && !saveError;
    retryLoad.textContent = loadError ? "Retry loading" : "Load saved";
    reloadPage.hidden = !loadError;
    reloadNote.hidden = !saveError;
    invalidNotice.hidden = !invalidOptions;
    pendingRecovery.hidden = !slowOperation;
    pendingText.textContent = loading
      ? "Loading is taking longer than usual."
      : "Save pending. Reloading does not cancel it.";

    if (!confirmed) {
      confirmedValue.textContent = loadError ? "Unavailable" : "Checking…";
      confirmedDetail.textContent = "—";
    } else if (!confirmed.enabled) {
      confirmedValue.textContent = "OFF";
      confirmedDetail.textContent = "No tier override";
    } else {
      confirmedValue.textContent = `ON · ${tierName(confirmed.tier)}`;
      confirmedDetail.textContent = `service_tier: "${confirmed.tier}"`;
    }
  }

  async function loadOptions() {
    if (loading || writing) return;
    loading = true;
    loadError = false;
    saveError = false;
    const slowTimer = watchOperation();
    render();

    try {
      if (!bridge) {
        const api = window.magpie;
        if (!api?.ready || typeof api.options?.get !== "function" || typeof api.options?.set !== "function") {
          throw new Error("Magpie bridge is unavailable");
        }
        await api.ready;
        bridge = api;
      }
      const decoded = decodeOptions(await bridge.options.get());
      confirmed = decoded.value;
      desired = { ...confirmed };
      invalidOptions = decoded.invalid;
      needsSave = false;
      savedOnce = false;
      loaded = true;
    } catch {
      loadError = true;
      loaded = false;
    } finally {
      clearTimeout(slowTimer);
      slowOperation = false;
      loading = false;
      render();
    }
  }

  async function saveChanges() {
    if (writing || loading || !loaded || !needsSave) return;
    writing = true;
    saveError = false;
    const slowTimer = watchOperation();
    render();

    try {
      while (needsSave) {
        let delay = WRITE_INTERVAL_MS - (performance.now() - lastWriteSettled);
        while (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = WRITE_INTERVAL_MS - (performance.now() - lastWriteSettled);
        }

        // set() replaces all options. Read after waiting, not when the user clicks.
        const latest = await bridge.options.get();
        const attempted = { ...desired };
        needsSave = false;
        let saved;
        try {
          saved = await bridge.options.set({
            ...(isObject(latest) ? latest : {}),
            ...attempted,
          });
        } finally {
          // Magpie limits server arrival times, not dispatch times.
          lastWriteSettled = performance.now();
        }
        const decoded = decodeOptions(saved);
        if (!isObject(saved)
          || typeof saved.enabled !== "boolean"
          || !Object.hasOwn(saved, "tier")
          || decoded.invalid
          || !sameSettings(decoded.value, attempted)) {
          throw new Error("The bridge did not confirm the requested settings");
        }

        confirmed = decoded.value;
        invalidOptions = false;
        savedOnce = true;
        // Coalesce changes made during a write into the latest selection.
        needsSave = !sameSettings(desired, confirmed);
        render();
      }
    } catch {
      // A rejected write may still have reached Magpie. Do not claim failure or success.
      saveError = true;
      needsSave = true;
    } finally {
      clearTimeout(slowTimer);
      slowOperation = false;
      writing = false;
      render();
    }
  }

  controls.addEventListener("change", () => {
    desired = {
      enabled: enabledInput.checked,
      tier: tierInputs.find((input) => input.checked)?.value === "ultrafast" ? "ultrafast" : "priority",
    };
    needsSave = true;
    saveError = false;
    render();
    void saveChanges();
  });
  retrySave.addEventListener("click", () => {
    // The recovery button disappears during the retry. Keep keyboard focus visible.
    enabledInput.focus();
    void saveChanges();
  });
  retryLoad.addEventListener("click", async () => {
    await loadOptions();
    (loadError ? retryLoad : enabledInput).focus();
  });
  reloadPage.addEventListener("click", () => { window.location.reload(); });
  reloadPending.addEventListener("click", () => { window.location.reload(); });

  void loadOptions();
})();
