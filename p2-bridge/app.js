/* Engine Sound Lab — P2.2 JS Bridge vehicle data probe.
   Read-only. No network, no uploads, no automatic setter calls. */
(function () {
  "use strict";

  var BUILD = window.P2B_BUILD || { version: "0.1.0", time: "" };
  var VERSION = BUILD.version || "0.1.0";

  var SAFE_READ_RE = /^(get|read|query|fetch|retrieve)[A-Z0-9_]/;
  var VEHICLE_TERM_RE = /vehicle|car|drive|driving|speed|rpm|gear|battery|soc|range|telemetry|engine|location|gps|sensor|odometer|tire|door|climate|power|torque|throttle|brake|steering|vin|model|energy|consumption|fuel|charging|status|data|info|accel|yaw|pitch|roll/i;
  var DANGER_RE = /(set|write|delete|remove|clear|start|stop|reset|send|post|update|enable|disable|control)/i;
  var BRIDGE_NAME_RE = /bridge|nio|vehicle|car|drive|native|android|host|telemetry|sensor|webkit|flutter|reactnative|cordova|uni/i;
  var NESTED_RE = /vehicle|car|drive|telemetry|data|info|status|engine|sensor|location|battery|soc|range|host|native|bridge|speed|rpm|gear|power|torque|throttle|brake/i;
  var FIELD_RE = /speed|velocity|rpm|engine|gear|battery|soc|charge|range|odometer|mileage|vin|location|latitude|longitude|lng|lat|heading|altitude|temperature|temp|tire|door|lock|climate|^ac$|power|torque|throttle|brake|steering|adas|energy|consumption|fuel|charging|model|brand|vehicle|car|driving|accel|yaw|pitch|roll/i;

  var GENERIC_METHODS = ["call", "invoke", "callHandler", "exec", "request"];
  var KNOWN_READ_METHODS = [
    "getVehicleInfo", "getVehicleData", "getVehicleStatus",
    "getCarInfo", "getCarData", "getCarStatus",
    "getDrivingData", "getDrivingInfo", "getTelemetry",
    "getSpeed", "getVehicleSpeed", "getRpm", "getGear",
    "getBattery", "getBatteryLevel", "getSoc", "getRange",
    "getLocation", "getOdometer", "getSensorData"
  ];

  var KNOWN_PATHS = [
    "window.NIO", "window.Nio", "window.nio",
    "window.NIOBridge", "window.NioBridge", "window.nioBridge", "window.NIOJSBridge", "window.NioJSBridge",
    "window.NIOVehicle", "window.NioVehicle", "window.nioVehicle",
    "window.NIOVehicleData", "window.NioVehicleData", "window.nioVehicleData",
    "window.NIOVehicleInfo", "window.NioVehicleInfo", "window.nioVehicleInfo",
    "window.NIOApi", "window.NioApi", "window.nioApi",
    "window.NIOCar", "window.NioCar", "window.nioCar",
    "window.NIOAuto", "window.NioAuto", "window.nioAuto",
    "window.JSBridge", "window.jsBridge", "window.JsBridge", "window.JSBRIDGE",
    "window.NativeBridge", "window.nativeBridge", "window.NativeJSBridge",
    "window.Android", "window.android", "window.AndroidBridge", "window.AndroidNative", "window.NativeAndroid",
    "window.bridge", "window.Bridge", "window.native", "window.Native", "window.NativeAPI", "window.nativeAPI", "window.NativeApi",
    "window.vehicle", "window.Vehicle", "window.vehicleInfo", "window.VehicleInfo",
    "window.car", "window.Car", "window.carInfo", "window.CarInfo",
    "window.auto", "window.Auto", "window.automotive", "window.Automotive",
    "window.driving", "window.Driving", "window.telemetry", "window.Telemetry",
    "window.sensor", "window.sensors",
    "window.app", "window.App", "window.host", "window.Host",
    "window.__bridge__", "window.__native__", "window.__NIO__", "window.__APP__",
    "window.ReactNativeWebView", "window.flutter_inappwebview", "window.cordova", "window.uni"
  ];

  var state = {
    scanned: false,
    probed: false,
    interacted: false,
    probing: false,
    cancel: false,
    env: null,
    bridges: [],
    calls: [],
    fields: [],
    messages: [],
    logs: [],
    progress: { total: 0, done: 0 },
    report: null,
    manualEntry: null,
    manualResult: null,
    startedAt: 0
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function truncate(value, max) {
    var s = String(value == null ? "" : value);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function nowIso() { return new Date().toISOString(); }

  function isObject(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }

  function isPromise(value) {
    return !!value && typeof value.then === "function";
  }

  function isDomNode(value) {
    return typeof Node !== "undefined" && value instanceof Node;
  }

  function isInspectable(value) {
    if (!isObject(value)) return false;
    if (value === window || value === document) return false;
    if (isDomNode(value)) return false;
    return true;
  }

  function isGlobalBridgeName(name) {
    if (!name || name === "webkit" || name === "chrome" || name === "external") return false;
    if (/(?:Bridge|bridge)$/.test(name)) return true;
    if (/^(?:NIO|Nio|nio|Native|native|Vehicle|vehicle|Telemetry|telemetry|Drive|drive|Android|android|JSBridge|AppBridge|NativeAPI|NativeApi)/.test(name)) return true;
    if (/^(?:Host|host)$/.test(name)) return true;
    if (/^(?:Car|Auto)(?:Info|Data|Status|Bridge|Api|API|Service|Manager|Native)?$/.test(name)) return true;
    return false;
  }

  function safeGetPath(path) {
    var parts = String(path || "").split(".");
    var obj = window;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "" || parts[i] === "window") continue;
      if (obj == null) return undefined;
      try { obj = obj[parts[i]]; } catch (e) { return undefined; }
    }
    return obj;
  }

  function serialize(value, depth, seen) {
    depth = depth || 0;
    seen = seen || [];
    if (value === null) return null;
    var t = typeof value;
    if (t === "undefined") return "[undefined]";
    if (t === "string") return truncate(value, 3000);
    if (t === "number" || t === "boolean") return value;
    if (t === "bigint") return String(value);
    if (t === "function") return "[Function " + (value.name || "anonymous") + "]";
    if (t === "symbol") return String(value);
    if (isDomNode(value)) return "[DOM " + (value.nodeName || "node") + "]";
    if (value === window) return "[Window]";
    if (depth > 4) return "[Object]";
    if (seen.indexOf(value) !== -1) return "[Circular]";
    seen.push(value);
    var out;
    if (Array.isArray(value)) {
      out = [];
      for (var i = 0; i < Math.min(value.length, 50); i++) out.push(serialize(value[i], depth + 1, seen));
      if (value.length > 50) out.push("… +" + (value.length - 50));
    } else {
      out = {};
      var keys = [];
      try { keys = Object.keys(value); } catch (e) { keys = []; }
      if (!keys.length) {
        try { keys = Object.getOwnPropertyNames(value); } catch (e2) { keys = []; }
      }
      for (var k = 0; k < Math.min(keys.length, 40); k++) {
        var key = keys[k];
        if (key === "window" || key === "document") continue;
        try { out[key] = serialize(value[key], depth + 1, seen); } catch (e3) { out[key] = "[throws]"; }
      }
      if (keys.length > 40) out.__more = "… +" + (keys.length - 40);
    }
    seen.pop();
    return out;
  }

  function serializeText(value) {
    try {
      var serialized = serialize(value, 0, []);
      if (typeof serialized === "string") return serialized;
      return JSON.stringify(serialized);
    } catch (e) {
      return "[unserializable]";
    }
  }

  function maybeParseJson(value) {
    if (typeof value !== "string") return value;
    var text = value.trim();
    if (!text || (text.charAt(0) !== "{" && text.charAt(0) !== "[")) return value;
    try { return JSON.parse(text); } catch (e) { return value; }
  }

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("timeout " + ms + "ms" + (label ? " · " + label : "")));
      }, ms);
      Promise.resolve(promise).then(function (value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }, function (error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /* ---------- environment ---------- */

  function collectEnv() {
    var ua = navigator.userAgent || "";
    var hints = [];
    if (window.webkit) hints.push("window.webkit");
    if (window.chrome && window.chrome.webview) hints.push("chrome.webview");
    if (window.Android) hints.push("window.Android");
    if (window.ReactNativeWebView) hints.push("ReactNativeWebView");
    if (window.flutter_inappwebview) hints.push("flutter_inappwebview");
    if (window.cordova) hints.push("cordova");
    if (window.uni) hints.push("uni-app");
    if (/NioBrowser|NIO|Nio/i.test(ua)) hints.push("UA: NIO");
    if (/; wv\)/i.test(ua) || /WebView/i.test(ua)) hints.push("UA: WebView");
    if (/Android/i.test(ua)) hints.push("Android");
    if (/iPhone|iPad|iPod/i.test(ua)) hints.push("iOS");
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { tz = ""; }
    return {
      url: location.href,
      secure: !!window.isSecureContext,
      protocol: location.protocol,
      ua: ua,
      platform: navigator.platform || "",
      vendor: navigator.vendor || "",
      language: navigator.language || "",
      languages: (navigator.languages || []).join(", "),
      timezone: tz,
      screen: (screen.width || 0) + "×" + (screen.height || 0) + " @ " + (window.devicePixelRatio || 1) + "x",
      viewport: window.innerWidth + "×" + window.innerHeight,
      touchPoints: navigator.maxTouchPoints || 0,
      webviewHints: hints.length ? hints : ["无明显 WebView 标记"],
      hasWebkit: !!window.webkit,
      hasChromeWebview: !!(window.chrome && window.chrome.webview),
      hasAndroid: !!window.Android,
      hasNio: !!(window.NIO || window.Nio || window.nio || window.NIOBridge || window.NioBridge),
      host: location.host
    };
  }

  function renderEnv() {
    var env = state.env;
    if (!env) return;
    var secureLabel = env.protocol === "https:" ? "HTTPS" : (env.secure ? "SECURE" : "非 HTTPS");
    els.secureBadge.textContent = secureLabel;
    els.secureBadge.className = "pill " + (env.secure ? "ok" : "bad");
    els.envBadge.textContent = env.secure ? (env.protocol === "https:" ? "HTTPS" : "LOCAL SECURE") : "INSECURE";
    els.envBadge.className = "pill " + (env.secure ? "ok" : "bad");

    var rows = [
      ["URL", env.url, ""],
      ["安全上下文", (env.secure ? "是" : "否") + " · " + env.protocol + (env.secure ? " / secure context" : " / 非安全上下文"), env.secure ? "ok" : "bad"],
      ["平台", (env.platform || "—") + (env.vendor ? " · " + env.vendor : ""), ""],
      ["语言", (env.language || "—") + (env.languages ? " · " + env.languages : ""), ""],
      ["屏幕", env.screen + " · viewport " + env.viewport, ""],
      ["触摸点", String(env.touchPoints), ""],
      ["时区", env.timezone || "—", ""],
      ["WebView 标记", env.webviewHints.join(" · "), env.webviewHints.length && env.webviewHints[0] !== "无明显 WebView 标记" ? "warn" : ""],
      ["User-Agent", env.ua || "—", ""]
    ];
    els.envRows.innerHTML = rows.map(function (r) {
      return '<div class="row"><span>' + esc(r[0]) + '</span><strong class="' + r[2] + '">' + esc(r[1]) + '</strong></div>';
    }).join("");
  }

  /* ---------- bridge discovery ---------- */

  function methodNames(obj) {
    var out = [];
    var seen = {};
    var cur = obj;
    var depth = 0;
    while (cur && cur !== Object.prototype && depth < 4) {
      var names = [];
      try { names = Object.getOwnPropertyNames(cur); } catch (e) { names = []; }
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (name === "constructor" || name === "toString" || name === "valueOf" ||
            name === "hasOwnProperty" || name === "__proto__" || name === "isPrototypeOf" ||
            name === "propertyIsEnumerable" || name === "toLocaleString" || seen[name]) continue;
        seen[name] = true;
        var desc = null;
        try { desc = Object.getOwnPropertyDescriptor(cur, name); } catch (e2) { desc = null; }
        if (desc && typeof desc.value === "function") {
          var len = 0;
          try { len = desc.value.length || 0; } catch (e3) { len = 0; }
          out.push({ name: name, length: len });
          if (out.length >= 90) return out;
        }
      }
      try { cur = Object.getPrototypeOf(cur); } catch (e4) { cur = null; }
      depth++;
    }
    return out;
  }

  function propertyNames(obj) {
    var out = [];
    var names = [];
    try { names = Object.getOwnPropertyNames(obj); } catch (e) { names = []; }
    for (var i = 0; i < names.length && out.length < 30; i++) {
      var name = names[i];
      if (name === "constructor" || name === "prototype" || name === "length" || name === "name") continue;
      var desc = null;
      try { desc = Object.getOwnPropertyDescriptor(obj, name); } catch (e2) { desc = null; }
      if (!desc) continue;
      if (typeof desc.value === "function") continue;
      var value = desc.value;
      var type = value === null ? "null" : typeof value;
      if (value !== null && (type === "object" || type === "function")) {
        if (isDomNode(value)) type = "DOM";
        else if (Array.isArray(value)) type = "array[" + value.length + "]";
        else type = "object";
      }
      var preview;
      if (value === null) preview = "null";
      else if (type === "object" || type === "array") preview = "[" + type + "]";
      else preview = truncate(String(value), 90);
      out.push({ name: name, type: type, preview: preview });
    }
    return out;
  }

  function isSafeMethod(name) {
    if (!SAFE_READ_RE.test(name)) return false;
    if (DANGER_RE.test(name)) return false;
    if (!VEHICLE_TERM_RE.test(name)) return false;
    return true;
  }

  function isGenericMethod(entry, name) {
    if (GENERIC_METHODS.indexOf(name) === -1) return false;
    if (!entry || !entry.obj) return false;
    if (name === "call" && entry.obj.call === Function.prototype.call) return false;
    if (name === "apply" && entry.obj.apply === Function.prototype.apply) return false;
    if (name === "bind" && entry.obj.bind === Function.prototype.bind) return false;
    return typeof entry.obj[name] === "function";
  }

  function addBridge(path, obj, source, note) {
    if (!isInspectable(obj)) return null;
    if (state.bridges.length >= 80) return null;
    for (var i = 0; i < state.bridges.length; i++) {
      if (state.bridges[i].obj === obj) return state.bridges[i];
    }
    var methods = methodNames(obj);
    var props = propertyNames(obj);
    var safe = methods.filter(function (m) { return isSafeMethod(m.name); });
    var entry = {
      path: path,
      obj: obj,
      source: source || "scan",
      note: note || "",
      methods: methods,
      props: props,
      safeMethods: safe,
      genericMethods: methods.filter(function (m) { return isGenericMethod({ obj: obj }, m.name); }),
      webkit: source === "webkit" || (path.indexOf("messageHandlers.") !== -1),
      hostPost: source === "host" || path.indexOf("chrome.webview") !== -1
    };
    state.bridges.push(entry);
    return entry;
  }

  function addKnownPath(path) {
    var value;
    try { value = safeGetPath(path); } catch (e) { value = undefined; }
    if (!isInspectable(value)) return;
    addBridge(path, value, path.indexOf("messageHandlers") !== -1 ? "webkit" : "known");
  }

  function addWebkitHandlers() {
    var handlers;
    try { handlers = window.webkit && window.webkit.messageHandlers; } catch (e) { handlers = null; }
    if (!handlers || typeof handlers !== "object") return;
    var keys = [];
    try { keys = Object.keys(handlers); } catch (e2) { keys = []; }
    for (var i = 0; i < keys.length && i < 20; i++) {
      var name = keys[i];
      var handler;
      try { handler = handlers[name]; } catch (e3) { handler = null; }
      addBridge("window.webkit.messageHandlers." + name, handler, "webkit",
        "WKWebView handler；网页只能 postMessage，返回值需要原生侧回调或 Host 消息。");
    }
  }

  function addChromeWebview() {
    var cw = window.chrome && window.chrome.webview;
    if (!isInspectable(cw)) return;
    addBridge("window.chrome.webview", cw, "host",
      "WebView2 / chrome.webview；postMessage 没有网页侧返回值，Host 消息会记录在上方。");
  }

  function addGlobalScan() {
    var names = [];
    try { names = Object.getOwnPropertyNames(window); } catch (e) { names = []; }
    var skip = {
      window: 1, document: 1, location: 1, navigation: 1, history: 1, screen: 1,
      performance: 1, crypto: 1, indexedDB: 1, localStorage: 1, sessionStorage: 1,
      navigator: 1, console: 1, frames: 1, parent: 1, top: 1, self: 1, opener: 1,
      globalThis: 1, origin: 1, name: 1, status: 1, closed: 1, length: 1, frameElement: 1,
      webkit: 1, chrome: 1, external: 1, speechSynthesis: 1, visualViewport: 1,
      customElements: 1, caches: 1, cookieStore: 1, scheduler: 1
    };
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (skip[name] || !isGlobalBridgeName(name)) continue;
      var desc;
      try { desc = Object.getOwnPropertyDescriptor(window, name); } catch (e2) { desc = null; }
      if (!desc || !("value" in desc)) continue;
      var value = desc.value;
      if (!isInspectable(value) || typeof value !== "object" || value === null) continue;
      addBridge("window." + name, value, "window-scan");
    }
  }

  function addNestedBridges() {
    var roots = state.bridges.slice();
    for (var r = 0; r < roots.length; r++) {
      var entry = roots[r];
      if (!entry || !entry.obj) continue;
      var names = [];
      try { names = Object.getOwnPropertyNames(entry.obj); } catch (e) { names = []; }
      for (var i = 0; i < names.length && i < 30; i++) {
        var name = names[i];
        if (!NESTED_RE.test(name)) continue;
        var desc;
        try { desc = Object.getOwnPropertyDescriptor(entry.obj, name); } catch (e2) { desc = null; }
        if (!desc || !("value" in desc)) continue;
        var value = desc.value;
        if (!isInspectable(value) || typeof value !== "object" || value === null) continue;
        addBridge(entry.path + "." + name, value, "nested");
      }
    }
  }

  function scanBridges() {
    state.bridges = [];
    for (var i = 0; i < KNOWN_PATHS.length; i++) addKnownPath(KNOWN_PATHS[i]);
    addWebkitHandlers();
    addChromeWebview();
    addGlobalScan();
    addNestedBridges();
    state.scanned = true;
    state.bridges.sort(function (a, b) {
      var rank = { known: 0, webkit: 1, host: 2, "window-scan": 3, nested: 4 };
      return (rank[a.source] || 9) - (rank[b.source] || 9) || a.path.localeCompare(b.path);
    });
    renderBridges();
    renderManual();
    updateVerdict();
    publishReport();
    log("扫描完成：发现 " + state.bridges.length + " 个桥/对象候选", state.bridges.length ? "ok" : "warn");
    return state.bridges;
  }

  /* ---------- safe calls ---------- */

  function resolveMethod(obj, name) {
    if (!obj) return null;
    var fn = null;
    try { fn = obj[name]; } catch (e) { return null; }
    return typeof fn === "function" ? fn : null;
  }

  function callWithCallback(fn, thisArg, args, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("callback timeout " + timeoutMs + "ms"));
      }, timeoutMs);
      var callback = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        var values = Array.prototype.slice.call(arguments);
        resolve(values.length === 1 ? values[0] : values);
      };
      try {
        var returned = fn.apply(thisArg, args.concat(callback));
        if (returned !== undefined && !isPromise(returned)) {
          setTimeout(function () {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(returned);
          }, 0);
        } else if (isPromise(returned)) {
          returned.then(function (value) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(value);
          }, function (error) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            reject(error);
          });
        }
      } catch (e) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(e);
        }
      }
    });
  }

  async function callOne(entry, mode, methodName, args, opts) {
    opts = opts || {};
    if (!entry || !entry.obj) throw new Error("bridge missing");
    var started = performance.now();
    var record = {
      id: state.calls.length + 1,
      at: nowIso(),
      bridge: entry.path,
      source: entry.source,
      mode: mode,
      method: methodName,
      args: serialize(args || [], 0, []),
      status: "running",
      ms: 0,
      result: null,
      resultText: "",
      error: "",
      fields: 0,
      manual: !!opts.manual
    };

    try {
      var fn;
      var callArgs = args || [];
      if (mode === "direct") {
        fn = resolveMethod(entry.obj, methodName);
        if (!fn) throw new Error("不是函数 / not a function: " + methodName);
      } else if (mode === "postMessage") {
        fn = resolveMethod(entry.obj, "postMessage");
        if (!fn) throw new Error("没有 postMessage");
        callArgs = args && args.length ? args : [{}];
      } else {
        fn = resolveMethod(entry.obj, mode);
        if (!fn) throw new Error("没有通用调用器: " + mode);
        callArgs = [methodName].concat(args || []);
      }

      if (opts.skipArgs && mode === "direct" && fn.length > 0) {
        throw new Error("方法需要参数（length=" + fn.length + "），自动探测已跳过");
      }

      var result;
      if (opts.callback) {
        result = await callWithCallback(fn, entry.obj, callArgs, opts.timeout || 1600);
      } else {
        result = fn.apply(entry.obj, callArgs);
        if (isPromise(result)) result = await withTimeout(result, opts.timeout || 1600, methodName);
      }

      record.status = "ok";
      record.result = serialize(result, 0, []);
      record.resultText = truncate(serializeText(result), 2600);
      if (mode === "postMessage" && result === undefined) {
        record.status = "sent";
        record.resultText = "消息已发送；WebView postMessage 没有网页侧返回值，请查看 Host 消息或原生日志。";
      }
      var before = state.fields.length;
      extractFields(maybeParseJson(result), entry.path + " · " + methodName);
      record.fields = state.fields.length - before;
      if (record.fields > 0) record.status = "data";
    } catch (e) {
      record.status = /timeout/i.test(String(e && e.message)) ? "timeout" : "error";
      record.error = String((e && e.message) || e);
      record.resultText = record.error;
    }

    record.ms = Math.round(performance.now() - started);
    state.calls.push(record);
    if (state.calls.length > 120) state.calls.splice(0, state.calls.length - 120);
    renderCalls();
    renderFields();
    updateVerdict();
    publishReport();
    return record;
  }

  function buildTasks() {
    var tasks = [];
    var seen = {};
    function add(entry, mode, method, args, kind) {
      var key = entry.path + "|" + mode + "|" + method;
      if (seen[key]) return;
      seen[key] = true;
      tasks.push({ entry: entry, mode: mode, method: method, args: args || [], kind: kind });
    }
    for (var i = 0; i < state.bridges.length; i++) {
      var entry = state.bridges[i];
      if (entry.webkit) continue;
      for (var s = 0; s < entry.safeMethods.length; s++) {
        var m = entry.safeMethods[s];
        if (m.length > 0) {
          log("跳过 " + entry.path + "." + m.name + "：需要参数/回调", "warn");
          continue;
        }
        add(entry, "direct", m.name, [], "safe");
      }
      if (els.genericToggle && els.genericToggle.checked) {
        for (var g = 0; g < entry.genericMethods.length; g++) {
          var gm = entry.genericMethods[g];
          for (var n = 0; n < KNOWN_READ_METHODS.length; n++) {
            add(entry, gm.name, KNOWN_READ_METHODS[n], [KNOWN_READ_METHODS[n]], "generic");
          }
        }
      }
    }
    if (tasks.length > 96) {
      log("安全任务超过 96 个，截断到前 96 个", "warn");
      tasks = tasks.slice(0, 96);
    }
    return tasks;
  }

  async function runProbe() {
    if (state.probing) {
      state.cancel = true;
      els.probeBtn.textContent = "正在停止…";
      setStatus("正在停止当前探测…", "warn");
      return;
    }

    state.probing = true;
    state.probed = true;
    state.interacted = true;
    state.cancel = false;
    state.calls = [];
    state.fields = [];
    state.progress = { total: 0, done: 0 };
    state.startedAt = performance.now();
    els.probeBtn.textContent = "停止探测";
    els.probeBtn.classList.add("is-running");
    setStatus("扫描桥对象…", "warn");
    log("开始只读探测", "ok");

    scanBridges();
    renderCalls();
    renderFields();

    if (!state.bridges.length) {
      finishProbe("未发现桥，无法调用。");
      return;
    }

    var tasks = buildTasks();
    state.progress.total = tasks.length;
    if (!tasks.length) {
      finishProbe("发现桥，但没有可安全自动调用的无参 get* 方法。");
      return;
    }

    for (var i = 0; i < tasks.length; i++) {
      if (state.cancel) break;
      var task = tasks[i];
      state.progress.done = i;
      els.probeBadge.textContent = (i + 1) + " / " + tasks.length;
      els.probeBadge.className = "pill blue";
      setStatus("探测 " + (i + 1) + "/" + tasks.length + " · " + task.entry.path + " · " + task.method, "warn");
      await callOne(task.entry, task.mode, task.method, task.args, {
        skipArgs: true,
        timeout: task.kind === "generic" ? 1300 : 1500
      });
      await new Promise(function (resolve) { setTimeout(resolve, 35); });
    }

    state.progress.done = tasks.length;
    finishProbe(state.cancel ? "已手动停止。" : "只读探测完成。");
  }

  function finishProbe(message) {
    state.probing = false;
    state.cancel = false;
    els.probeBtn.textContent = "开始只读探测";
    els.probeBtn.classList.remove("is-running");
    if (state.progress.total) {
      els.probeBadge.textContent = state.progress.done + " / " + state.progress.total;
      els.probeBadge.className = "pill " + (state.fields.length ? "ok" : "warn");
    } else {
      els.probeBadge.textContent = "—";
      els.probeBadge.className = "pill neutral";
    }
    setStatus(message, state.fields.length ? "ok" : "warn");
    log(message, state.fields.length ? "ok" : "warn");
    renderCalls();
    renderFields();
    updateVerdict();
    publishReport();
  }

  /* ---------- field extraction ---------- */

  function cleanFieldValue(value) {
    if (value === null) return "null";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "string") return truncate(value, 160);
    return truncate(serializeText(value), 160);
  }

  function extractFields(value, source, depth, seen) {
    depth = depth || 0;
    seen = seen || [];
    if (depth > 4 || value == null) return;
    if (typeof value === "string") {
      var parsed = maybeParseJson(value);
      if (parsed !== value) extractFields(parsed, source, depth + 1, seen);
      return;
    }
    if (!isObject(value) || isDomNode(value) || isInspectable(value) === false) return;
    if (seen.indexOf(value) !== -1) return;
    seen.push(value);

    var keys = [];
    try { keys = Object.keys(value); } catch (e) { keys = []; }
    for (var i = 0; i < keys.length && state.fields.length < 120; i++) {
      var key = keys[i];
      var child;
      try { child = value[key]; } catch (e2) { continue; }
      var path = source + "." + key;
      if (child !== null && typeof child === "object") {
        if (FIELD_RE.test(key)) {
          // Keep walking; the leaf values are what matter.
        }
        extractFields(child, path, depth + 1, seen);
      } else if (FIELD_RE.test(key)) {
        var text = cleanFieldValue(child);
        var duplicate = false;
        for (var f = 0; f < state.fields.length; f++) {
          if (state.fields[f].path === path && state.fields[f].value === text) { duplicate = true; break; }
        }
        if (!duplicate) {
          state.fields.push({ path: path, key: key, value: text, at: nowIso() });
        }
      }
    }
    seen.pop();
  }

  /* ---------- verdict / render ---------- */

  function updateVerdict() {
    var title = "等待探测";
    var body = "先扫描桥；只有你点“开始只读探测”后，页面才会尝试调用安全的 get* 方法。";
    var cls = "idle";

    if (state.probing) {
      title = "正在只读探测…";
      body = "只调用 get/read/query 且无参数的车辆语义方法。";
      cls = "warn";
    } else if (!state.scanned) {
      title = "尚未扫描";
    } else if (state.fields.length) {
      title = "已取得 " + state.fields.length + " 项行车字段";
      body = "至少一个桥返回了可识别的车辆数据。现在可以导出 JSON，或在下方手动调用补充字段。";
      cls = "ok";
    } else if (state.bridges.length) {
      var okCalls = state.calls.filter(function (c) { return c.status === "ok" || c.status === "data" || c.status === "sent"; }).length;
      var errCalls = state.calls.filter(function (c) { return c.status === "error" || c.status === "timeout"; }).length;
      if (okCalls > 0) {
        title = "桥可以调用，但未识别到行车字段";
        body = "发现 " + state.bridges.length + " 个桥/对象候选，调用成功但没有匹配到 speed/rpm/gear/battery 等字段。查看原始结果，或用手动调用尝试其它方法。";
        cls = "warn";
      } else if (errCalls > 0) {
        title = "发现桥，但自动调用失败";
        body = "桥存在，但当前自动调用没有成功。可能是参数/回调要求、权限限制或方法名不同；请查看下方错误，并试用手动调用。";
        cls = "warn";
      } else {
        title = "发现 " + state.bridges.length + " 个桥/对象候选";
        body = "还没有取得行车数据。点击“开始只读探测”，或用下方手动调用检查具体方法。";
        cls = "warn";
      }
    } else {
      title = "未发现 JS Bridge";
      body = "没有找到常见的 NIO / native / Android / WKWebView handler 全局对象。可能车机没有注入桥，或桥名不在候选列表；请把原始报告带回分析。";
      cls = "bad";
    }

    els.verdict.className = "verdict " + cls;
    els.verdictTitle.textContent = title;
    els.verdictBody.textContent = body;
  }

  function sourceLabel(source) {
    return ({
      known: "KNOWN",
      webkit: "WKWEBVIEW",
      host: "HOST",
      "window-scan": "WINDOW",
      nested: "NESTED"
    })[source] || String(source || "SCAN").toUpperCase();
  }

  function renderBridges() {
    var list = state.bridges;
    els.bridgeBadge.textContent = String(list.length);
    els.bridgeBadge.className = "pill " + (list.length ? "ok" : "bad");
    if (!list.length) {
      els.bridgeList.innerHTML = "";
      els.bridgeEmpty.hidden = false;
      return;
    }
    els.bridgeEmpty.hidden = true;
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var safeCount = e.safeMethods.length;
      var methodChips = "";
      var shown = 0;
      for (var m = 0; m < e.methods.length && shown < 26; m++) {
        var name = e.methods[m].name;
        var safe = isSafeMethod(name);
        methodChips += '<span class="chip ' + (safe ? "safe" : "") + '" title="' + esc(name) + (e.methods[m].length ? " · length " + e.methods[m].length : "") + '">' + esc(name) + (e.methods[m].length ? "(" + e.methods[m].length + ")" : "") + '</span>';
        shown++;
      }
      if (e.methods.length > 26) methodChips += '<span class="chip">+' + (e.methods.length - 26) + '</span>';
      var propChips = "";
      for (var p = 0; p < e.props.length && p < 8; p++) {
        propChips += '<span class="chip" title="' + esc(e.props[p].name) + '">' + esc(e.props[p].name) + " = " + esc(e.props[p].preview) + '</span>';
      }
      var note = e.note ? '<div class="bridge-note">' + esc(e.note) + '</div>' : "";
      var tags = '<span class="tag">' + esc(sourceLabel(e.source)) + '</span>' +
        '<span class="tag ' + (safeCount ? "ok" : "") + '">' + safeCount + ' safe</span>' +
        (e.webkit ? '<span class="tag warn">postMessage</span>' : "") +
        (e.genericMethods.length ? '<span class="tag">generic</span>' : "");
      html += '<div class="bridge ' + (safeCount ? "native" : "") + '" data-bridge-index="' + i + '">' +
        '<div class="bridge-head"><span class="bridge-path">' + esc(e.path) + '</span><span class="bridge-meta">' + e.methods.length + ' methods</span></div>' +
        '<div class="chips">' + tags + '</div>' +
        (methodChips ? '<div class="chips">' + methodChips + '</div>' : "") +
        (propChips ? '<div class="chips">' + propChips + '</div>' : "") +
        note +
        '</div>';
    }
    els.bridgeList.innerHTML = html;
  }

  function renderCalls() {
    var calls = state.calls.slice(-40).reverse();
    if (!calls.length) {
      els.callList.innerHTML = "";
      els.callEmpty.hidden = false;
      return;
    }
    els.callEmpty.hidden = true;
    var html = "";
    for (var i = 0; i < calls.length; i++) {
      var c = calls[i];
      var statusClass = c.status === "ok" || c.status === "data" ? "ok" : (c.status === "sent" ? "warn" : (c.status === "running" ? "" : "bad"));
      var label = c.status === "data" ? "DATA" : c.status === "sent" ? "SENT" : c.status.toUpperCase();
      var result = c.resultText ? truncate(c.resultText, 1400) : "";
      html += '<div class="call">' +
        '<div class="call-main"><div class="call-method">' + esc(c.method) + '</div><div class="call-path">' + esc(c.bridge) + ' · ' + esc(c.mode) + '</div></div>' +
        '<div class="call-status ' + statusClass + '">' + esc(label) + ' · ' + c.ms + 'ms</div>' +
        (result ? '<pre class="call-result ' + (statusClass === "bad" ? "bad" : "ok") + '">' + esc(result) + '</pre>' : "") +
        '</div>';
    }
    els.callList.innerHTML = html;
  }

  function renderFields() {
    if (!state.fields.length) {
      els.fieldList.innerHTML = "";
      els.fieldEmpty.hidden = false;
      return;
    }
    els.fieldEmpty.hidden = true;
    var html = "";
    var seen = {};
    for (var i = 0; i < state.fields.length; i++) {
      var f = state.fields[i];
      var key = f.path + "|" + f.value;
      if (seen[key]) continue;
      seen[key] = true;
      html += '<div class="field"><span>' + esc(f.path) + '</span><strong>' + esc(f.value) + '</strong></div>';
    }
    els.fieldList.innerHTML = html;
  }

  function renderMessages() {
    els.messageBadge.textContent = String(state.messages.length);
    els.messageBadge.className = "pill " + (state.messages.length ? "blue" : "neutral");
    if (!state.messages.length) {
      els.messageList.innerHTML = "";
      els.messageEmpty.hidden = false;
      return;
    }
    els.messageEmpty.hidden = true;
    var html = "";
    for (var i = state.messages.length - 1; i >= 0; i--) {
      var m = state.messages[i];
      html += '<div class="message"><div class="message-meta">' + esc(m.at) + ' · ' + esc(m.source) + '</div><pre class="message-body">' + esc(m.body) + '</pre></div>';
    }
    els.messageList.innerHTML = html;
  }

  function renderManual() {
    if (!els.manualBridge) return;
    var current = els.manualBridge.value;
    var html = "";
    if (!state.bridges.length) {
      html = '<option value="">— 没有发现桥 —</option>';
    } else {
      for (var i = 0; i < state.bridges.length; i++) {
        var e = state.bridges[i];
        html += '<option value="' + i + '">' + esc(e.path) + ' (' + e.methods.length + ' methods)</option>';
      }
    }
    els.manualBridge.innerHTML = html;
    var idx = current !== "" && state.bridges[Number(current)] ? Number(current) : 0;
    if (state.bridges[idx]) els.manualBridge.value = String(idx);
    updateManualDatalist();
  }

  function updateManualDatalist() {
    if (!els.manualMethodList) return;
    var idx = Number(els.manualBridge.value || 0);
    var e = state.bridges[idx];
    var names = [];
    if (e) {
      for (var i = 0; i < e.methods.length; i++) names.push(e.methods[i].name);
    }
    for (var k = 0; k < KNOWN_READ_METHODS.length; k++) {
      if (names.indexOf(KNOWN_READ_METHODS[k]) === -1) names.push(KNOWN_READ_METHODS[k]);
    }
    els.manualMethodList.innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join("");
  }

  function log(message, type) {
    var entry = { at: new Date().toLocaleTimeString(), message: String(message), type: type || "" };
    state.logs.push(entry);
    if (state.logs.length > 80) state.logs.shift();
    renderLog();
  }

  function renderLog() {
    if (!els.logList) return;
    els.logList.innerHTML = state.logs.map(function (l) {
      return '<li class="' + esc(l.type) + '"><span>' + esc(l.at) + '</span> ' + esc(l.message) + '</li>';
    }).join("");
    els.logList.scrollTop = els.logList.scrollHeight;
  }

  function setStatus(text, type) {
    if (!els.statusLine) return;
    els.statusLine.textContent = text;
    els.statusLine.className = "status-line " + (type || "");
  }

  /* ---------- report / export ---------- */

  function publicBridge(entry) {
    return {
      path: entry.path,
      source: entry.source,
      type: typeof entry.obj,
      webkit: entry.webkit,
      hostPost: entry.hostPost,
      methods: entry.methods,
      safeMethods: entry.safeMethods,
      genericMethods: entry.genericMethods.map(function (m) { return m.name; }),
      properties: entry.props,
      note: entry.note
    };
  }

  function buildReport() {
    return {
      probe: "P2.2 JS Bridge vehicle data",
      version: VERSION,
      builtAt: BUILD.time || "",
      generatedAt: nowIso(),
      environment: state.env,
      bridges: state.bridges.map(publicBridge),
      calls: state.calls,
      fields: state.fields,
      hostMessages: state.messages,
      logs: state.logs,
      summary: {
        bridgeCount: state.bridges.length,
        callCount: state.calls.length,
        okCalls: state.calls.filter(function (c) { return c.status === "ok" || c.status === "data" || c.status === "sent"; }).length,
        dataFields: state.fields.length,
        scanned: state.scanned
      }
    };
  }

  function publishReport() {
    state.report = buildReport();
    var text = "";
    try { text = JSON.stringify(state.report, null, 2); } catch (e) { text = '{"error":"report serialization failed"}'; }
    if (els.rawReport) els.rawReport.textContent = text;
    var ready = state.scanned;
    if (els.exportBtn) els.exportBtn.disabled = !ready;
    if (els.copyBtn) els.copyBtn.disabled = !ready;
    if (els.downloadBtn) els.downloadBtn.disabled = !ready;
  }

  function copyReport() {
    if (!state.report) return;
    var text = JSON.stringify(state.report, null, 2);
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      setStatus(ok ? "报告已复制" : "复制失败；请使用下载", ok ? "ok" : "bad");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setStatus("报告已复制", "ok");
        log("报告已复制", "ok");
      }, fallback);
    } else {
      fallback();
    }
  }

  function downloadReport() {
    if (!state.report) return;
    var text = JSON.stringify(state.report, null, 2);
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = "nioengine-bridge-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus("已生成报告下载", "ok");
    log("下载报告", "ok");
  }

  /* ---------- host messages ---------- */

  function addMessage(source, data) {
    var body = "";
    try { body = typeof data === "string" ? data : JSON.stringify(serialize(data, 0, []), null, 2); } catch (e) { body = String(data); }
    state.messages.push({ at: new Date().toLocaleTimeString(), source: source, body: truncate(body, 3000) });
    if (state.messages.length > 20) state.messages.shift();
    renderMessages();
    publishReport();
  }

  function installMessageListeners() {
    window.addEventListener("message", function (event) {
      if (event.data === undefined) return;
      addMessage("window.message", event.data);
      log("收到 window.message", "warn");
    });
    try {
      if (window.chrome && window.chrome.webview && window.chrome.webview.addEventListener) {
        window.chrome.webview.addEventListener("message", function (event) {
          addMessage("chrome.webview", event.data);
          log("收到 chrome.webview message", "warn");
        });
      }
    } catch (e) { /* ignore */ }

    ["NioBridgeReady", "NIOBridgeReady", "NativeBridgeReady", "JSBridgeReady", "bridgeReady"].forEach(function (name) {
      window.addEventListener(name, function () {
        log("收到事件 " + name + "，重新扫描桥", "warn");
        scanBridges();
      });
    });
  }

  /* ---------- manual ---------- */

  async function executeManual() {
    if (!state.bridges.length) {
      els.manualResult.textContent = "没有发现桥。";
      return;
    }
    var idx = Number(els.manualBridge.value || 0);
    var entry = state.bridges[idx];
    if (!entry) {
      els.manualResult.textContent = "桥不存在。";
      return;
    }
    var method = (els.manualMethod.value || "").trim();
    if (!method) {
      els.manualResult.textContent = "请填写方法名。";
      return;
    }
    var args = [];
    try {
      args = JSON.parse(els.manualArgs.value || "[]");
      if (!Array.isArray(args)) args = [args];
    } catch (e) {
      els.manualResult.textContent = "参数 JSON 解析失败：" + e.message;
      return;
    }
    var mode = els.manualMode.value;
    els.manualCall.disabled = true;
    els.manualResult.textContent = "调用中…";
    setStatus("手动调用 " + entry.path + " · " + mode + " · " + method, "warn");
    log("手动调用 " + entry.path + " · " + mode + " · " + method, "warn");
    try {
      var record = await callOne(entry, mode, method, args, {
        callback: !!(els.manualCallback && els.manualCallback.checked),
        timeout: 2200,
        manual: true
      });
      els.manualResult.textContent =
        "状态：" + record.status + " · " + record.ms + "ms\n\n" +
        (record.resultText || record.error || "(no return)");
      setStatus("手动调用完成：" + record.status, record.status === "ok" || record.status === "data" ? "ok" : "warn");
      publishReport();
    } catch (e) {
      els.manualResult.textContent = "调用异常：" + String(e && e.message || e);
      setStatus("手动调用失败", "bad");
    } finally {
      els.manualCall.disabled = false;
    }
  }

  /* ---------- boot ---------- */

  function cacheElements() {
    [
      "secureBadge", "envBadge", "envRows", "bridgeBadge", "bridgeList", "bridgeEmpty",
      "probeBadge", "callList", "callEmpty", "fieldList", "fieldEmpty",
      "messageBadge", "messageList", "messageEmpty", "rawReport",
      "exportBtn", "copyBtn", "downloadBtn", "probeBtn", "rescanBtn", "genericToggle",
      "verdict", "verdictTitle", "verdictBody", "statusLine",
      "manualCard", "manualBridge", "manualMode", "manualMethod", "manualMethodList",
      "manualArgs", "manualCallback", "manualCall", "manualResult",
      "logList", "clearLogBtn", "buildLine"
    ].forEach(function (id) { els[id] = $(id); });
  }

  function boot() {
    cacheElements();
    state.env = collectEnv();
    renderEnv();
    installMessageListeners();

    if (els.buildLine) els.buildLine.textContent = "v" + VERSION + " · " + (BUILD.time || "");

    els.probeBtn.addEventListener("click", function () { runProbe(); });
    els.rescanBtn.addEventListener("click", function () {
      if (state.probing) return;
      state.interacted = true;
      setStatus("重新扫描桥…", "warn");
      scanBridges();
      setStatus("扫描完成：发现 " + state.bridges.length + " 个候选", state.bridges.length ? "ok" : "warn");
    });
    els.exportBtn.addEventListener("click", downloadReport);
    els.copyBtn.addEventListener("click", copyReport);
    els.downloadBtn.addEventListener("click", downloadReport);
    els.manualCall.addEventListener("click", executeManual);
    els.manualBridge.addEventListener("change", updateManualDatalist);
    els.clearLogBtn.addEventListener("click", function () {
      state.logs = [];
      renderLog();
    });
    els.bridgeList.addEventListener("click", function (event) {
      var node = event.target;
      while (node && node !== els.bridgeList && !node.getAttribute("data-bridge-index")) node = node.parentNode;
      if (!node || node === els.bridgeList) return;
      var idx = Number(node.getAttribute("data-bridge-index"));
      if (state.bridges[idx]) {
        els.manualBridge.value = String(idx);
        updateManualDatalist();
        if (els.manualCard) els.manualCard.open = true;
        els.manualCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    renderLog();
    renderMessages();
    renderCalls();
    renderFields();
    scanBridges();
    updateVerdict();
    publishReport();
    setStatus("环境就绪。点“开始只读探测”尝试读取。", "ok");

    setTimeout(function () {
      if (!state.bridges.length && !state.interacted && !state.probing) {
        scanBridges();
        setStatus("延迟扫描完成：发现 " + state.bridges.length + " 个候选", state.bridges.length ? "ok" : "warn");
      }
    }, 1600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
