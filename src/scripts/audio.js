export function createAudioFx() {
  const state = {
    context: null,
    master: null,
    lastImpactAt: -99,
  };

  function ensureContext() {
    if (state.context) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    state.context = new AC();
    state.master = state.context.createGain();
    state.master.gain.value = 0.55;
    state.master.connect(state.context.destination);
  }

  async function resume() {
    if (state.context && state.context.state === "suspended") {
      await state.context.resume();
    }
  }

  function blip({ freq = 240, duration = 0.08, type = "square", gain = 0.58 } = {}) {
    if (!state.context || !state.master) return;
    const now = state.context.currentTime;
    const osc = state.context.createOscillator();
    const amp = state.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(70, freq * 0.55), now + duration);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(state.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function noise({ duration = 0.09, gain = 0.57 } = {}) {
    if (!state.context || !state.master) return;
    const now = state.context.currentTime;
    const frames = Math.max(1, Math.floor(duration * state.context.sampleRate));
    const buffer = state.context.createBuffer(1, frames, state.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const source = state.context.createBufferSource();
    source.buffer = buffer;

    const filter = state.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;

    const amp = state.context.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(amp);
    amp.connect(state.master);

    source.start(now);
    source.stop(now + duration + 0.01);
  }

  function filteredNoise({
    type = "highpass",
    freq = 3200,
    q = 0.7,
    gain = 0.08,
    attack = 0.003,
    hold = 0.03,
    release = 0.04,
  } = {}) {
    if (!state.context || !state.master) return;
    const now = state.context.currentTime;
    const duration = Math.max(0.01, attack + hold + release);
    const frames = Math.max(1, Math.floor(duration * state.context.sampleRate));
    const buffer = state.context.createBuffer(1, frames, state.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frames; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = state.context.createBufferSource();
    source.buffer = buffer;

    const filter = state.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const amp = state.context.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + attack);
    amp.gain.setValueAtTime(gain, now + attack + hold);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);

    source.connect(filter);
    filter.connect(amp);
    amp.connect(state.master);

    source.start(now);
    source.stop(now + duration + 0.01);
  }

  function biteSmall() {
    // Closed 808-ish hat: very short, tight high noise burst.
    filteredNoise({
      type: "highpass",
      freq: 8500,
      q: 1.25,
      gain: 0.22,
      attack: 0.001,
      hold: 0.008,
      release: 0.022,
    });
  }

  function biteMedium() {
    // Open/brush hat: softer onset, longer sustained texture.
    filteredNoise({
      type: "bandpass",
      freq: 5200,
      q: 0.55,
      gain: 0.15,
      attack: 0.016,
      hold: 0.14,
      release: 0.16,
    });
  }

  function biteLarge() {
    if (!state.context || !state.master) return;
    const now = state.context.currentTime;

    // Tight 80s snare: bright noise plus a short pitched body and a spring-like tail.
    filteredNoise({
      type: "bandpass",
      freq: 1950,
      q: 0.85,
      gain: 0.35,
      attack: 0.001,
      hold: 0.02,
      release: 0.21,
    });

    const bodyOsc = state.context.createOscillator();
    const bodyAmp = state.context.createGain();
    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(220, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(124, now + 0.12);
    bodyAmp.gain.setValueAtTime(0.0001, now);
    bodyAmp.gain.exponentialRampToValueAtTime(0.09, now + 0.004);
    bodyAmp.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    const delay = state.context.createDelay();
    delay.delayTime.value = 0.028;
    const feedback = state.context.createGain();
    feedback.gain.value = 0.28;
    const damp = state.context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2900;

    bodyOsc.connect(bodyAmp);
    bodyAmp.connect(state.master);
    bodyAmp.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(state.master);

    bodyOsc.start(now);
    bodyOsc.stop(now + 0.19);
  }

  function impact(nowSeconds) {
    if (nowSeconds - state.lastImpactAt < 0.5) return;
    state.lastImpactAt = nowSeconds;
    noise({ duration: 0.24, gain: 0.3 });
    blip({ freq: 72, duration: 0.28, type: "sawtooth", gain: 0.18 });
  }

  function truckHorn() {
    if (!state.context || !state.master) return;
    const now = state.context.currentTime;
    const freqs = [154, 196];

    for (const freq of freqs) {
      const osc = state.context.createOscillator();
      const amp = state.context.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.97, now + 0.35);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(amp);
      amp.connect(state.master);
      osc.start(now);
      osc.stop(now + 0.39);
    }

    noise({ duration: 0.06, gain: 0.58 });
  }

  return {
    ensureContext,
    resume,
    blip,
    noise,
    biteSmall,
    biteMedium,
    biteLarge,
    impact,
    truckHorn,
  };
}
