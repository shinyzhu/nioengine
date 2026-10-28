/* Engine Sound Lab — P1 cockpit.
   Virtual drivetrain + optional GPS speed + crank-angle engine sound synth. */
(function () {
  "use strict";

  var I18N = window.P1_I18N || { zh: {}, en: {} };
  var BUILD = window.P1_BUILD || { version: "0.1.0", time: "" };
  var LANG_KEY = "nioengine.p1.lang";
  var VOLUME_KEY = "nioengine.p1.volume";
  var PRESET_KEY = "nioengine.p1.preset";
  var VALVE_KEY = "nioengine.p1.valve";
  var GPS_STALE_MS = 2000;
  var GPS_FADE_START_MS = 5000;
  var GPS_FADE_END_MS = 9000;
  var OUTPUT_GAIN = 2.2;

  var PRESETS = {
    v8: {
      id: "v8",
      nameKey: "preset.v8.name",
      descKey: "preset.v8.desc",
      charKey: "preset.v8.char",
      accent: "#ff5a1f",
      accent2: "#ffb347",
      cylinders: 8,
      offsets: [0, 270, 630, 540, 450, 360, 180, 90],
      banks: [0, 1, 0, 1, 0, 1, 0, 1],
      idle: 650,
      redline: 7000,
      limiter: 7300,
      maxRpm: 8000,
      res: [[85, 190, 380], [95, 210, 420]],
      decay: 0.04,
      pulseGain: 0.04,
      click: 0.06,
      subRatio: 0.5,
      subGain: 0.025,
      intakeGain: 0.4,
      crackle: 0.6,
      turbo: false,
      drive: {
        gears: [3.6, 2.2, 1.55, 1.2, 0.97, 0.8],
        final: 3.4,
        mass: 1850,
        wheelR: 0.35,
        torque: 620,
        torqueRpm: 4600,
        shiftUp: 6600,
        shiftDown: 2200,
        launchRpm: 2200,
        drag: 0.65,
        rolling: 0.012,
        topKmh: 280
      }
    },
    i4: {
      id: "i4",
      nameKey: "preset.i4.name",
      descKey: "preset.i4.desc",
      charKey: "preset.i4.char",
      accent: "#35c7ff",
      accent2: "#9be7ff",
      cylinders: 4,
      offsets: [0, 540, 180, 360],
      banks: [0, 1, 0, 1],
      idle: 800,
      redline: 6800,
      limiter: 7000,
      maxRpm: 8000,
      res: [[110, 240, 480], [120, 260, 520]],
      decay: 0.035,
      pulseGain: 0.05,
      click: 0.07,
      subRatio: 1.0,
      subGain: 0.018,
      intakeGain: 0.5,
      crackle: 1.2,
      turbo: true,
      drive: {
        gears: [3.5, 2.1, 1.5, 1.15, 0.9, 0.75],
        final: 3.9,
        mass: 1500,
        wheelR: 0.33,
        torque: 380,
        torqueRpm: 3200,
        shiftUp: 6200,
        shiftDown: 2000,
        launchRpm: 2600,
        drag: 0.62,
        rolling: 0.012,
        topKmh: 250
      }
    },
    i6: {
      id: "i6",
      nameKey: "preset.i6.name",
      descKey: "preset.i6.desc",
      charKey: "preset.i6.char",
      accent: "#ffb020",
      accent2: "#ffd37a",
      cylinders: 6,
      offsets: [0, 480, 240, 600, 120, 360],
      banks: [0, 0, 0, 1, 1, 1],
      idle: 700,
      redline: 7500,
      limiter: 7700,
      maxRpm: 8000,
      res: [[95, 210, 430], [100, 220, 450]],
      decay: 0.045,
      pulseGain: 0.038,
      click: 0.055,
      subRatio: 1.0,
      subGain: 0.02,
      intakeGain: 0.35,
      crackle: 0.4,
      turbo: false,
      drive: {
        gears: [3.4, 2.1, 1.55, 1.2, 0.95, 0.78, 0.65],
        final: 3.2,
        mass: 1700,
        wheelR: 0.34,
        torque: 500,
        torqueRpm: 4000,
        shiftUp: 7000,
        shiftDown: 2200,
        launchRpm: 2200,
        drag: 0.63,
        rolling: 0.012,
        topKmh: 270
      }
    },
    f1v10: {
      id: "f1v10",
      nameKey: "preset.f1v10.name",
      descKey: "preset.f1v10.desc",
      charKey: "preset.f1v10.char",
      accent: "#ff3344",
      accent2: "#ff8a7a",
      cylinders: 10,
      offsets: [0, 72, 144, 216, 288, 360, 432, 504, 576, 648],
      banks: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      idle: 3200,
      redline: 18000,
      limiter: 19000,
      maxRpm: 20000,
      res: [[480, 1200, 2400], [520, 1320, 2640]],
      decay: 0.018,
      pulseGain: 0.075,
      click: 0.14,
      subRatio: 0.5,
      subGain: 0.008,
      intakeGain: 1.3,
      crackle: 1.0,
      turbo: false,
      drive: {
        gears: [3.2, 2.45, 1.95, 1.6, 1.35, 1.15, 1.0, 0.88],
        final: 3.4,
        mass: 800,
        wheelR: 0.33,
        torque: 520,
        torqueRpm: 15000,
        shiftUp: 17000,
        shiftDown: 8500,
        launchRpm: 12000,
        drag: 0.55,
        rolling: 0.012,
        topKmh: 340
      }
    },
    v12: {
      id: "v12",
      nameKey: "preset.v12.name",
      descKey: "preset.v12.desc",
      charKey: "preset.v12.char",
      accent: "#f5c518",
      accent2: "#ffe08a",
      cylinders: 12,
      offsets: [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660],
      banks: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      idle: 800,
      redline: 8500,
      limiter: 8700,
      maxRpm: 9000,
      res: [[300, 600, 1200], [320, 640, 1280]],
      decay: 0.035,
      pulseGain: 0.055,
      click: 0.08,
      subRatio: 0.5,
      subGain: 0.015,
      intakeGain: 0.7,
      crackle: 0.85,
      turbo: false,
      drive: {
        gears: [3.9, 2.45, 1.8, 1.42, 1.18, 0.97, 0.84],
        final: 3.54,
        mass: 1600,
        wheelR: 0.35,
        torque: 690,
        torqueRpm: 5500,
        shiftUp: 8200,
        shiftDown: 3000,
        launchRpm: 3000,
        drag: 0.6,
        rolling: 0.012,
        topKmh: 350
      }
    }
  };

  var state = {
    lang: "zh",
    presetId: "v8",
    preset: PRESETS.v8,
    engine: "off",
    mode: "neutral",
    pendingMode: null,
    busy: false,

    ctx: null,
    eqLow: null,
    eqMid: null,
    eqHigh: null,
    master: null,
    comp: null,
    softClip: null,
    analyser: null,
    convolver: null,

    worklet: null,
    workletReady: false,
    workletError: null,
    workletLoadMode: null,
    secureBlocked: false,
    fallback: false,
    fallbackOsc: null,
    fallbackFilter: null,
    fallbackGain: null,

    latency: { baseMs: null, outputMs: null, totalMs: null, rating: "unknown" },
    telemetry: {
      rpm: 0,
      load: 0,
      throttle: 0,
      boost: 0,
      rms: 0,
      peak: 0,
      heartbeat: 0,
      lastAt: 0,
      lastGap: 0,
      maxGap: 0,
      mode: "off",
      fuelCut: false
    },
    drive: {
      speed: 0,
      gear: 0,
      rpm: 650,
      throttle: 0,
      brake: 0,
      load: 0,
      boost: 0,
      accel: 0,
      shiftTimer: 0,
      shiftCooldown: 0,
      limiterCut: false,
      cruiseIntegral: 0,
      demoStart: 0
    },
    gps: {
      supported: !!(navigator.geolocation),
      secure: !!window.isSecureContext,
      watching: false,
      watchId: null,
      permission: "unknown",
      error: null,
      lastFixAt: 0,
      lastWall: 0,
      intervalMs: null,
      speedMps: null,
      accuracy: null,
      heading: null,
      source: "none",
      accel1: 0,
      accel2: 0,
      accelSmooth: 0,
      confidence: 0,
      fixes: 0,
      gaps: 0,
      lastGapMs: 0,
      history: [],
      lastPos: null,
      lastSpeedMps: null,
      uiStatus: "idle",
      rejected: 0
    },
    timers: { start: 0, stop: 0 },
    volume: 0.4,
    valve: 0,
    wakeLock: null,
    wakeWanted: false,
    fullscreen: false,

    overlay: true,
    modesExpanded: false,
    diagOpen: false,
    ui: { throttleHeld: false, brakeHeld: false },
    displayRpm: 0,
    lastFrame: 0,
    lastUi: 0,
    lastControl: 0,
    lastDiag: 0,
    lastSuspendedToast: 0,
    fps: { frames: 0, last: 0, value: 0 },
    toastTimer: 0,
    audioError: null,
    raf: 0
  };

  var els = {};
  var shiftLightNodes = [];

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function byId(id) { return document.getElementById(id); }

  function t(key, vars) {
    var dict = I18N[state.lang] || I18N.en || {};
    var text = dict[key];
    if (text === undefined) text = (I18N.en || {})[key];
    if (text === undefined) text = key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (match, name) {
      return vars[name] === undefined ? match : String(vars[name]);
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setText(el, text) {
    if (el && el.textContent !== String(text)) el.textContent = String(text);
  }

  function fmtMs(value, digits) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    return value.toFixed(digits === undefined ? 1 : digits) + " ms";
  }

  function hexToRgba(hex, alpha) {
    var h = String(hex || "#ff5a1f").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function clearNode(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function setChildren(el, nodes) {
    if (!el) return;
    clearNode(el);
    for (var i = 0; i < nodes.length; i++) if (nodes[i]) el.appendChild(nodes[i]);
  }

  function showToast(text, duration) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.hidden = false;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      els.toast.hidden = true;
      state.toastTimer = 0;
    }, duration || 2800);
  }

  function modeLabel(mode) {
    var key = "mode." + mode;
    var text = t(key);
    return text === key ? mode : text;
  }

  function engineLabel(engine) {
    var key = "engine." + engine;
    var text = t(key);
    return text === key ? engine : text;
  }

  function presetName(p) {
    return t((p || state.preset).nameKey);
  }

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error(label || "timeout"));
      }, ms);
      promise.then(
        function (value) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (err) { return false; }
  }

  function copyText(text, okMessage, failMessage) {
    var copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { showToast(okMessage); },
        function () { fallbackCopy(text, okMessage, failMessage); }
      );
      return;
    }
    fallbackCopy(text, okMessage, failMessage);
  }

  function fallbackCopy(text, okMessage, failMessage) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var copied = false;
    try { copied = document.execCommand("copy"); } catch (err) { copied = false; }
    document.body.removeChild(ta);
    showToast(copied ? okMessage : failMessage, copied ? 2200 : 3600);
  }

  /* ------------------------------------------------------------------ */
  /* i18n                                                               */
  /* ------------------------------------------------------------------ */

  function detectLang() {
    var q = new URLSearchParams(window.location.search).get("lang");
    if (q === "zh" || q === "en") return q;
    var saved = safeGet(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  function applyI18n() {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  }

  function updateLangButtons() {
    var buttons = document.querySelectorAll("[data-lang]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute(
        "aria-pressed",
        buttons[i].getAttribute("data-lang") === state.lang ? "true" : "false"
      );
    }
  }

  function setLang(lang) {
    if (lang !== "zh" && lang !== "en") return;
    state.lang = lang;
    safeSet(LANG_KEY, lang);
    applyI18n();
    updateLangButtons();
    buildPresetCards();
    refreshPresetUI();
    updateDisplay();
    if (state.diagOpen) renderDiag();
    drawTach();
  }

  /* ------------------------------------------------------------------ */
  /* Presets / UI                                                       */
  /* ------------------------------------------------------------------ */

  function applyPresetCss() {
    var p = state.preset;
    var root = document.documentElement;
    root.style.setProperty("--accent", p.accent);
    root.style.setProperty("--accent-2", p.accent2);
    root.style.setProperty("--accent-soft", hexToRgba(p.accent, 0.14));
    root.style.setProperty("--accent-glow", hexToRgba(p.accent, 0.38));
  }

  function buildPresetCards() {
    if (!els.presetCards) return;
    var order = ["v8", "i4", "i6", "f1v10", "v12"];
    var nodes = [];
    for (var i = 0; i < order.length; i++) {
      (function (id) {
        var p = PRESETS[id];
        var button = document.createElement("button");
        button.type = "button";
        button.className = "preset-card" + (id === state.presetId ? " active" : "");
        button.setAttribute("data-preset", id);
        button.setAttribute("aria-pressed", id === state.presetId ? "true" : "false");

        var strong = document.createElement("strong");
        strong.textContent = t(p.nameKey);
        var span = document.createElement("span");
        span.textContent = t(p.descKey);
        var em = document.createElement("em");
        em.textContent = t(p.charKey);
        button.appendChild(strong);
        button.appendChild(span);
        button.appendChild(em);
        button.addEventListener("click", function () { setPreset(id); });
        nodes.push(button);
      })(order[i]);
    }
    setChildren(els.presetCards, nodes);
  }

  function refreshPresetUI() {
    var p = state.preset;
    if (els.presetName) els.presetName.textContent = presetName(p);
    var tabs = document.querySelectorAll("#presetTabs [data-preset]");
    for (var i = 0; i < tabs.length; i++) {
      var id = tabs[i].getAttribute("data-preset");
      tabs[i].textContent = t(PRESETS[id].nameKey);
      tabs[i].classList.toggle("active", id === state.presetId);
      tabs[i].setAttribute("aria-pressed", id === state.presetId ? "true" : "false");
    }
    if (els.overlayVersion) els.overlayVersion.textContent = "P1 · " + BUILD.version;
    if (els.boostRow) els.boostRow.hidden = !p.turbo;
    if (els.boostStat) els.boostStat.hidden = !p.turbo;
    applyPresetCss();
  }

  function setPreset(id) {
    if (!PRESETS[id]) return;
    if (state.engine !== "off") {
      showToast(t("toast.presetLocked"), 2800);
      return;
    }
    state.presetId = id;
    state.preset = PRESETS[id];
    state.drive.rpm = state.preset.idle;
    state.displayRpm = 0;
    safeSet(PRESET_KEY, id);
    buildPresetCards();
    refreshPresetUI();
    updateDisplay();
    drawTach();
  }

  /* ------------------------------------------------------------------ */
  /* Audio graph                                                        */
  /* ------------------------------------------------------------------ */

  function makeIR(ctx) {
    var sr = ctx.sampleRate;
    var len = Math.floor(sr * 0.18);
    var buffer = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var env = Math.exp(-i / (sr * 0.055));
        data[i] = (Math.random() * 2 - 1) * env * (1 - i / len) * 0.55;
      }
      var taps = [0.004, 0.009, 0.016, 0.025, 0.038];
      for (var k = 0; k < taps.length; k++) {
        var idx = Math.floor(taps[k] * sr) + ch * 3;
        if (idx < len) data[idx] += (Math.random() * 2 - 1) * (0.35 / (k + 1));
      }
    }
    return buffer;
  }

  function makeSoftClipCurve() {
    var n = 4096;
    var curve = new Float32Array(n);
    var edge = 0.9;
    var ceiling = 0.95;
    var norm = 1 - Math.exp(-2.2);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      var ax = Math.abs(x);
      var y;
      if (ax <= edge) {
        y = x;
      } else {
        var t = (ax - edge) / (1 - edge);
        y = Math.sign(x) * (edge + (ceiling - edge) * (1 - Math.exp(-t * 2.2)) / norm);
      }
      curve[i] = y;
    }
    return curve;
  }

  function updateLatency() {
    if (!state.ctx) {
      state.latency = { baseMs: null, outputMs: null, totalMs: null, rating: "unknown" };
      return;
    }
    var base = typeof state.ctx.baseLatency === "number" ? state.ctx.baseLatency : null;
    var output = typeof state.ctx.outputLatency === "number" ? state.ctx.outputLatency : null;
    var total = base === null && output === null ? null : (base || 0) + (output || 0);
    var rating = "unknown";
    if (total !== null) {
      var ms = total * 1000;
      if (ms < 30) rating = "good";
      else if (ms < 80) rating = "ok";
      else rating = "poor";
    }
    state.latency = {
      baseMs: base === null ? null : base * 1000,
      outputMs: output === null ? null : output * 1000,
      totalMs: total === null ? null : total * 1000,
      rating: rating
    };
  }

  async function ensureAudio() {
    state.audioError = null;
    if (state.ctx) {
      if (state.ctx.state !== "running") {
        try { await state.ctx.resume(); } catch (err) { state.audioError = String(err); }
      }
      if (!state.worklet && !state.fallback) {
        var retryOk = await loadWorklet();
        if (!retryOk) {
          state.fallback = true;
          createFallback();
        }
      }
      updateLatency();
      updateAudioStatus();
      return;
    }

    var AC = window.AudioContext || window.webkitAudioContext;
    if (typeof AC !== "function") throw new Error("AudioContext is not supported");
    var ctx = null;
    try { ctx = new AC({ latencyHint: "interactive" }); }
    catch (err) { ctx = new AC(); }
    state.ctx = ctx;
    ctx.onstatechange = onAudioStateChange;

    var eqLow = ctx.createBiquadFilter();
    eqLow.type = "lowshelf";
    eqLow.frequency.value = 85;
    eqLow.gain.value = 3;

    var eqMid = ctx.createBiquadFilter();
    eqMid.type = "peaking";
    eqMid.frequency.value = 230;
    eqMid.Q.value = 1;
    eqMid.gain.value = 1.2;

    var eqHigh = ctx.createBiquadFilter();
    eqHigh.type = "highshelf";
    eqHigh.frequency.value = 6500;
    eqHigh.gain.value = -4;

    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    var master = ctx.createGain();
    master.gain.value = state.volume * OUTPUT_GAIN;

    // Transparent soft clip above 0.9. The app is mixed hot enough to sit
    // alongside music playback; this catches peaks before the DAC without
    // squashing the whole engine signal like a compressor would.
    var softClip = ctx.createWaveShaper();
    softClip.curve = makeSoftClipCurve();
    softClip.oversample = "4x";

    var analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.8;

    var dry = ctx.createGain();
    dry.gain.value = 0.82;
    var wet = ctx.createGain();
    wet.gain.value = 0.3;
    var conv = null;
    try {
      conv = ctx.createConvolver();
      conv.buffer = makeIR(ctx);
      conv.normalize = true;
      eqHigh.connect(conv);
      conv.connect(wet);
      wet.connect(comp);
    } catch (err) {
      conv = null;
    }
    eqHigh.connect(dry);
    dry.connect(comp);
    comp.connect(master);
    master.connect(softClip);
    softClip.connect(analyser);
    analyser.connect(ctx.destination);

    state.eqLow = eqLow;
    state.eqMid = eqMid;
    state.eqHigh = eqHigh;
    state.comp = comp;
    state.master = master;
    state.softClip = softClip;
    state.analyser = analyser;
    state.convolver = conv;

    try { await ctx.resume(); } catch (err) { state.audioError = String(err); }

    var ok = await loadWorklet();
    if (!ok) {
      state.fallback = true;
      createFallback();
    }
    updateLatency();
    updateAudioStatus();
  }

  async function loadWorklet() {
    if (state.worklet) return true;
    if (!state.ctx) return false;
    if (!window.isSecureContext) {
      state.secureBlocked = true;
      state.workletError = "AudioWorklet requires HTTPS";
      return false;
    }
    if (!state.ctx.audioWorklet) {
      state.workletError = "AudioWorklet not supported";
      return false;
    }

    var source = document.getElementById("worklet-source");
    var code = source ? source.textContent : "";
    if (!code) {
      state.workletError = "empty worklet source";
      return false;
    }

    var registered = false;
    var start = performance.now();
    var blobUrl = null;
    try {
      var blob = new Blob([code], { type: "application/javascript" });
      blobUrl = URL.createObjectURL(blob);
      await withTimeout(state.ctx.audioWorklet.addModule(blobUrl), 8000, "Blob Worklet load timeout");
      registered = true;
      state.workletLoadMode = "blob";
    } catch (err) {
      state.workletLoadMode = null;
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }

    if (!registered) {
      try {
        var url = new URL("engine-worklet.js", window.location.href).href;
        await withTimeout(state.ctx.audioWorklet.addModule(url), 8000, "URL Worklet load timeout");
        registered = true;
        state.workletLoadMode = "url";
      } catch (err) {
        state.workletError = String(err);
      }
    }

    if (!registered) return false;

    var node = null;
    var nodeError = null;
    var optionSets = [
      { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" },
      { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] },
      {}
    ];
    for (var i = 0; i < optionSets.length; i++) {
      try { node = new AudioWorkletNode(state.ctx, "engine-p1", optionSets[i]); break; }
      catch (err) { nodeError = err; node = null; }
    }
    if (!node) {
      state.workletError = String(nodeError || "AudioWorkletNode failed");
      return false;
    }

    node.port.onmessage = onWorkletMessage;
    node.onprocessorerror = function (event) {
      state.workletError = event && event.message ? event.message : "processor error";
      showToast(t("audio.workletError"), 3600);
    };
    node.connect(state.eqLow);
    state.worklet = node;
    state.workletReady = true;
    state.workletError = null;
    state.fallback = false;
    node.port.postMessage({ type: "ping" });
    return true;
  }

  function createFallback() {
    if (state.fallbackOsc || !state.ctx || !state.eqLow) return;
    var ctx = state.ctx;
    var osc = ctx.createOscillator();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 30;
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;
    gain.gain.value = 0.0001;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(state.eqLow);
    osc.start();
    state.fallbackOsc = osc;
    state.fallbackFilter = filter;
    state.fallbackGain = gain;
  }

  function startFallback() {
    if (!state.fallbackGain || !state.ctx) return;
    var now = state.ctx.currentTime;
    state.fallbackGain.gain.cancelScheduledValues(now);
    state.fallbackGain.gain.setTargetAtTime(0.045, now, 0.06);
  }

  function stopFallback() {
    if (!state.fallbackGain || !state.ctx) return;
    var now = state.ctx.currentTime;
    state.fallbackGain.gain.cancelScheduledValues(now);
    state.fallbackGain.gain.setTargetAtTime(0.0001, now, 0.04);
  }

  function updateFallback() {
    if (!state.fallbackOsc || !state.fallbackFilter || !state.ctx) return;
    var rpm = state.engine === "running"
      ? state.drive.rpm
      : state.engine === "starting"
      ? state.preset.idle
      : 0;
    var f = Math.max(20, (rpm / 60) * 2);
    var now = state.ctx.currentTime;
    state.fallbackOsc.frequency.setTargetAtTime(f, now, 0.04);
    state.fallbackFilter.frequency.setTargetAtTime(500 + rpm * 0.45, now, 0.06);
  }

  function onAudioStateChange() {
    updateAudioStatus();
    updateDisplay();
    if (
      state.ctx &&
      state.ctx.state === "suspended" &&
      state.engine === "running" &&
      document.visibilityState === "visible" &&
      performance.now() - state.lastSuspendedToast > 4000
    ) {
      state.lastSuspendedToast = performance.now();
      showToast(t("toast.resumeFail"), 3000);
    }
  }

  function onWorkletMessage(event) {
    var msg = event.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "meter") {
      var now = performance.now();
      if (state.telemetry.lastAt) {
        var gap = now - state.telemetry.lastAt;
        state.telemetry.lastGap = gap;
        if (gap > state.telemetry.maxGap) state.telemetry.maxGap = gap;
      }
      state.telemetry.lastAt = now;
      state.telemetry.heartbeat += 1;
      state.telemetry.rpm = typeof msg.rpm === "number" ? msg.rpm : 0;
      state.telemetry.load = typeof msg.load === "number" ? msg.load : 0;
      state.telemetry.throttle = typeof msg.throttle === "number" ? msg.throttle : 0;
      state.telemetry.boost = typeof msg.boost === "number" ? msg.boost : 0;
      state.telemetry.rms = typeof msg.rms === "number" ? msg.rms : 0;
      state.telemetry.peak = typeof msg.peak === "number" ? msg.peak : 0;
      state.telemetry.mode = msg.mode || state.telemetry.mode;
      state.telemetry.fuelCut = !!msg.fuelCut;
      return;
    }

    if (msg.type === "state") {
      if (msg.state === "off" && state.engine === "running") {
        /* Worklet stopped unexpectedly. Keep the UI honest. */
        state.workletError = "worklet stopped";
      }
      return;
    }

    if (msg.type === "error") {
      state.workletError = msg.error ? String(msg.error) : "worklet error";
      showToast(t("audio.workletError"), 3600);
      return;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Engine start / stop                                                */
  /* ------------------------------------------------------------------ */

  function workletConfig() {
    var p = state.preset;
    return {
      cylinders: p.cylinders,
      offsets: p.offsets,
      banks: p.banks,
      idle: p.idle,
      redline: p.redline,
      limiter: p.limiter,
      maxRpm: p.maxRpm,
      res: p.res,
      decay: p.decay,
      pulseGain: p.pulseGain,
      click: p.click,
      subRatio: p.subRatio,
      subGain: p.subGain,
      intakeGain: p.intakeGain,
      crackle: p.crackle,
      turbo: p.turbo
    };
  }

  async function startEngine(mode) {
    if (state.busy || state.engine !== "off") return false;
    if (state.gps.watching) stopGps(true);
    state.busy = true;
    updateOverlayButtons();
    updateDisplay();
    showToast(t("toast.workletInit"), 1600);
    requestWakeLock(true);
    setModesExpanded(mode === "demo" || mode === "neutral" || mode === "cruise" || mode === "manual");

    // Start the GPS watch before the first await so the click's user
    // activation is still valid when the location permission prompt appears.
    if (mode === "gps") startGps(true);

    try {
      await ensureAudio();
    } catch (err) {
      state.audioError = String(err);
      state.busy = false;
      stopGps(true);
      releaseWakeLock(true);
      updateOverlayButtons();
      updateDisplay();
      showToast(t("toast.audioError", { error: String(err) }), 4200);
      return false;
    }

    if (!state.worklet && !state.fallback) {
      state.audioError = state.workletError || t("audio.workletError");
      state.busy = false;
      stopGps(true);
      releaseWakeLock(true);
      updateOverlayButtons();
      updateDisplay();
      showToast(t("toast.workletFail"), 4200);
      return false;
    }

    state.engine = "starting";
    state.mode = "neutral";
    state.pendingMode = mode || "neutral";
    state.timers.start = 0.95;
    state.timers.stop = 0;
    state.drive.speed = 0;
    state.drive.gear = 0;
    state.drive.rpm = 0;
    state.drive.throttle = 0;
    state.drive.brake = 0;
    state.drive.load = 0;
    state.drive.boost = 0;
    state.drive.accel = 0;
    state.drive.shiftTimer = 0;
    state.drive.shiftCooldown = 0;
    state.drive.limiterCut = false;
    state.drive.cruiseIntegral = 0;
    state.ui.throttleHeld = false;
    state.ui.brakeHeld = false;
    state.displayRpm = 0;
    state.telemetry.rpm = 0;
    state.telemetry.heartbeat = 0;
    state.telemetry.maxGap = 0;
    state.telemetry.lastAt = 0;

    try {
      if (state.worklet && state.workletReady) {
        state.worklet.port.postMessage({ type: "start", config: workletConfig() });
      } else {
        if (!state.fallback) {
          state.fallback = true;
          createFallback();
        }
        startFallback();
        showToast(t("toast.workletFail"), 3200);
      }
    } catch (err) {
      state.audioError = String(err);
      state.engine = "off";
      state.busy = false;
      stopGps(true);
      releaseWakeLock(true);
      updateOverlayButtons();
      updateDisplay();
      showToast(t("toast.audioError", { error: String(err) }), 4200);
      return false;
    }

    hideOverlay();
    state.busy = false;
    updateOverlayButtons();
    updateDisplay();
    drawTach();
    return true;
  }

  function stopEngine() {
    if (state.engine === "off" || state.engine === "stopping") return;
    stopGps(true);
    setModesExpanded(false);
    state.engine = "stopping";
    state.timers.stop = 0.9;
    state.timers.start = 0;
    state.drive.throttle = 0;
    state.drive.brake = 0;
    state.drive.load = 0;
    state.ui.throttleHeld = false;
    state.ui.brakeHeld = false;
    try {
      if (state.worklet && state.workletReady) state.worklet.port.postMessage({ type: "stop" });
    } catch (err) { /* ignore */ }
    stopFallback();
    releaseWakeLock(true);
    updateDisplay();
    drawTach();
  }

  function updateEngineTimers(dt) {
    if (state.engine === "starting") {
      state.timers.start -= dt;
      if (state.timers.start <= 0) {
        state.timers.start = 0;
        state.engine = "running";
        state.drive.rpm = state.preset.idle;
        state.drive.gear = 0;
        state.drive.speed = 0;
        state.mode = "neutral";
        state.displayRpm = state.preset.idle;
        var pending = state.pendingMode;
        state.pendingMode = null;
        showToast(t("toast.engineStarted"), 2000);
        if (pending && pending !== "neutral") setMode(pending, true);
        updateDisplay();
      }
    } else if (state.engine === "stopping") {
      state.timers.stop -= dt;
      if (state.timers.stop <= 0) {
        state.timers.stop = 0;
        state.engine = "off";
        state.mode = "neutral";
        state.drive.speed = 0;
        state.drive.gear = 0;
        state.drive.throttle = 0;
        state.drive.brake = 0;
        state.drive.load = 0;
        state.drive.boost = 0;
        state.drive.accel = 0;
        state.drive.shiftTimer = 0;
        state.displayRpm = 0;
        state.telemetry.rpm = 0;
        stopGps(true);
        stopFallback();
        releaseWakeLock(true);
        showToast(t("toast.engineStopped"), 2200);
        updateDisplay();
        drawTach();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Virtual drivetrain                                                 */
  /* ------------------------------------------------------------------ */

  function rpmFromSpeed(speed, gear, cfg) {
    if (gear < 1) return 0;
    var circumference = 2 * Math.PI * cfg.wheelR;
    return (speed / circumference) * cfg.gears[gear - 1] * cfg.final * 60;
  }

  function gearForSpeed(speed) {
    var cfg = state.preset.drive;
    var lo = Math.max(1000, state.preset.redline * 0.25);
    if (speed < 0.5) return 1;
    for (var g = 1; g <= cfg.gears.length; g++) {
      var rpm = rpmFromSpeed(speed, g, cfg);
      if (rpm >= lo && rpm <= cfg.shiftUp * 0.85) return g;
    }
    return cfg.gears.length;
  }

  function torqueCurve(rpm, peakRpm) {
    var x = clamp(rpm / Math.max(800, peakRpm), 0.2, 1.8);
    return clamp(0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, x / 1.6)), 0.3, 1.02);
  }

  /* ------------------------------------------------------------------ */
  /* GPS speed source                                                   */
  /* ------------------------------------------------------------------ */

  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function gpsStatusKey() {
    var g = state.gps;
    if (!g.supported) return "unsupported";
    if (g.permission === "denied") return "denied";
    if (g.error) return "error";
    if (!g.lastFixAt) return "waiting";
    var age = performance.now() - g.lastFixAt;
    if (document.visibilityState === "hidden") return "lost";
    if (age > GPS_FADE_START_MS) return "lost";
    if (age > GPS_STALE_MS) return "weak";
    return "active";
  }

  function gpsStatusKind(key) {
    if (key === "active") return "ok";
    if (key === "waiting" || key === "weak") return "warn";
    return "bad";
  }

  function gpsStatusText() {
    return t("gps." + gpsStatusKey());
  }

  function gpsSlope(seconds, now) {
    var h = state.gps.history;
    if (h.length < 2) return null;
    var target = now - seconds * 1000;
    var ref = h[0];
    for (var i = h.length - 1; i >= 0; i--) {
      if (h[i].t <= target) {
        ref = h[i];
        break;
      }
    }
    var dt = (now - ref.t) / 1000;
    if (dt < seconds * 0.55 || dt > seconds * 2.5) return null;
    return (h[h.length - 1].speed - ref.speed) / dt;
  }

  function applyGpsSample(speedMps, accuracy, heading, now, source) {
    var g = state.gps;
    if (!isFinite(speedMps) || speedMps < 0) return false;
    speedMps = clamp(speedMps, 0, 90);

    var dt = g.lastFixAt ? (now - g.lastFixAt) / 1000 : 0;
    if (g.lastSpeedMps !== null && dt > 0.15 && dt < 2.0) {
      var maxDelta = Math.max(3.0, dt * 5.0);
      var limited = clamp(speedMps, g.lastSpeedMps - maxDelta, g.lastSpeedMps + maxDelta);
      if (Math.abs(limited - speedMps) > 0.01) g.rejected++;
      speedMps = limited;
    }

    g.fixes += 1;
    g.watching = true;
    g.permission = "granted";
    g.error = null;
    g.lastFixAt = now;
    g.lastWall = Date.now();
    g.intervalMs = dt > 0 ? dt * 1000 : null;
    g.speedMps = speedMps;
    g.lastSpeedMps = speedMps;
    g.accuracy = typeof accuracy === "number" && isFinite(accuracy) ? accuracy : null;
    g.heading = typeof heading === "number" && isFinite(heading) ? heading : null;
    g.source = source || "gps";

    if (dt > 2.0) {
      g.gaps += 1;
      g.lastGapMs = dt * 1000;
      g.history = [];
      g.accel1 = 0;
      g.accel2 = 0;
    }
    g.history.push({ t: now, speed: speedMps });
    while (g.history.length && now - g.history[0].t > 5000) g.history.shift();

    if (dt > 2.0) {
      g.accel1 = 0;
      g.accel2 = 0;
    } else {
      var a1 = gpsSlope(1.0, now);
      var a2 = gpsSlope(2.0, now);
      g.accel1 = a1 === null ? 0 : clamp(a1, -4, 4);
      g.accel2 = a2 === null ? 0 : clamp(a2, -4, 4);
    }

    var acc = g.accuracy === null ? 10 : g.accuracy;
    g.confidence = clamp(1 - Math.max(0, acc - 2) / 12, 0.2, 1);

    if (state.mode === "gps" && state.engine === "running" &&
        (state.drive.gear < 1 || state.drive.speed < 0.5)) {
      state.drive.gear = gpsInitialGear(speedMps);
    }
    if (g.fixes === 1) showToast(t("toast.gpsReady"), 2200);
    updateDisplay();
    return true;
  }

  function onGpsFix(position) {
    var g = state.gps;
    var c = position.coords;
    var now = performance.now();
    var ts = position.timestamp || Date.now();
    var gpsSpeed = typeof c.speed === "number" && isFinite(c.speed) ? c.speed : null;
    var derived = null;

    if (g.lastPos && ts > g.lastPos.ts) {
      var dtPos = (ts - g.lastPos.ts) / 1000;
      if (dtPos >= 0.5 && dtPos < 15 && (c.accuracy === null || c.accuracy === undefined || c.accuracy < 100)) {
        var distance = haversine(g.lastPos.lat, g.lastPos.lon, c.latitude, c.longitude);
        derived = distance / dtPos;
      }
    }

    g.lastPos = {
      lat: c.latitude,
      lon: c.longitude,
      ts: ts
    };

    var speed = gpsSpeed !== null ? gpsSpeed : derived;
    if (speed === null) {
      g.error = t("gps.noSpeed");
      g.watching = true;
      updateDisplay();
      return;
    }
    applyGpsSample(speed, c.accuracy, c.heading, now, gpsSpeed !== null ? "gps" : "derived");
  }

  function onGpsError(error) {
    var g = state.gps;
    var message = error && error.message ? error.message : "GPS error";
    g.error = message;
    if (error && error.code === 1) {
      g.permission = "denied";
      g.watching = false;
      if (g.watchId !== null) {
        try { navigator.geolocation.clearWatch(g.watchId); } catch (err) { /* ignore */ }
        g.watchId = null;
      }
      showToast(t("toast.gpsDenied"), 3800);
    } else {
      showToast(t("toast.gpsError", { error: message }), 3800);
    }
    updateDisplay();
  }

  function startGps(silent) {
    var g = state.gps;
    if (g.watching) return true;
    if (!g.supported) {
      g.error = t("toast.gpsUnsupported");
      showToast(t("toast.gpsUnsupported"), 3400);
      updateDisplay();
      return false;
    }
    if (!g.secure) {
      g.error = t("toast.gpsSecure");
      showToast(t("toast.gpsSecure"), 3800);
      updateDisplay();
      return false;
    }

    g.error = null;
    g.permission = "prompt";
    g.lastFixAt = 0;
    g.lastWall = 0;
    g.intervalMs = null;
    g.speedMps = null;
    g.lastSpeedMps = null;
    g.accuracy = null;
    g.heading = null;
    g.source = "none";
    g.accel1 = 0;
    g.accel2 = 0;
    g.accelSmooth = 0;
    g.confidence = 0;
    g.fixes = 0;
    g.gaps = 0;
    g.lastGapMs = 0;
    g.history = [];
    g.lastPos = null;
    g.rejected = 0;
    g.uiStatus = "waiting";

    try {
      g.watchId = navigator.geolocation.watchPosition(
        onGpsFix,
        onGpsError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
      g.watching = true;
      if (!silent) showToast(t("toast.gpsWaiting"), 2600);
    } catch (err) {
      g.error = String(err);
      g.watching = false;
      showToast(t("toast.gpsError", { error: String(err) }), 3800);
    }
    updateDisplay();
    return g.watching;
  }

  function stopGps(silent) {
    var g = state.gps;
    if (g.watchId !== null) {
      try { navigator.geolocation.clearWatch(g.watchId); } catch (err) { /* ignore */ }
    }
    g.watchId = null;
    g.watching = false;
    g.lastFixAt = 0;
    g.lastWall = 0;
    g.intervalMs = null;
    g.speedMps = null;
    g.lastSpeedMps = null;
    g.accuracy = null;
    g.heading = null;
    g.source = "none";
    g.accel1 = 0;
    g.accel2 = 0;
    g.accelSmooth = 0;
    g.confidence = 0;
    g.history = [];
    g.lastPos = null;
    g.error = null;
    g.uiStatus = "idle";
    updateDisplay();
  }

  function restartGps() {
    stopGps(true);
    startGps(false);
  }

  function gpsInitialGear(speedMps) {
    if (speedMps < 0.5) return 1;
    var cfg = state.preset.drive;
    var lo = state.preset.redline * 0.28;
    var hi = state.preset.redline * 0.62;
    var fallback = 1;
    for (var g = 1; g <= cfg.gears.length; g++) {
      var rpm = rpmFromSpeed(speedMps, g, cfg);
      if (rpm >= lo && rpm <= hi) return g;
      if (rpm < lo) fallback = g;
    }
    return fallback;
  }

  function updateGpsDrive(dt, now) {
    var d = state.drive;
    var prevSpeed = d.speed;
    var p = state.preset;
    var cfg = p.drive;
    var g = state.gps;
    var age = g.lastFixAt ? now - g.lastFixAt : 999999;
    var hidden = document.visibilityState === "hidden";
    var fade = 1;

    if (age > GPS_FADE_START_MS) {
      fade = clamp(1 - (age - GPS_FADE_START_MS) / (GPS_FADE_END_MS - GPS_FADE_START_MS), 0, 1);
    }
    if (hidden && age > 1000) {
      fade = Math.min(fade, clamp(1 - (age - 1000) / 2500, 0, 1));
    }

    var stale = age > GPS_STALE_MS || g.speedMps === null;
    var targetSpeed = (g.speedMps === null ? 0 : g.speedMps) * fade;
    targetSpeed = Math.min(targetSpeed, cfg.topKmh / 3.6);
    var speedK = 1 - Math.exp(-dt / (stale ? 0.45 : 0.10));
    d.speed += (targetSpeed - d.speed) * speedK;
    if (d.speed < 0.03) d.speed = 0;

    var accelTarget = stale ? 0 : (g.accel1 * 0.7 + g.accel2 * 0.3) * fade;
    g.accelSmooth += (accelTarget - g.accelSmooth) * (1 - Math.exp(-dt / 0.12));

    var acc = g.accuracy === null ? 10 : g.accuracy;
    g.confidence = clamp(1 - Math.max(0, acc - 2) / 12, 0.2, 1) * clamp(1 - age / 8000, 0, 1);
    if (stale) g.confidence = Math.min(g.confidence, 0.3);
    if (hidden) g.confidence = Math.min(g.confidence, 0.15);

    d.shiftCooldown = Math.max(0, d.shiftCooldown - dt);
    d.limiterCut = false;
    if (d.shiftTimer > 0) d.shiftTimer -= dt;

    var targetThrottle = 0;
    if (d.speed > 0.6 && !stale) {
      if (g.accelSmooth > 0.12) targetThrottle = clamp(0.06 + g.accelSmooth * 0.35, 0, 1);
      else targetThrottle = 0.045;
      if (g.accelSmooth < -0.15) targetThrottle = 0;
    }
    var targetBrake = d.speed > 0.6 ? clamp(-g.accelSmooth / 3.2, 0, 1) : 0;
    d.throttle += (targetThrottle - d.throttle) * (1 - Math.exp(-dt / 0.16));
    d.brake += (targetBrake - d.brake) * (1 - Math.exp(-dt / 0.18));

    if (d.speed < 0.6) {
      d.gear = 1;
      d.rpm += (p.idle - d.rpm) * (1 - Math.exp(-dt / 0.15));
      d.load = 0;
      d.throttle = 0;
      d.brake = 0;
      d.boost = 0;
      d.limiterCut = false;
    } else {
      if (d.gear < 1) d.gear = gpsInitialGear(d.speed);

      var rpmWheel = rpmFromSpeed(d.speed, d.gear, cfg);
      if (d.shiftTimer <= 0) {
        var loadForShift = clamp(0.35 + Math.max(g.accelSmooth, 0) * 0.3, 0, 1);
        var upRpm = cfg.shiftUp * (0.55 + 0.45 * loadForShift);
        var downRpm = cfg.shiftDown;
        if (rpmWheel > upRpm && d.gear < cfg.gears.length && d.shiftCooldown <= 0) {
          d.gear += 1;
          d.shiftTimer = 0.16;
          d.shiftCooldown = 0.55;
          d.load = 0;
          d.throttle = 0;
        } else if (rpmWheel < downRpm && d.gear > 1 && d.shiftCooldown <= 0) {
          d.gear -= 1;
          d.shiftTimer = 0.12;
          d.shiftCooldown = 0.65;
          d.load = 0;
          d.throttle = 0;
        }
      }

      var targetRpm = Math.max(p.idle, rpmFromSpeed(d.speed, d.gear, cfg));
      d.rpm += (targetRpm - d.rpm) * (1 - Math.exp(-dt / 0.08));

      if (d.shiftTimer > 0 || stale) {
        d.load = 0;
        d.throttle = 0;
      } else if (g.accelSmooth < -0.15) {
        d.load = 0;
      } else {
        d.load = d.throttle;
      }

      if (d.rpm > p.limiter - 80) {
        d.limiterCut = true;
        d.load = 0;
        d.rpm = Math.min(d.rpm, p.limiter);
        d.throttle = Math.min(d.throttle, 0.25);
      }

      if (p.turbo) {
        var bt = d.load > 0.05 && d.rpm > 1500
          ? clamp(d.load * 0.75 + (d.rpm / p.redline) * 0.25, 0, 1)
          : 0;
        d.boost += (bt - d.boost) * (1 - Math.exp(-dt / 0.25));
      } else {
        d.boost = 0;
      }
    }

    if (fade < 1) {
      d.throttle *= fade;
      d.load *= fade;
      d.boost *= fade;
    }

    d.accel = dt > 0 ? (d.speed - prevSpeed) / dt : 0;
  }

  function renderGpsUi() {
    var g = state.gps;
    var active = state.mode === "gps" && state.engine !== "off";
    if (els.speedSource) {
      els.speedSource.textContent = active ? "GPS" : "SIM";
      els.speedSource.classList.toggle("gps", active);
    }
    if (els.gpsPanel) els.gpsPanel.hidden = !active;
    if (els.gpsBadge) els.gpsBadge.hidden = !active;
    if (!active) return;

    var status = gpsStatusKey();
    var kind = gpsStatusKind(status);
    if (els.gpsState) {
      els.gpsState.textContent = gpsStatusText();
      els.gpsState.className = "badge " + kind;
    }
    if (els.gpsBadge) {
      els.gpsBadge.textContent = "GPS · " + gpsStatusText();
      els.gpsBadge.className = "badge " + kind;
    }
    if (els.gpsSpeed) {
      els.gpsSpeed.textContent = g.speedMps === null ? "—" : (g.speedMps * 3.6).toFixed(1);
    }
    if (els.gpsAccuracy) {
      els.gpsAccuracy.textContent = g.accuracy === null
        ? "—"
        : t("gps.accuracyValue", { accuracy: g.accuracy.toFixed(1) });
    }
    if (els.gpsMeta) {
      if (!g.lastFixAt) {
        els.gpsMeta.textContent = g.error || t("gps.waiting");
      } else {
        var age = performance.now() - g.lastFixAt;
        var source = g.source === "derived" ? t("gps.sourceDerived") : t("gps.sourceGps");
        var meta = t("gps.meta", {
          accuracy: g.accuracy === null ? "—" : t("gps.accuracyValue", { accuracy: g.accuracy.toFixed(1) }),
          interval: g.intervalMs === null ? "—" : t("gps.intervalValue", { interval: Math.round(g.intervalMs) }),
          source: source
        });
        if (age > GPS_STALE_MS) meta += " · " + t("gps.ageValue", { age: (age / 1000).toFixed(1) });
        els.gpsMeta.textContent = meta;
      }
    }
    if (els.gpsRetry) els.gpsRetry.disabled = !g.supported;

    if (g.uiStatus !== status) {
      if (status === "lost" && (g.uiStatus === "active" || g.uiStatus === "weak")) {
        showToast(t("toast.gpsLost"), 2800);
      } else if (status === "active" && (g.uiStatus === "lost" || g.uiStatus === "weak") && g.fixes > 1) {
        showToast(t("toast.gpsReady"), 1800);
      }
      g.uiStatus = status;
    }
  }

  function setModesExpanded(expanded) {
    state.modesExpanded = !!expanded;
    if (els.advancedModes) els.advancedModes.hidden = !state.modesExpanded;
    if (els.modeUnlock) els.modeUnlock.hidden = state.modesExpanded;
  }

  function setMiniGauge(el, value, color) {
    if (!el) return;
    el.style.setProperty("--v", String(clamp(value, 0, 100)));
    if (color) el.style.setProperty("--gauge-color", color);
  }

  function updateAuxGauges() {
    var d = state.drive;
    var p = state.preset;
    var cfg = p.drive;
    var load = clamp(d.load, 0, 1);
    var torque = cfg.torque * torqueCurve(d.rpm, cfg.torqueRpm) * load;
    var power = Math.max(0, torque * d.rpm / 9549);
    var powerMax = Math.max(1, cfg.torque * p.redline / 9549);
    var torqueMax = Math.max(1, cfg.torque);

    setMiniGauge(els.powerGauge, (power / powerMax) * 100, p.accent);
    setText(els.powerVal, String(Math.round(power)));

    setMiniGauge(els.torqueGauge, (torque / torqueMax) * 100, p.accent);
    setText(els.torqueVal, String(Math.round(torque)));

    var g = state.engine === "running" ? (d.accel || 0) : 0;
    var gForce = g / 9.81;
    var gColor = g >= 0 ? p.accent2 : "#4aa8ff";
    setMiniGauge(els.gGauge, (Math.abs(g) / 3) * 100, gColor);
    setText(els.gVal, (gForce >= 0 ? "+" : "") + gForce.toFixed(2));

    if (state.mode === "gps" && state.engine === "running") {
      var status = gpsStatusKey();
      var gpsColor = status === "active" ? "#38d39f" : (status === "weak" || status === "waiting") ? "#ffb020" : "#ff4d5e";
      setMiniGauge(els.gpsGauge, clamp(state.gps.confidence, 0, 1) * 100, gpsColor);
      setText(els.gpsGaugeVal, state.gps.accuracy === null ? "—" : state.gps.accuracy.toFixed(1));
      setText(els.gpsGaugeSub, "m");
      if (els.gpsGauge) els.gpsGauge.style.setProperty("--gauge-color", gpsColor);
    } else {
      setMiniGauge(els.gpsGauge, 0, "#4aa8ff");
      setText(els.gpsGaugeVal, "SIM");
      setText(els.gpsGaugeSub, "GPS");
    }
  }

  function autoTargets(now, dt) {
    var d = state.drive;
    var targetSpeed = 0;
    var brake = 0;
    if (state.mode === "cruise") {
      targetSpeed = 80 / 3.6;
    } else if (state.mode === "demo") {
      var t = ((now - d.demoStart) / 1000) % 32;
      if (t < 3) targetSpeed = 0;
      else if (t < 9) targetSpeed = 60 / 3.6;
      else if (t < 16) targetSpeed = 130 / 3.6;
      else if (t < 21) targetSpeed = 100 / 3.6;
      else if (t < 26) targetSpeed = 50 / 3.6;
      else targetSpeed = 0;
      if (t >= 26) brake = 0.55;
    }

    var err = targetSpeed - d.speed;
    d.cruiseIntegral = clamp(d.cruiseIntegral + err * dt, -8, 8);
    var throttle = clamp(0.07 + err * 0.09 + d.cruiseIntegral * 0.025, 0, 1);
    if (d.speed > targetSpeed + 1.5) brake = Math.max(brake, 0.22);
    if (d.speed > targetSpeed + 4) throttle = 0;
    if (targetSpeed < 0.2 && d.speed < 0.4) {
      throttle = 0;
      brake = Math.max(brake, 0.2);
    }
    return { throttle: throttle, brake: brake };
  }

  function updateDrive(dt, now) {
    if (state.mode === "gps") {
      updateGpsDrive(dt, now);
      return;
    }
    var d = state.drive;
    var p = state.preset;
    var cfg = p.drive;
    var prevSpeed = d.speed;
    var targetThrottle = 0;
    var targetBrake = 0;

    if (state.mode === "manual" || state.mode === "neutral") {
      targetThrottle = state.ui.throttleHeld ? 1 : 0;
      targetBrake = state.ui.brakeHeld ? 1 : 0;
    } else {
      var auto = autoTargets(now, dt);
      targetThrottle = auto.throttle;
      targetBrake = auto.brake;
    }

    var kT = 1 - Math.exp(-dt / (targetThrottle > d.throttle ? 0.12 : 0.08));
    var kB = 1 - Math.exp(-dt / 0.1);
    d.throttle += (targetThrottle - d.throttle) * kT;
    d.brake += (targetBrake - d.brake) * kB;
    d.shiftCooldown = Math.max(0, d.shiftCooldown - dt);
    d.limiterCut = false;

    if (state.mode === "neutral") {
      d.gear = 0;
      var rpmTarget = p.idle + d.throttle * (p.redline - p.idle);
      d.rpm += (rpmTarget - d.rpm) * (1 - Math.exp(-dt / 0.09));
      d.load = d.throttle;
      var decel = d.brake * 6.5 + 0.5 + 0.0009 * d.speed * d.speed;
      d.speed = Math.max(0, d.speed - decel * dt);
    } else {
      if (d.gear === 0) d.gear = 1;

      if (d.shiftTimer > 0) {
        d.shiftTimer -= dt;
        d.load = 0;
        var shiftTarget = Math.max(p.idle, rpmFromSpeed(d.speed, d.gear, cfg));
        d.rpm += (shiftTarget - d.rpm) * (1 - Math.exp(-dt / 0.09));
        var coast = 0.5 + 0.0009 * d.speed * d.speed;
        d.speed = Math.max(0, d.speed - coast * dt);
      } else {
        var ratio = cfg.gears[d.gear - 1];
        var wheelR = cfg.wheelR;
        var rpmWheel = rpmFromSpeed(d.speed, d.gear, cfg);
        var targetRpm = Math.max(p.idle, rpmWheel);
        if (d.speed < 2.5 && d.throttle > 0.1) {
          targetRpm = Math.max(targetRpm, cfg.launchRpm);
        }
        d.rpm += (targetRpm - d.rpm) * (1 - Math.exp(-dt / 0.09));

        var torque = cfg.torque * torqueCurve(d.rpm, cfg.torqueRpm) * d.throttle;
        if (p.turbo) torque *= 0.55 + 0.45 * d.boost;
        var force = (torque * ratio * cfg.final / wheelR) * 0.9;
        var drag = 0.5 * 1.2 * cfg.drag * d.speed * d.speed;
        var rolling = cfg.mass * 9.81 * cfg.rolling;
        var brakeForce = d.brake * cfg.mass * 8.5;
        var accel = (force - drag - rolling - brakeForce) / cfg.mass;
        d.speed = clamp(d.speed + accel * dt, 0, cfg.topKmh / 3.6);

        var shiftUpNow = Math.max(
          2800,
          cfg.shiftUp * (0.55 + 0.45 * Math.min(1, d.throttle + 0.12))
        );
        if (d.rpm > shiftUpNow && d.gear < cfg.gears.length && d.shiftCooldown <= 0) {
          d.gear += 1;
          d.shiftTimer = 0.18;
          d.shiftCooldown = 0.65;
          d.load = 0;
        } else if (d.rpm < cfg.shiftDown && d.gear > 1 && d.shiftCooldown <= 0) {
          d.gear -= 1;
          d.shiftTimer = 0.12;
          d.shiftCooldown = 0.55;
          d.load = 0;
        } else {
          d.load = d.throttle;
        }
      }
    }

    if (d.rpm > p.limiter - 80) {
      d.limiterCut = true;
      d.load = 0;
      d.rpm = Math.min(d.rpm, p.limiter);
      d.throttle = Math.min(d.throttle, 0.25);
    }

    if (p.turbo) {
      var bt = (d.throttle > 0.05 && d.rpm > 1500)
        ? clamp(d.throttle * 0.75 + (d.rpm / p.redline) * 0.25, 0, 1)
        : 0;
      d.boost += (bt - d.boost) * (1 - Math.exp(-dt / 0.2));
    } else {
      d.boost = 0;
    }

    if (d.speed < 0.02) {
      d.speed = 0;
      if (d.brake > 0.3) {
        d.gear = 1;
        d.rpm += (p.idle - d.rpm) * (1 - Math.exp(-dt / 0.15));
      }
    }

    d.accel = dt > 0 ? (d.speed - prevSpeed) / dt : 0;
  }

  function updateIdle(dt) {
    var d = state.drive;
    if (state.engine === "off") {
      d.speed = 0;
      d.gear = 0;
      d.throttle = 0;
      d.brake = 0;
      d.load = 0;
      d.boost = 0;
    } else {
      d.throttle = 0;
      d.brake = 0;
      d.speed = 0;
      d.load = 0;
      d.boost *= 1 - Math.min(1, dt * 2);
      d.accel = 0;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mode                                                               */
  /* ------------------------------------------------------------------ */

  function setMode(mode, silent) {
    if (state.engine !== "running") {
      showToast(t("toast.startFirst"), 2400);
      return;
    }
    if (mode === state.mode) {
      if (mode === "gps" && !state.gps.watching) startGps(false);
      return;
    }

    var wasExpanded = state.modesExpanded;
    if (mode !== "gps" && state.gps.watching) stopGps(true);

    state.mode = mode;
    state.drive.cruiseIntegral = 0;
    state.drive.shiftTimer = 0;
    state.drive.shiftCooldown = 0;
    state.drive.limiterCut = false;
    state.ui.throttleHeld = false;
    state.ui.brakeHeld = false;

    if (mode === "neutral") {
      state.drive.gear = 0;
    } else if (mode === "gps") {
      var gpsSpeed = state.gps.speedMps !== null ? state.gps.speedMps : state.drive.speed;
      state.drive.gear = gpsInitialGear(gpsSpeed);
      startGps(true);
    } else if (state.drive.gear === 0) {
      state.drive.gear = gearForSpeed(state.drive.speed);
      if (state.drive.speed < 0.5) state.drive.gear = 1;
    }
    if (mode === "demo") {
      state.drive.demoStart = performance.now();
      setModesExpanded(true);
    } else if (mode === "neutral" || mode === "cruise" || mode === "manual") {
      setModesExpanded(true);
    }

    if (!silent) {
      showToast(t(mode === "demo" && !wasExpanded ? "toast.demoUnlock" : "toast." + mode), 2000);
    }
    updateDisplay();
  }

  /* ------------------------------------------------------------------ */
  /* Control / frame                                                    */
  /* ------------------------------------------------------------------ */

  function sendControl(now) {
    if (!state.worklet || !state.workletReady || state.engine !== "running") return;
    if (now - state.lastControl < 33) return;
    state.lastControl = now;
    var d = state.drive;
    var cut = d.shiftTimer > 0 || d.limiterCut;
    try {
      state.worklet.port.postMessage({
        type: "control",
        rpm: Math.round(d.rpm),
        throttle: d.throttle,
        load: d.load,
        boost: d.boost,
        gear: d.gear,
        valve: state.valve,
        cut: cut
      });
    } catch (err) { /* ignore */ }
  }

  function updateTach(dt) {
    var target = 0;
    if (state.engine !== "off") {
      if (state.workletReady && performance.now() - state.telemetry.lastAt < 500) {
        target = state.telemetry.rpm;
      } else {
        target = state.drive.rpm;
      }
    }
    if (state.engine === "starting" && target < 25) target = 0;
    var k = Math.min(1, dt * 10);
    state.displayRpm += (target - state.displayRpm) * k;
    if (Math.abs(state.displayRpm - target) < 0.5) state.displayRpm = target;
    if (state.displayRpm < 0) state.displayRpm = 0;
    if (state.displayRpm > state.preset.maxRpm) state.displayRpm = state.preset.maxRpm;
  }

  function updateFps(now) {
    state.fps.frames += 1;
    if (!state.fps.last) state.fps.last = now;
    if (now - state.fps.last >= 1000) {
      state.fps.value = (state.fps.frames * 1000) / (now - state.fps.last);
      state.fps.frames = 0;
      state.fps.last = now;
    }
  }

  function frame(now) {
    var dt = state.lastFrame ? (now - state.lastFrame) / 1000 : 0.016;
    state.lastFrame = now;
    if (dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05;

    updateEngineTimers(dt);
    if (state.engine === "running") updateDrive(dt, now);
    else updateIdle(dt);

    updateTach(dt);
    updateFps(now);
    if (state.fallback) updateFallback();
    sendControl(now);

    if (now - state.lastUi > 70) {
      state.lastUi = now;
      updateDisplay();
    }
    if (state.diagOpen && now - state.lastDiag > 450) {
      state.lastDiag = now;
      renderDiag();
    }
    drawTach();
    state.raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* Display                                                            */
  /* ------------------------------------------------------------------ */

  function updateAudioStatus() {
    if (!els.audioStatus) return;
    var text = t("audio.initializing");
    var cls = "";
    if (state.audioError) {
      text = t("audio.workletError");
      cls = " error";
    } else if (state.ctx && state.ctx.state !== "running") {
      text = t("audio.suspended");
      cls = " warn";
    } else if (state.workletReady && state.ctx) {
      text = t("audio.workletReady", { rate: (state.ctx.sampleRate / 1000).toFixed(1) });
    } else if (state.fallback) {
      text = t("audio.fallback");
      cls = " warn";
    }
    els.audioStatus.textContent = text;
    els.audioStatus.className = cls.trim();

    if (els.latencyBadge) {
      var total = state.latency.totalMs;
      if (total === null || total === undefined) {
        els.latencyBadge.textContent = "—";
        els.latencyBadge.className = "badge";
      } else {
        els.latencyBadge.textContent = Math.round(total) + " ms";
        els.latencyBadge.className = "badge " +
          (state.latency.rating === "good" ? "ok" : state.latency.rating === "ok" ? "warn" : "bad");
      }
    }
  }

  function updateDisplay() {
    var d = state.drive;
    var p = state.preset;
    var running = state.engine === "running";
    var gear = "N";
    if (running && state.mode !== "neutral" && d.gear > 0) gear = String(d.gear);
    var speedKmh = state.engine === "off" || state.engine === "starting" ? 0 : Math.round(d.speed * 3.6);
    var rpm = Math.round(state.displayRpm);
    var throttlePct = Math.round(d.throttle * 100);
    var brakePct = Math.round(d.brake * 100);
    var boostPct = p.turbo ? Math.round(d.boost * 100) : 0;

    setText(els.gear, gear);
    setText(els.gearText, gear);
    setText(els.speed, String(speedKmh));
    setText(els.speedText, String(speedKmh));
    setText(els.rpmText, String(rpm));
    setText(els.throttleText, String(throttlePct));
    setText(els.boostText, String(boostPct));
    setText(els.throttlePct, throttlePct + "%");
    setText(els.brakePct, brakePct + "%");
    setText(els.boostPct, boostPct + "%");
    setText(els.modeName, modeLabel(state.mode));
    setText(els.modeText, modeLabel(state.mode));
    setText(els.engineState, engineLabel(state.engine));
    setText(els.presetName, presetName(p));

    if (els.throttleBar) els.throttleBar.style.width = throttlePct + "%";
    if (els.brakeBar) els.brakeBar.style.width = brakePct + "%";
    if (els.boostBar) els.boostBar.style.width = boostPct + "%";
    if (els.throttleFill) els.throttleFill.style.height = throttlePct + "%";
    if (els.brakeFill) els.brakeFill.style.height = brakePct + "%";
    if (els.boostRow) els.boostRow.hidden = !p.turbo;
    if (els.boostStat) els.boostStat.hidden = !p.turbo;

    var shiftFrac = clamp((state.displayRpm - p.redline * 0.72) / (p.redline * 0.28), 0, 1);
    var activeLights = state.displayRpm >= p.redline ? shiftLightNodes.length : Math.floor(shiftFrac * shiftLightNodes.length);
    for (var i = 0; i < shiftLightNodes.length; i++) {
      shiftLightNodes[i].className = i < activeLights ? "on" + (i >= 4 ? " red" : "") : "";
    }

    var canPedal = running && (state.mode === "manual" || state.mode === "neutral");
    if (els.throttlePedal) {
      els.throttlePedal.disabled = !canPedal;
      els.throttlePedal.classList.toggle("auto", running && (state.mode === "cruise" || state.mode === "demo" || state.mode === "gps"));
    }
    if (els.brakePedal) {
      els.brakePedal.disabled = !canPedal;
      els.brakePedal.classList.toggle("auto", running && (state.mode === "cruise" || state.mode === "demo" || state.mode === "gps"));
    }

    var modeButtons = document.querySelectorAll("#modeList [data-mode]");
    for (var m = 0; m < modeButtons.length; m++) {
      var mb = modeButtons[m];
      var mm = mb.getAttribute("data-mode");
      mb.disabled = !running;
      mb.classList.toggle("active", mm === state.mode);
    }

    if (els.startBtn) {
      els.startBtn.hidden = state.engine !== "off";
      els.startBtn.disabled = state.busy;
    }
    if (els.stopBtn) {
      els.stopBtn.hidden = state.engine === "off";
      els.stopBtn.disabled = state.engine === "stopping";
    }
    if (els.panicBtn) els.panicBtn.hidden = state.engine === "off";

    if (els.presetTabs) els.presetTabs.classList.toggle("locked", state.engine !== "off");

    if (els.gpsRetry) els.gpsRetry.addEventListener("click", restartGps);

    if (els.valveBtn) {
      els.valveBtn.textContent = state.valve ? t("valve.open") : t("valve.closed");
    }
    setText(els.valveText, state.valve ? t("valve.openShort") : t("valve.closedShort"));

    if (els.wakeBtn) {
      var wakeApi = !!(navigator.wakeLock && navigator.wakeLock.request);
      els.wakeBtn.disabled = !wakeApi;
      els.wakeBtn.textContent = !wakeApi
        ? t("wake.unsupported")
        : state.wakeLock && !state.wakeLock.released
        ? t("wake.disable")
        : t("wake.off");
    }
    if (els.fsBtn) {
      var fsApi = !!(document.fullscreenEnabled || document.documentElement.requestFullscreen);
      els.fsBtn.disabled = !fsApi;
      els.fsBtn.textContent = state.fullscreen ? t("ui.exitFullscreen") : t("ui.fullscreen");
    }

    if (els.pedalHint) {
      if (!running) els.pedalHint.textContent = t("pedal.off");
      else if (state.mode === "gps") els.pedalHint.textContent = t("pedal.gps");
      else if (state.mode === "cruise" || state.mode === "demo") els.pedalHint.textContent = t("pedal.auto");
      else els.pedalHint.textContent = t("pedal.hold");
    }

    var hint = "hint.off";
    if (state.engine === "starting") hint = "hint.starting";
    else if (state.engine === "stopping") hint = "hint.stopping";
    else if (state.engine === "running") hint = "hint." + state.mode;
    if (els.hint) els.hint.textContent = t(hint);

    renderGpsUi();
    updateAuxGauges();
    updateAudioStatus();
  }

  /* ------------------------------------------------------------------ */
  /* Tachometer                                                         */
  /* ------------------------------------------------------------------ */

  function drawTach() {
    var canvas = els.tach;
    if (!canvas) return;
    var cssW = canvas.clientWidth;
    var cssH = canvas.clientHeight;
    if (cssW < 20 || cssH < 20) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.round(cssW * dpr);
    var ph = Math.round(cssH * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var p = state.preset;
    var cx = cssW / 2;
    var cy = cssH / 2;
    var radius = Math.min(cssW, cssH) / 2 - 8;
    if (radius < 20) return;
    var start = Math.PI * 0.75;
    var sweep = Math.PI * 1.5;
    var maxRpm = p.maxRpm;
    var redFrac = clamp(p.redline / maxRpm, 0, 1);
    var rpmFrac = clamp(state.displayRpm / maxRpm, 0, 1);

    // Outer speed ring: a second, quieter scale around the tach.
    var topSpeed = p.drive.topKmh || 300;
    var speedFrac = clamp(Math.abs(state.drive.speed * 3.6) / topSpeed, 0, 1);

    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.2, radius * 0.012);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.955, start, start + sweep);
    ctx.stroke();
    if (speedFrac > 0.001) {
      ctx.strokeStyle = p.accent2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.accent2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.955, start, start + sweep * speedFrac);
      ctx.stroke();
      var sa = start + sweep * speedFrac;
      ctx.fillStyle = p.accent2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(sa) * radius * 0.955, cy + Math.sin(sa) * radius * 0.955, radius * 0.013, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.lineWidth = radius * 0.075;
    ctx.strokeStyle = "rgba(255,255,255,0.075)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.85, start, start + sweep);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,59,77,0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.85, start + sweep * redFrac, start + sweep);
    ctx.stroke();

    if (rpmFrac > 0) {
      var activeTo = Math.min(rpmFrac, redFrac);
      ctx.strokeStyle = p.accent;
      ctx.shadowBlur = 18;
      ctx.shadowColor = p.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.85, start, start + sweep * activeTo);
      ctx.stroke();
      if (rpmFrac > redFrac) {
        ctx.strokeStyle = "#ff3b4d";
        ctx.shadowColor = "#ff3b4d";
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.85, start + sweep * redFrac, start + sweep * rpmFrac);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    var labelStep = maxRpm <= 10000 ? 1000 : 2000;
    var majorCount = Math.max(4, Math.round(maxRpm / labelStep));
    var ticks = majorCount * 2;
    for (var i = 0; i <= ticks; i++) {
      var frac = i / ticks;
      var a = start + sweep * frac;
      var major = i % 2 === 0;
      var inner = radius * (major ? 0.735 : 0.775);
      var outer = radius * 0.83;
      ctx.strokeStyle = major ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.18)";
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();

      if (major) {
        ctx.fillStyle = frac >= redFrac ? "#ff6b78" : "rgba(190,205,220,0.8)";
        ctx.font = "600 " + (radius * 0.062).toFixed(1) + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var lr = radius * 0.64;
        ctx.fillText(String(Math.round((i / 2) * labelStep / 1000)), cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
      }
    }

    var na = start + sweep * rpmFrac;
    ctx.strokeStyle = rpmFrac >= redFrac ? "#ff3b4d" : p.accent;
    ctx.shadowBlur = 12;
    ctx.shadowColor = rpmFrac >= redFrac ? "#ff3b4d" : p.accent;
    ctx.lineWidth = Math.max(2, radius * 0.012);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(na) * radius * 0.24, cy + Math.sin(na) * radius * 0.24);
    ctx.lineTo(cx + Math.cos(na) * radius * 0.8, cy + Math.sin(na) * radius * 0.8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = rpmFrac >= redFrac ? "#ff3b4d" : p.accent;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(na) * radius * 0.8, cy + Math.sin(na) * radius * 0.8, radius * 0.018, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(145,164,184,0.7)";
    ctx.font = "600 " + (radius * 0.045).toFixed(1) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("x1000 r/min", cx, cy + radius * 0.58);
  }

  /* ------------------------------------------------------------------ */
  /* Diagnostics                                                        */
  /* ------------------------------------------------------------------ */

  function diagRow(label, value) {
    var node = document.createElement("div");
    node.className = "diag-row";
    var k = document.createElement("span");
    k.textContent = label;
    var v = document.createElement("strong");
    v.textContent = value;
    node.appendChild(k);
    node.appendChild(v);
    return node;
  }

  function workletStatusText() {
    if (state.workletReady) return t("diag.workletPass");
    if (state.secureBlocked) return t("diag.workletBlocked");
    if (state.workletError) return t("diag.workletFail");
    return t("diag.none");
  }

  function renderDiag() {
    if (!els.diagRows) return;
    var ctx = state.ctx;
    var l = state.latency;
    var latencyText = l.totalMs === null
      ? t("diag.none")
      : (l.baseMs === null ? "—" : l.baseMs.toFixed(1)) + " + " +
        (l.outputMs === null ? "—" : l.outputMs.toFixed(1)) + " = " +
        l.totalMs.toFixed(1) + " ms";
    var rows = [
      diagRow(t("diag.worklet"), workletStatusText() + (state.workletLoadMode ? " · " + state.workletLoadMode : "")),
      diagRow(t("diag.context"), ctx ? ctx.state : t("diag.none")),
      diagRow(t("diag.sampleRate"), ctx ? ctx.sampleRate + " Hz" : t("diag.none")),
      diagRow(t("diag.latency"), latencyText),
      diagRow(t("diag.heartbeat"), state.telemetry.heartbeat
        ? state.telemetry.heartbeat + " · " + fmtMs(state.telemetry.lastGap, 0)
        : t("diag.none")),
      diagRow(t("diag.maxGap"), state.telemetry.maxGap ? fmtMs(state.telemetry.maxGap, 0) : t("diag.none")),
      diagRow(t("diag.fps"), Math.round(state.fps.value) + " fps"),
      diagRow(t("diag.gpsStatus"), gpsStatusText()),
      diagRow(t("diag.gpsSpeed"), state.gps.speedMps === null ? t("diag.none") : (state.gps.speedMps * 3.6).toFixed(1) + " km/h"),
      diagRow(t("diag.gpsAccuracy"), state.gps.accuracy === null ? t("diag.none") : state.gps.accuracy.toFixed(1) + " m"),
      diagRow(t("diag.gpsAccel"), state.gps.accel1.toFixed(2) + " / " + state.gps.accel2.toFixed(2) + " m/s²"),
      diagRow(t("diag.gpsAge"), state.gps.lastFixAt ? ((performance.now() - state.gps.lastFixAt) / 1000).toFixed(1) + " s" : t("diag.none")),
      diagRow(t("diag.gpsFixes"), String(state.gps.fixes) + " · " + state.gps.confidence.toFixed(2)),
      diagRow(t("diag.engine"), engineLabel(state.engine)),
      diagRow(t("diag.preset"), presetName(state.preset)),
      diagRow(t("diag.mode"), modeLabel(state.mode)),
      diagRow(t("diag.speed"), Math.round(state.drive.speed * 3.6) + " km/h"),
      diagRow(t("diag.gear"), state.mode === "neutral" ? "N" : String(state.drive.gear || "N")),
      diagRow(t("diag.valve"), state.valve ? t("valve.openShort") : t("valve.closedShort"))
    ];
    setChildren(els.diagRows, rows);
  }

  function diagnosticsObject() {
    return {
      schema: "nioengine.p1/1",
      generatedAt: new Date().toISOString(),
      build: BUILD,
      preset: state.presetId,
      engine: state.engine,
      mode: state.mode,
      speedKmh: Math.round(state.drive.speed * 3.6),
      gear: state.drive.gear,
      rpm: Math.round(state.displayRpm),
      volume: state.volume,
      valve: state.valve,
      worklet: {
        ready: state.workletReady,
        error: state.workletError,
        loadMode: state.workletLoadMode,
        secureBlocked: state.secureBlocked,
        fallback: state.fallback
      },
      context: state.ctx
        ? {
            state: state.ctx.state,
            sampleRate: state.ctx.sampleRate,
            baseLatency: state.ctx.baseLatency,
            outputLatency: state.ctx.outputLatency
          }
        : null,
      latency: state.latency,
      heartbeat: {
        count: state.telemetry.heartbeat,
        lastGapMs: state.telemetry.lastGap,
        maxGapMs: state.telemetry.maxGap
      },
      gps: {
        supported: state.gps.supported,
        secure: state.gps.secure,
        watching: state.gps.watching,
        permission: state.gps.permission,
        status: gpsStatusKey(),
        speedKmh: state.gps.speedMps === null ? null : state.gps.speedMps * 3.6,
        accuracyM: state.gps.accuracy,
        intervalMs: state.gps.intervalMs,
        ageMs: state.gps.lastFixAt ? performance.now() - state.gps.lastFixAt : null,
        accel1Mps2: state.gps.accel1,
        accel2Mps2: state.gps.accel2,
        confidence: state.gps.confidence,
        fixes: state.gps.fixes,
        gaps: state.gps.gaps,
        lastGapMs: state.gps.lastGapMs,
        rejected: state.gps.rejected,
        error: state.gps.error
      },
      fps: state.fps.value,
      audioError: state.audioError
    };
  }

  function spectrum() {
    if (!state.analyser || !state.ctx) return null;
    var data = new Float32Array(state.analyser.frequencyBinCount);
    state.analyser.getFloatFrequencyData(data);
    var binHz = state.ctx.sampleRate / state.analyser.fftSize;
    var peaks = [];
    for (var i = 2; i < data.length - 2; i++) {
      if (data[i] > -90 && data[i] > data[i - 1] && data[i] >= data[i + 1]) {
        peaks.push({ hz: +(i * binHz).toFixed(1), db: +data[i].toFixed(1) });
      }
    }
    peaks.sort(function (a, b) { return b.db - a.db; });
    return { sampleRate: state.ctx.sampleRate, binHz: binHz, peaks: peaks.slice(0, 18) };
  }

  /* ------------------------------------------------------------------ */
  /* Wake lock / fullscreen                                             */
  /* ------------------------------------------------------------------ */

  async function requestWakeLock(silent) {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return false;
    try {
      var sentinel = await navigator.wakeLock.request("screen");
      state.wakeLock = sentinel;
      state.wakeWanted = true;
      sentinel.addEventListener("release", function () {
        state.wakeLock = null;
        updateDisplay();
      });
      if (!silent) showToast(t("toast.wakeOn"), 1800);
      updateDisplay();
      return true;
    } catch (err) {
      state.wakeWanted = false;
      if (!silent) showToast(t("toast.wakeFail", { error: String(err) }), 3600);
      updateDisplay();
      return false;
    }
  }

  async function releaseWakeLock(silent) {
    state.wakeWanted = false;
    if (state.wakeLock) {
      try { await state.wakeLock.release(); } catch (err) { /* ignore */ }
      state.wakeLock = null;
    }
    if (!silent && navigator.wakeLock) showToast(t("toast.wakeOff"), 1800);
    updateDisplay();
  }

  async function toggleWakeLock() {
    if (state.wakeLock) await releaseWakeLock(false);
    else await requestWakeLock(false);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else throw new Error("fullscreen unsupported");
        showToast(t("toast.fullscreen"), 1600);
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
      }
    } catch (err) {
      showToast(t("toast.fullscreenFail", { error: String(err) }), 3600);
    }
    state.fullscreen = !!document.fullscreenElement;
    updateDisplay();
  }

  /* ------------------------------------------------------------------ */
  /* Overlay / start page                                               */
  /* ------------------------------------------------------------------ */

  function updateOverlayButtons() {
    if (els.overlayStart) els.overlayStart.disabled = state.busy;
    if (els.overlayDemo) els.overlayDemo.disabled = state.busy;
  }

  function hideOverlay() {
    if (els.startOverlay) els.startOverlay.hidden = true;
    state.overlay = false;
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                              */
  /* ------------------------------------------------------------------ */

  function cacheElements() {
    els = {
      startOverlay: byId("startOverlay"),
      overlayStart: byId("overlayStart"),
      overlayDemo: byId("overlayDemo"),
      overlayVersion: byId("overlayVersion"),
      presetCards: byId("presetCards"),
      presetTabs: byId("presetTabs"),
      presetName: byId("presetName"),
      engineState: byId("engineState"),
      modeList: byId("modeList"),
      advancedModes: byId("advancedModes"),
      modeUnlock: byId("modeUnlock"),
      startBtn: byId("startBtn"),
      stopBtn: byId("stopBtn"),
      panicBtn: byId("panicBtn"),
      gpsPanel: byId("gpsPanel"),
      gpsState: byId("gpsState"),
      gpsSpeed: byId("gpsSpeed"),
      gpsAccuracy: byId("gpsAccuracy"),
      gpsMeta: byId("gpsMeta"),
      gpsRetry: byId("gpsRetry"),
      gpsBadge: byId("gpsBadge"),
      speedSource: byId("speedSource"),
      valveBtn: byId("valveBtn"),
      wakeBtn: byId("wakeBtn"),
      fsBtn: byId("fsBtn"),
      diagBtn: byId("diagBtn"),
      diagPanel: byId("diagPanel"),
      diagClose: byId("diagClose"),
      diagCopy: byId("diagCopy"),
      diagRows: byId("diagRows"),
      volRange: byId("volRange"),
      volOut: byId("volOut"),
      tach: byId("tach"),
      gear: byId("gear"),
      gearText: byId("gearText"),
      speed: byId("speed"),
      speedText: byId("speedText"),
      rpmText: byId("rpmText"),
      throttleText: byId("throttleText"),
      boostText: byId("boostText"),
      throttlePct: byId("throttlePct"),
      brakePct: byId("brakePct"),
      boostPct: byId("boostPct"),
      throttleBar: byId("throttleBar"),
      brakeBar: byId("brakeBar"),
      boostBar: byId("boostBar"),
      boostRow: byId("boostRow"),
      boostStat: byId("boostStat"),
      powerGauge: byId("powerGauge"),
      powerVal: byId("powerVal"),
      torqueGauge: byId("torqueGauge"),
      torqueVal: byId("torqueVal"),
      gpsGauge: byId("gpsGauge"),
      gpsGaugeVal: byId("gpsGaugeVal"),
      gpsGaugeSub: byId("gpsGaugeSub"),
      gGauge: byId("gGauge"),
      gVal: byId("gVal"),
      throttlePedal: byId("throttlePedal"),
      brakePedal: byId("brakePedal"),
      throttleFill: null,
      brakeFill: null,
      pedalHint: byId("pedalHint"),
      modeName: byId("modeName"),
      modeText: byId("modeText"),
      valveText: byId("valveText"),
      hint: byId("hint"),
      audioStatus: byId("audioStatus"),
      latencyBadge: byId("latencyBadge"),
      toast: byId("toast"),
      shiftLights: byId("shiftLights")
    };
    if (els.throttlePedal) els.throttleFill = els.throttlePedal.querySelector(".fill");
    if (els.brakePedal) els.brakeFill = els.brakePedal.querySelector(".fill");
    shiftLightNodes = els.shiftLights ? Array.prototype.slice.call(els.shiftLights.children) : [];
  }

  function setPedal(which, held) {
    if (which === "throttle") state.ui.throttleHeld = held;
    else state.ui.brakeHeld = held;
  }

  function setupEvents() {
    if (els.overlayStart) els.overlayStart.addEventListener("click", function () { startEngine("gps"); });
    if (els.overlayDemo) els.overlayDemo.addEventListener("click", function () { startEngine("demo"); });
    if (els.startBtn) els.startBtn.addEventListener("click", function () { startEngine("gps"); });
    if (els.stopBtn) els.stopBtn.addEventListener("click", stopEngine);
    if (els.panicBtn) els.panicBtn.addEventListener("click", stopEngine);

    if (els.presetTabs) {
      els.presetTabs.addEventListener("click", function (event) {
        var target = event.target;
        while (target && target !== els.presetTabs && !target.getAttribute("data-preset")) {
          target = target.parentNode;
        }
        if (target && target.getAttribute && target.getAttribute("data-preset")) {
          setPreset(target.getAttribute("data-preset"));
        }
      });
    }

    if (els.modeList) {
      els.modeList.addEventListener("click", function (event) {
        var target = event.target;
        while (target && target !== els.modeList && !target.getAttribute("data-mode")) {
          target = target.parentNode;
        }
        if (target && target.getAttribute && target.getAttribute("data-mode")) {
          setMode(target.getAttribute("data-mode"), false);
        }
      });
    }

    var langButtons = document.querySelectorAll("[data-lang]");
    for (var i = 0; i < langButtons.length; i++) {
      (function (button) {
        button.addEventListener("click", function () { setLang(button.getAttribute("data-lang")); });
      })(langButtons[i]);
    }

    if (els.volRange) {
      els.volRange.addEventListener("input", function () {
        setVolume(Number(els.volRange.value) / 100);
      });
      els.volRange.addEventListener("change", function () {
        safeSet(VOLUME_KEY, String(state.volume));
      });
    }

    if (els.valveBtn) {
      els.valveBtn.addEventListener("click", function () {
        state.valve = state.valve ? 0 : 1;
        safeSet(VALVE_KEY, String(state.valve));
        updateDisplay();
        showToast(state.valve ? t("toast.valveOpen") : t("toast.valveClosed"), 1800);
      });
    }
    if (els.wakeBtn) els.wakeBtn.addEventListener("click", toggleWakeLock);
    if (els.fsBtn) els.fsBtn.addEventListener("click", toggleFullscreen);
    if (els.diagBtn) {
      els.diagBtn.addEventListener("click", function () {
        state.diagOpen = true;
        if (els.diagPanel) els.diagPanel.hidden = false;
        renderDiag();
      });
    }
    if (els.diagClose) {
      els.diagClose.addEventListener("click", function () {
        state.diagOpen = false;
        if (els.diagPanel) els.diagPanel.hidden = true;
      });
    }
    if (els.diagCopy) {
      els.diagCopy.addEventListener("click", function () {
        copyText(
          JSON.stringify(diagnosticsObject(), null, 2),
          t("diag.copied"),
          t("diag.copyFail")
        );
      });
    }

    function pedalDown(which, button) {
      return function (event) {
        if (!button || button.disabled) return;
        event.preventDefault();
        setPedal(which, true);
        button.classList.add("pressed");
        try { button.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
      };
    }
    function pedalUp(which, button) {
      return function () {
        setPedal(which, false);
        if (button) button.classList.remove("pressed");
      };
    }

    if (els.throttlePedal) {
      els.throttlePedal.addEventListener("pointerdown", pedalDown("throttle", els.throttlePedal));
      els.throttlePedal.addEventListener("pointerup", pedalUp("throttle", els.throttlePedal));
      els.throttlePedal.addEventListener("pointercancel", pedalUp("throttle", els.throttlePedal));
      els.throttlePedal.addEventListener("lostpointercapture", pedalUp("throttle", els.throttlePedal));
      els.throttlePedal.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
    if (els.brakePedal) {
      els.brakePedal.addEventListener("pointerdown", pedalDown("brake", els.brakePedal));
      els.brakePedal.addEventListener("pointerup", pedalUp("brake", els.brakePedal));
      els.brakePedal.addEventListener("pointercancel", pedalUp("brake", els.brakePedal));
      els.brakePedal.addEventListener("lostpointercapture", pedalUp("brake", els.brakePedal));
      els.brakePedal.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }

    window.addEventListener("blur", function () {
      state.ui.throttleHeld = false;
      state.ui.brakeHeld = false;
    });

    document.addEventListener("keydown", function (event) {
      var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (event.code === "Space") {
        event.preventDefault();
        if (state.engine === "running" && (state.mode === "manual" || state.mode === "neutral")) {
          state.ui.throttleHeld = true;
        }
      } else if (event.code === "KeyB") {
        if (state.engine === "running" && (state.mode === "manual" || state.mode === "neutral")) {
          state.ui.brakeHeld = true;
        }
      } else if (event.code === "Escape") {
        stopEngine();
      } else if (event.code === "KeyF") {
        toggleFullscreen();
      }
    });
    document.addEventListener("keyup", function (event) {
      if (event.code === "Space") state.ui.throttleHeld = false;
      else if (event.code === "KeyB") state.ui.brakeHeld = false;
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        if (state.ctx && state.ctx.state === "suspended" && state.engine === "running") {
          state.ctx.resume().catch(function () {
            showToast(t("toast.resumeFail"), 3200);
          });
        }
        if (state.wakeWanted && !state.wakeLock) requestWakeLock(true);
        if (state.mode === "gps" && state.engine === "running") {
          if (!state.gps.watching) {
            startGps(true);
          } else if (state.gps.lastFixAt && performance.now() - state.gps.lastFixAt > 8000) {
            restartGps();
          }
        }
      }
    });

    document.addEventListener("fullscreenchange", function () {
      state.fullscreen = !!document.fullscreenElement;
      updateDisplay();
      drawTach();
    });

    window.addEventListener("error", function (event) {
      if (event && event.message) showToast(event.message, 3600);
    });
    window.addEventListener("unhandledrejection", function (event) {
      var reason = event && event.reason ? String(event.reason) : "unhandled rejection";
      showToast(reason, 3600);
    });
  }

  function setVolume(value) {
    state.volume = clamp(Number(value) || 0, 0, 1);
    if (els.volRange) els.volRange.value = String(Math.round(state.volume * 100));
    setText(els.volOut, Math.round(state.volume * 100) + "%");
    if (state.master && state.ctx) {
      state.master.gain.setTargetAtTime(state.volume * OUTPUT_GAIN, state.ctx.currentTime, 0.03);
    }
  }

  function restoreSettings() {
    var lang = detectLang();
    state.lang = lang;

    var presetId = safeGet(PRESET_KEY);
    if (presetId && PRESETS[presetId]) {
      state.presetId = presetId;
      state.preset = PRESETS[presetId];
    }
    state.drive.rpm = state.preset.idle;

    var rawVolume = safeGet(VOLUME_KEY);
    if (rawVolume !== null) {
      var vol = Number(rawVolume);
      if (isFinite(vol) && vol >= 0 && vol <= 1) state.volume = vol;
    }
    var valve = safeGet(VALVE_KEY);
    if (valve === "1") state.valve = 1;
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                               */
  /* ------------------------------------------------------------------ */

  function injectGpsFix(data) {
    if (!data || typeof data.speedMps !== "number" || !isFinite(data.speedMps)) return false;
    state.gps.supported = true;
    state.gps.secure = true;
    state.gps.watching = true;
    state.gps.error = null;
    state.gps.permission = "granted";
    return applyGpsSample(
      data.speedMps,
      data.accuracyMps === undefined ? 1 : data.accuracyMps,
      data.headingDeg === undefined ? null : data.headingDeg,
      performance.now(),
      "gps"
    );
  }

  function init() {
    cacheElements();
    restoreSettings();
    setModesExpanded(false);
    applyI18n();
    updateLangButtons();
    setVolume(state.volume);
    buildPresetCards();
    refreshPresetUI();
    setupEvents();
    updateDisplay();
    updateOverlayButtons();
    setText(els.overlayVersion, "P1 · " + BUILD.version);
    drawTach();

    state.lastFrame = performance.now();
    state.lastUi = 0;
    state.raf = requestAnimationFrame(frame);

    window.__P1__ = {
      state: state,
      startEngine: startEngine,
      stopEngine: stopEngine,
      setMode: setMode,
      setPreset: setPreset,
      setVolume: setVolume,
      spectrum: spectrum,
      diagnostics: diagnosticsObject,
      gps: state.gps,
      startGps: startGps,
      stopGps: stopGps,
      restartGps: restartGps,
      injectGps: injectGpsFix
    };

    var params = new URLSearchParams(window.location.search);
    var auto = params.get("autostart");
    if (auto) {
      var mode = auto === "demo" ? "demo" : auto === "cruise" ? "cruise" : auto === "manual" ? "manual" : auto === "neutral" ? "neutral" : "gps";
      setTimeout(function () { startEngine(mode); }, 250);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
