/* Engine Sound Lab — P1 engine worklet.
   Crank-angle firing events, two exhaust banks, resonator exhaust,
   intake noise, turbo, overrun crackle, starter/stop sequences.
   This runs on the audio thread; keep allocations out of process(). */

class EngineP1Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sr = sampleRate;
    this.mode = "off"; // off | starting | running | stopping

    this.config = null;
    this.offsets = [];
    this.banks = [];
    this.res = [[], []];
    this.cylinders = 8;
    this.idle = 650;
    this.redline = 7000;
    this.limiter = 7300;
    this.maxRpm = 8000;

    this.rpm = 0;
    this.targetRpm = 0;
    this.throttle = 0;
    this.targetThrottle = 0;
    this.load = 0;
    this.targetLoad = 0;
    this.boost = 0;
    this.targetBoost = 0;
    this.valve = 0;
    this.targetValve = 0;
    this.gear = 0;

    this.cycle = -0.01; // 0..720 crank degrees
    this.subPhase = 0;
    this.turboPhase = 0;
    this.starterPhase = 0;
    this.popPhase = 0;

    this.bankImpulse = [0, 0];
    this.clickEnv = [0, 0];
    this.bankLp = [0, 0];
    this.cutTimer = 0;
    this.crackleScale = 1;
    this.prevCut = false;
    this.fuelCut = false;
    this.limiterPhase = 0;

    this.starterTime = 0;
    this.stopTime = 0;
    this.catchEnv = 0;
    this.popEnv = 0;
    this.popTimer = 0;
    this.blowEnv = 0;

    this.intakeX1 = 0;
    this.intakeX2 = 0;
    this.intakeY1 = 0;
    this.intakeY2 = 0;
    this.intakeB0 = 1;
    this.intakeB1 = 0;
    this.intakeB2 = 0;
    this.intakeA1 = 0;
    this.intakeA2 = 0;
    this.intakeLp = 0;
    this.mechLp = 0;

    this.lpCoef = 0.2;
    this.hpCoef = 0.001;
    this.dcIn = 0;
    this.dcOut = 0;

    this.noiseState = 0x9e3779b9;
    this.gain = 0;
    this.targetGain = 0;
    this.frames = 0;
    this.meterFrames = 0;
    this.rms = 0;
    this.peak = 0;

    this.port.onmessage = (event) => this.onMessage(event.data);
    this.port.postMessage({ type: "ready", processor: "engine-p1", sampleRate: this.sr });
  }

  onMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "start":
        this.applyConfig(msg.config || this.config || defaultConfig());
        this.mode = "starting";
        this.starterTime = 0;
        this.stopTime = 0;
        this.rpm = 0;
        this.targetRpm = 0;
        this.throttle = 0;
        this.targetThrottle = 0;
        this.load = 0;
        this.targetLoad = 0;
        this.boost = 0;
        this.targetBoost = 0;
        this.cycle = -0.01;
        this.gain = 0;
        this.targetGain = 0.9;
        this.popEnv = 0;
        this.popTimer = 0;
        this.blowEnv = 0;
        this.catchEnv = 0;
        this.starterPhase = 0;
        this.subPhase = 0;
        this.turboPhase = 0;
        this.limiterPhase = 0;
        this.cutTimer = 0;
        this.crackleScale = 1;
        this.prevCut = false;
        this.fuelCut = false;
        this.resetFilters();
        this.port.postMessage({ type: "state", state: "starting" });
        break;

      case "stop":
        if (this.mode === "off") break;
        this.mode = "stopping";
        this.stopTime = 0;
        this.targetRpm = 0;
        this.targetGain = 0;
        this.port.postMessage({ type: "state", state: "stopping" });
        break;

      case "control": {
        var cut = !!msg.cut;
        if (this.mode === "running") {
          if (typeof msg.rpm === "number") this.targetRpm = clamp(msg.rpm, 0, this.maxRpm);
          if (typeof msg.throttle === "number") {
            var oldThrottle = this.targetThrottle;
            this.targetThrottle = clamp(msg.throttle, 0, 1);
            if (oldThrottle - this.targetThrottle > 0.35 && this.boost > 0.2) {
              this.blowEnv = Math.max(this.blowEnv, 0.5);
            }
          }
          if (typeof msg.load === "number") this.targetLoad = clamp(msg.load, 0, 1);
          if (typeof msg.boost === "number") this.targetBoost = clamp(msg.boost, 0, 1);
          if (typeof msg.valve === "number") this.targetValve = clamp(msg.valve, 0, 1);
          if (typeof msg.gear === "number") this.gear = msg.gear;
          if (typeof msg.crackleScale === "number") this.crackleScale = clamp(msg.crackleScale, 0, 1);

          if (cut && !this.prevCut) {
            this.cutTimer = Math.max(this.cutTimer, 0.12);
            this.popEnv = Math.max(this.popEnv, 0.30 * this.crackleScale);
          }
        }
        this.prevCut = cut;
        break;
      }

      case "ping":
        this.port.postMessage({
          type: "pong",
          currentFrame,
          currentTime,
          frames: this.frames,
          mode: this.mode
        });
        break;

      default:
        break;
    }
  }

  applyConfig(cfg) {
    this.config = cfg;
    this.cylinders = Math.max(1, Math.round(cfg.cylinders || 8));
    this.idle = cfg.idle || 700;
    this.redline = cfg.redline || 7000;
    this.limiter = cfg.limiter || this.redline + 250;
    this.maxRpm = cfg.maxRpm || 8000;

    this.offsets = [];
    this.banks = [];
    for (var i = 0; i < this.cylinders; i++) {
      this.offsets.push(Number(cfg.offsets && cfg.offsets[i]) || (i * (720 / this.cylinders)));
      this.banks.push(Number(cfg.banks && cfg.banks[i]) ? 1 : 0);
    }

    this.res = [[], []];
    var decay = cfg.decay || 0.065;
    var r = Math.exp(-1 / (decay * this.sr));
    for (var b = 0; b < 2; b++) {
      var freqs = (cfg.res && cfg.res[b]) || [90, 200, 400];
      for (var k = 0; k < freqs.length; k++) {
        var f = clamp(freqs[k], 25, this.sr * 0.45);
        var w = (2 * Math.PI * f) / this.sr;
        this.res[b].push({
          a1: 2 * r * Math.cos(w),
          a2: -r * r,
          y1: 0,
          y2: 0,
          mix: 1 / freqs.length
        });
      }
    }

    this.resetFilters();
  }

  resetFilters() {
    for (var b = 0; b < 2; b++) {
      this.bankLp[b] = 0;
      this.clickEnv[b] = 0;
      this.bankImpulse[b] = 0;
      for (var i = 0; i < this.res[b].length; i++) {
        this.res[b][i].y1 = 0;
        this.res[b][i].y2 = 0;
      }
    }
    this.intakeX1 = 0;
    this.intakeX2 = 0;
    this.intakeY1 = 0;
    this.intakeY2 = 0;
    this.intakeLp = 0;
    this.mechLp = 0;
    this.dcIn = 0;
    this.dcOut = 0;
    this.limiterPhase = 0;
    this.fuelCut = false;
  }

  setIntakeFilter(freq, q) {
    var f = clamp(freq, 80, this.sr * 0.45);
    var w = (2 * Math.PI * f) / this.sr;
    var alpha = Math.sin(w) / (2 * Math.max(0.3, q));
    var a0 = 1 + alpha;
    this.intakeB0 = alpha / a0;
    this.intakeB1 = 0;
    this.intakeB2 = -alpha / a0;
    this.intakeA1 = (-2 * Math.cos(w)) / a0;
    this.intakeA2 = (1 - alpha) / a0;
  }

  process(inputs, outputs) {
    var out = outputs[0];
    if (!out || out.length === 0) return true;
    var left = out[0];
    var right = out.length > 1 ? out[1] : null;
    var n = left.length;
    var sr = this.sr;

    var kRpm = 1 - Math.exp(-1 / (0.045 * sr));
    var kThrottle = 1 - Math.exp(-1 / (0.035 * sr));
    var kLoad = 1 - Math.exp(-1 / (0.05 * sr));
    var kBoost = 1 - Math.exp(-1 / (0.22 * sr));
    var kValve = 1 - Math.exp(-1 / (0.12 * sr));
    var kGain = 1 - Math.exp(-1 / (0.045 * sr));
    var clickDecay = Math.exp(-1 / (0.004 * sr));
    var popDecay = Math.exp(-1 / (0.055 * sr));
    var blowDecay = Math.exp(-1 / (0.12 * sr));

    // Filter coefficients can change once per block; that is plenty for
    // engine timbre and avoids per-sample trig.
    var intakeFreq = 260 + this.rpm * 0.35 + this.load * 500;
    this.setIntakeFilter(intakeFreq, 0.85);
    var cutoff = 380 + this.rpm * 0.75 + this.load * 900 + this.valve * 700;
    this.lpCoef = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);

    try {
      for (var i = 0; i < n; i++) {
        var dt = 1 / sr;

        this.rpm += (this.targetRpm - this.rpm) * kRpm;
        this.throttle += (this.targetThrottle - this.throttle) * kThrottle;
        this.load += (this.targetLoad - this.load) * kLoad;
        this.boost += (this.targetBoost - this.boost) * kBoost;
        this.valve += (this.targetValve - this.valve) * kValve;
        this.gain += (this.targetGain - this.gain) * kGain;

        var white = this.noise();

        if (this.mode === "starting") {
          this.starterTime += dt;
          var crank = 170 + 35 * Math.sin(2 * Math.PI * 9 * this.starterTime) + (white * 18);
          this.targetRpm = Math.max(0, crank);
          if (Math.floor(this.starterTime * 9) !== Math.floor((this.starterTime - dt) * 9)) {
            this.bankImpulse[0] += 0.035;
            this.bankImpulse[1] += 0.025;
          }
          if (this.starterTime >= 0.72) {
            this.mode = "running";
            this.rpm = this.idle * 0.75;
            this.targetRpm = this.idle;
            this.catchEnv = 1;
            this.cycle = -0.01;
            this.port.postMessage({ type: "state", state: "running" });
          }
        } else if (this.mode === "stopping") {
          this.stopTime += dt;
          this.targetRpm = 0;
          if (this.stopTime >= 0.75) {
            this.mode = "off";
            this.targetGain = 0;
            this.gain = 0;
            this.port.postMessage({ type: "state", state: "off" });
          }
        } else if (this.mode === "running") {
          this.advanceCycle(dt);
        }

        var exL = this.processBank(0, white);
        var exR = this.processBank(1, white);

        // Intake noise: band-passed white noise, plus a low roar.
        this.intakeLp += (white - this.intakeLp) * 0.02;
        var intakeBand =
          this.intakeB0 * white +
          this.intakeB1 * this.intakeX1 +
          this.intakeB2 * this.intakeX2 -
          this.intakeA1 * this.intakeY1 -
          this.intakeA2 * this.intakeY2;
        this.intakeX2 = this.intakeX1;
        this.intakeX1 = white;
        this.intakeY2 = this.intakeY1;
        this.intakeY1 = intakeBand;
        var intakeGain =
          (this.config ? this.config.intakeGain : 0.7) *
          (0.035 + this.load * 0.14 + Math.min(this.rpm / this.redline, 1) * 0.06);
        var intake = intakeBand * intakeGain + this.intakeLp * this.load * 0.22;

        // Optional turbo whistle / blow-off.
        var turbo = 0;
        if (this.config && this.config.turbo) {
          var tf = 1900 + this.boost * 3800 + this.rpm * 0.1;
          this.turboPhase += (2 * Math.PI * tf) / sr;
          if (this.turboPhase > 2 * Math.PI) this.turboPhase -= 2 * Math.PI;
          turbo = Math.sin(this.turboPhase) * this.boost * 0.028;
          this.blowEnv *= blowDecay;
          turbo += white * this.blowEnv * 0.12;
        }

        // Low sub layer at a preset ratio of the firing frequency.
        var firing = Math.max(5, (this.rpm / 60) * (this.cylinders / 2));
        var subRatio = this.config ? this.config.subRatio : 0.5;
        var subGain = this.config ? this.config.subGain : 0.08;
        var subFreq = Math.max(12, firing * subRatio);
        this.subPhase += (2 * Math.PI * subFreq) / sr;
        if (this.subPhase > 2 * Math.PI) this.subPhase -= 2 * Math.PI;
        var sub = Math.sin(this.subPhase) * subGain * (0.35 + 0.65 * this.load);

        // Starter / catch / run-down.
        var starter = 0;
        if (this.mode === "starting") {
          this.starterPhase += (2 * Math.PI * 150) / sr;
          starter =
            (Math.sin(this.starterPhase) * 0.045 +
              Math.sin(this.starterPhase * 0.55) * 0.03 +
              white * 0.018) *
            Math.min(1, this.starterTime / 0.12);
        }
        this.catchEnv *= 0.9985;
        starter += this.catchEnv * Math.sin(this.starterPhase * 3) * 0.05;

        var runDown = 0;
        if (this.mode === "stopping") {
          var rd = Math.max(0, 1 - this.stopTime / 0.55);
          runDown =
            (Math.sin(2 * Math.PI * 90 * this.stopTime) * 0.03 +
              white * 0.012) *
            rd;
        }

        // Overrun crackle / shift pop.
        this.popEnv *= popDecay;
        this.popPhase += (2 * Math.PI * 70) / sr;
        var pop = white * this.popEnv * 0.30 + Math.sin(this.popPhase) * this.popEnv * 0.14;

        var macro = 1.05 + this.load * 0.55 + this.valve * 0.18;
        var center = intake * 0.55 + turbo + sub * 0.55 + starter + runDown + pop * 0.45;
        var mixL = (exL * 0.86 + exR * 0.14) * macro + center;
        var mixR = (exR * 0.86 + exL * 0.14) * macro + center;

        var yL = Math.tanh(mixL) * this.gain;
        var yR = Math.tanh(mixR) * this.gain;

        // DC blocker.
        var outL = yL - this.dcIn + 0.995 * this.dcOut;
        this.dcIn = yL;
        this.dcOut = outL;

        left[i] = outL;
        if (right) right[i] = yR;

        var abs = outL < 0 ? -outL : outL;
        if (abs > this.peak) this.peak = abs;
        this.rms += outL * outL;
      }
    } catch (err) {
      this.port.postMessage({ type: "error", error: String((err && err.message) || err) });
      return true;
    }

    this.frames += n;
    this.meterFrames += n;
    if (this.meterFrames >= sr * 0.05) {
      this.port.postMessage({
        type: "meter",
        rms: Math.sqrt(this.rms / this.meterFrames),
        peak: this.peak,
        rpm: this.rpm,
        load: this.load,
        throttle: this.throttle,
        boost: this.boost,
        gear: this.gear,
        mode: this.mode,
        valve: this.valve,
        cut: this.cutTimer > 0 || this.fuelCut,
        fuelCut: this.fuelCut,
        currentTime,
        currentFrame,
        frames: this.frames
      });
      this.meterFrames = 0;
      this.rms = 0;
      this.peak = 0;
    }

    return true;
  }

  advanceCycle(dt) {
    if (!this.config) return;

    if (this.rpm > this.limiter) {
      this.limiterPhase += dt * 16;
      if (this.limiterPhase >= 1) {
        this.limiterPhase -= 1;
        this.fuelCut = !this.fuelCut;
        if (this.fuelCut) this.popEnv = Math.max(this.popEnv, 0.25);
      }
    } else {
      this.fuelCut = false;
      this.limiterPhase = 0;
    }

    if (this.cutTimer > 0) {
      this.cutTimer -= dt;
      if (this.cutTimer < 0) this.cutTimer = 0;
    }

    var degPerSample = (this.rpm * 6) / this.sr;
    var a0 = this.cycle;
    this.cycle += degPerSample;
    if (this.cycle >= 720) this.cycle -= 720;

    for (var i = 0; i < this.cylinders; i++) {
      var off = this.offsets[i];
      var crossed =
        (a0 <= off && this.cycle > off) ||
        (a0 > this.cycle && (off > a0 || off <= this.cycle));
      if (crossed) this.fire(i);
    }

    var overrunFloor = Math.max(2200, this.idle * 1.35);
    var overrun = this.throttle < 0.08 && this.rpm > overrunFloor && this.load < 0.12;
    if (overrun && this.crackleScale > 0.03 && this.mode === "running") {
      this.popTimer -= dt;
      if (this.popTimer <= 0) {
        var crackle = (this.config.crackle || 0.3) * this.crackleScale;
        this.popTimer = 0.08 + Math.random() * (0.30 / Math.max(0.15, crackle));
        this.popEnv = Math.max(this.popEnv, (0.10 + Math.random() * 0.22) * crackle);
        this.popPhase = Math.random() * Math.PI * 2;
        var b = Math.random() < 0.5 ? 0 : 1;
        this.bankImpulse[b] += (0.025 + Math.random() * 0.04) * (0.4 + 0.6 * this.crackleScale);
      }
    } else {
      this.popTimer = 0;
    }
  }

  fire(index) {
    if (this.mode !== "running") return;
    if (this.fuelCut || this.cutTimer > 0) return;

    var cfg = this.config;
    var idleFactor = this.rpm < 1300 ? 0.9 + Math.random() * 0.2 : 0.96 + Math.random() * 0.08;
    var amp =
      (cfg.pulseGain || 0.06) *
      (0.38 + 0.62 * this.load) *
      idleFactor;
    var b = this.banks[index];
    this.bankImpulse[b] += amp;
    this.clickEnv[b] = Math.max(this.clickEnv[b], amp * (cfg.click || 0.12));
  }

  processBank(bank, white) {
    var input = this.bankImpulse[bank];
    this.bankImpulse[bank] = 0;
    var sum = 0;
    var list = this.res[bank];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var y = r.a1 * r.y1 + r.a2 * r.y2 + input;
      r.y2 = r.y1;
      r.y1 = y;
      sum += y * r.mix;
    }

    sum += this.clickEnv[bank] * white * 0.55;
    this.clickEnv[bank] *= 0.998;

    var coeff = this.lpCoef;
    this.bankLp[bank] += (sum - this.bankLp[bank]) * coeff;
    return this.bankLp[bank];
  }

  noise() {
    this.noiseState = (Math.imul(this.noiseState, 1664525) + 1013904223) >>> 0;
    return (this.noiseState / 4294967296) * 2 - 1;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function defaultConfig() {
  return {
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
    crackle: 0.3,
    turbo: false
  };
}

registerProcessor("engine-p1", EngineP1Processor);
