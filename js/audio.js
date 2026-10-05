/* =========================================================
   Âm thanh tổng hợp bằng Web Audio API – không dùng file mp3.
   Trình duyệt chặn tự phát âm thanh, nên AudioContext chỉ được tạo
   khi người dùng bấm nút "Âm thanh" (một user gesture).
   ========================================================= */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let wind = null;
  let enabled = false;

  function init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // 2 giây nhiễu trắng dùng chung cho tiếng giấy, tiếng xé và tiếng gió
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    startWind();
    return true;
  }

  function noise() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function filter(type, frequency, Q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    if (Q !== undefined) f.Q.value = Q;
    return f;
  }

  function panner(pan) {
    if (!ctx.createStereoPanner) return ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    return p;
  }

  function canPlay() {
    return enabled && ctx && ctx.state === 'running';
  }

  /* Gió nền: nhiễu qua lowpass, cường độ lên xuống chậm */
  function startWind() {
    const src = noise();
    const lp = filter('lowpass', 420, 0.6);
    const gain = ctx.createGain();
    gain.gain.value = 0.025;

    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoDepth.gain.value = 160;
    lfo.connect(lfoDepth).connect(lp.frequency);

    src.connect(lp).connect(gain).connect(master);
    src.start();
    lfo.start();
    wind = { gain, lp };
  }

  /* Cơn gió mạnh: tiếng gió dâng lên rồi lắng xuống */
  function gust(strength) {
    if (!canPlay()) return;
    const t = ctx.currentTime;
    const s = strength || 0.7;
    wind.gain.gain.cancelScheduledValues(t);
    wind.gain.gain.setValueAtTime(wind.gain.gain.value, t);
    wind.gain.gain.linearRampToValueAtTime(0.025 + 0.09 * s, t + 0.35);
    wind.gain.gain.linearRampToValueAtTime(0.025, t + 2.2);
    wind.lp.frequency.cancelScheduledValues(t);
    wind.lp.frequency.setValueAtTime(420, t);
    wind.lp.frequency.linearRampToValueAtTime(420 + 700 * s, t + 0.35);
    wind.lp.frequency.linearRampToValueAtTime(420, t + 2.2);
  }

  /* Giấy đập phần phật: vài nhịp nhiễu ngắn, tắt dần.
     Một nhánh bandpass cho tiếng "xoạt" giòn, một nhánh lowpass cho tiếng "bộp" trầm. */
  function flap(strength, pan) {
    if (!canPlay()) return;
    const s = strength || 0.7;
    const t = ctx.currentTime + 0.01;
    const src = noise();
    const crisp = filter('bandpass', 1500 + Math.random() * 900, 0.9);
    const body = filter('lowpass', 320, 0.7);
    const crispGain = ctx.createGain();
    const bodyGain = ctx.createGain();
    crispGain.gain.value = 0.9;
    bodyGain.gain.value = 1.4;
    const env = ctx.createGain();
    env.gain.value = 0;

    const beats = 3 + Math.round(s * 3);
    let at = t;
    for (let i = 0; i < beats; i++) {
      const peak = 0.55 * s * (1 - i / (beats + 1));
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(peak, at + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05 + Math.random() * 0.03);
      at += 0.07 + Math.random() * 0.06;
    }

    src.connect(crisp).connect(crispGain).connect(env);
    src.connect(body).connect(bodyGain).connect(env);
    env.connect(panner(pan)).connect(master);
    src.start(t, Math.random());
    src.stop(at + 0.1);
  }

  /* Gỗ cót két: sóng răng cưa tần số rất thấp (từng cú "trượt-dính" của thớ gỗ)
     đi qua hai bộ lọc cộng hưởng hẹp, giống thân gỗ rung lên. */
  function creak(strength) {
    if (!canPlay()) return;
    const s = strength || 0.6;
    const t = ctx.currentTime + 0.01;
    const dur = 0.7 + Math.random() * 0.6;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(16 + Math.random() * 10, t);
    osc.frequency.linearRampToValueAtTime(42 + Math.random() * 30, t + dur * 0.6);
    osc.frequency.linearRampToValueAtTime(22, t + dur);

    const resA = filter('bandpass', 480 + Math.random() * 120, 14);
    const resB = filter('bandpass', 1150 + Math.random() * 200, 10);
    const mixB = ctx.createGain();
    mixB.gain.value = 0.6;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.9 * s, t + 0.08);
    env.gain.setValueAtTime(0.9 * s, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(resA).connect(env);
    osc.connect(resB).connect(mixB).connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /* Tiếng xé giấy: nhiễu qua bandpass quét từ trầm lên cao, biên độ lởm chởm */
  function rip(pan) {
    if (!canPlay()) return;
    const t = ctx.currentTime + 0.01;
    const dur = 0.5;
    const src = noise();
    const bp = filter('bandpass', 900, 1.3);
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + dur);
    const env = ctx.createGain();
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      const fade = 1 - i / steps;
      env.gain.setValueAtTime(0.08 + Math.random() * 0.7 * fade, t + (i * dur) / steps);
    }
    env.gain.setValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(env).connect(panner(pan)).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /* Đóng đinh dán lại: tiếng "cộp" trầm + tiếng tách nhỏ */
  function thud() {
    if (!canPlay()) return;
    const t = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.7, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + 0.3);

    const click = noise();
    const hp = filter('highpass', 2500);
    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(0.25, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(hp).connect(clickEnv).connect(master);
    click.start(t);
    click.stop(t + 0.05);
  }

  function toggle() {
    if (!ctx && !init()) return false;
    enabled = !enabled;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    if (enabled) {
      ctx.resume();
      master.gain.linearRampToValueAtTime(0.8, t + 0.3);
    } else {
      master.gain.linearRampToValueAtTime(0, t + 0.2);
    }
    return enabled;
  }

  window.SFX = {
    toggle,
    isOn: () => enabled,
    gust,
    flap,
    creak,
    rip,
    thud
  };
})();
