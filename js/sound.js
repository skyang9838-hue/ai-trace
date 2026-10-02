/* AI TRACE — Sound manager
 * 효과음 + 아주 낮은 ambience + 정적(ducking).
 * 모든 소리는 assets/sfx/ 의 파일만 쓴다 (Web Audio로 삑 소리를 합성하지 않는다).
 * 파일 목록·출처: assets/sfx/SOUNDS.md
 */
(function () {
  const SFX_PATH = 'assets/sfx/';

  // trigger → { file, gain }  (gain: 0~1, 전체 볼륨에 곱해짐)
  const SOUNDS = {
    case_open:             { file: 'case_open.mp3',             gain: 0.55 },
    ui_hover:              { file: 'ui_hover.mp3',              gain: 0.10 },
    ui_click:              { file: 'ui_click.mp3',              gain: 0.35 },
    evidence_found:        { file: 'evidence_found.mp3',        gain: 0.30 },
    evidence_register:     { file: 'evidence_register.mp3',     gain: 0.40 },
    photo_focus:           { file: 'photo_focus.mp3',           gain: 0.30 },
    scan:                  { file: 'scan.mp3',                  gain: 0.30 },
    remove_information:    { file: 'remove_information.mp3',    gain: 0.35 },
    sensitive_information: { file: 'sensitive_information.mp3', gain: 0.45 },
    connection:            { file: 'connection.mp3',            gain: 0.40 },
    identity_match:        { file: 'identity_match.mp3',        gain: 0.55 },
    trace_unlock:          { file: 'trace_unlock.mp3',          gain: 0.40 },
    impact:                { file: 'impact.mp3',                gain: 0.60 },
    case_resolved:         { file: 'case_resolved.mp3',         gain: 0.65 },
  };
  const AMBIENCE = { file: 'ambience.mp3', gain: 0.10 };
  // 시작·엔딩 화면에만 까는 잔잔한 음악 (CC0). 빼려면 on을 false로 — 시작도 한 번 누르기로 돌아간다
  const MUSIC = { on: true, gain: 0.35, files: { title: 'music_title.mp3', ending: 'music_ending.mp3' } };

  const LS_KEY = 'aitrace.sound';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { saved = {}; }

  const state = {
    enabled: saved.enabled !== false,
    volume: typeof saved.volume === 'number' ? saved.volume : 0.8,
    unlocked: false,
    mode: null,          // 'webaudio' | 'element'
  };

  let ctx = null, master = null, sfxBus = null, ambBus = null, ambSource = null;
  const buffers = {};
  const elements = {};   // element fallback (file:// 등 fetch 불가 환경)
  let ambEl = null;
  const lastPlayed = {};

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ enabled: state.enabled, volume: state.volume })); } catch (e) {}
  }

  async function loadBuffer(name, file) {
    const res = await fetch(SFX_PATH + file);
    if (!res.ok) throw new Error('fetch ' + file);
    const arr = await res.arrayBuffer();
    buffers[name] = await new Promise((ok, bad) => ctx.decodeAudioData(arr, ok, bad));
  }

  async function initWebAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || location.protocol === 'file:') throw new Error('no webaudio');
    ctx = new AC();
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    ambBus = ctx.createGain();
    sfxBus.connect(master); ambBus.connect(master); master.connect(ctx.destination);
    master.gain.value = state.enabled ? state.volume : 0;
    ambBus.gain.value = 0;
    await Promise.all([
      ...Object.entries(SOUNDS).map(([k, v]) => loadBuffer(k, v.file)),
      loadBuffer('__amb', AMBIENCE.file),
    ]);
    state.mode = 'webaudio';
    // 음악은 효과음 읽기를 막지 않게 따로 읽는다. 다 읽혔을 때 틀어 달라던 곡이면 바로 튼다
    if (MUSIC.on) Object.entries(MUSIC.files).forEach(([k, f]) =>
      loadBuffer('__m_' + k, f).then(() => { if (musWant === k && !musSource) setMusic(k, musMs); }).catch(() => {}));
  }

  function initElements() {
    Object.entries(SOUNDS).forEach(([k, v]) => {
      const a = new Audio(SFX_PATH + v.file); a.preload = 'auto'; elements[k] = a;
    });
    ambEl = new Audio(SFX_PATH + AMBIENCE.file); ambEl.loop = true; ambEl.volume = 0;
    if (MUSIC.on) Object.entries(MUSIC.files).forEach(([k, f]) => {
      const a = new Audio(SFX_PATH + f); a.loop = true; a.volume = 0; musEls[k] = a;
    });
    state.mode = 'element';
  }

  // 최초 사용자 조작 때 한 번 호출 (autoplay 정책)
  async function unlock() {
    if (state.unlocked) return;
    state.unlocked = true;
    try { await initWebAudio(); if (ctx.state === 'suspended') await ctx.resume(); }
    catch (e) { initElements(); }
  }

  function play(name, opts = {}) {
    const def = SOUNDS[name];
    if (!def || !state.unlocked || !state.enabled) return;
    const now = performance.now();
    const minGap = name === 'ui_hover' ? 90 : 35;           // 연타 겹침 방지
    if (lastPlayed[name] && now - lastPlayed[name] < minGap) return;
    lastPlayed[name] = now;
    const g = def.gain * (opts.gain ?? 1);
    if (state.mode === 'webaudio' && buffers[name]) {
      const src = ctx.createBufferSource();
      src.buffer = buffers[name];
      if (opts.rate) src.playbackRate.value = opts.rate;
      const vg = ctx.createGain(); vg.gain.value = g;
      src.connect(vg); vg.connect(sfxBus);
      src.start(ctx.currentTime + (opts.delay || 0) / 1000);
    } else if (state.mode === 'element' && elements[name]) {
      const a = elements[name].cloneNode();
      a.volume = Math.min(1, g * state.volume);
      setTimeout(() => a.play().catch(() => {}), opts.delay || 0);
    }
  }

  function ambTarget(level) { return AMBIENCE.gain * level; }
  let ambLevel = 0;

  function setAmbience(level, ms = 800) {
    ambLevel = level;
    if (!state.unlocked) return;
    if (state.mode === 'webaudio') {
      if (!ambSource && buffers.__amb) {
        ambSource = ctx.createBufferSource();
        ambSource.buffer = buffers.__amb; ambSource.loop = true;
        ambSource.connect(ambBus); ambSource.start();
      }
      const t = ctx.currentTime;
      ambBus.gain.cancelScheduledValues(t);
      ambBus.gain.setValueAtTime(ambBus.gain.value, t);
      ambBus.gain.linearRampToValueAtTime(ambTarget(level), t + ms / 1000);
    } else if (state.mode === 'element' && ambEl) {
      if (ambEl.paused && level > 0) ambEl.play().catch(() => {});
      rampElement(ambEl, state.enabled ? Math.min(1, ambTarget(level) * state.volume) : 0, ms);
    }
  }

  function rampElement(el, to, ms) {
    const from = el.volume, start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // 음악: 이름을 주면 서서히 들어오고, null이면 서서히 사라진다. 한 번에 한 곡만 튼다
  let musWant = null, musMs = 1500, musPlaying = null, musSource = null, musGain = null;
  const musEls = {};
  function setMusic(name, ms = 1500) {
    musWant = MUSIC.on ? name : null; musMs = ms;
    if (!state.unlocked) return;
    if (state.mode === 'webaudio') {
      const t = ctx.currentTime;
      if (musSource && musPlaying !== musWant) {
        musGain.gain.cancelScheduledValues(t);
        musGain.gain.setValueAtTime(musGain.gain.value, t);
        musGain.gain.linearRampToValueAtTime(0, t + ms / 1000);
        musSource.stop(t + ms / 1000 + 0.05);
        musSource = null; musPlaying = null;
      }
      if (musWant && !musSource && buffers['__m_' + musWant]) {
        musGain = ctx.createGain(); musGain.gain.value = 0; musGain.connect(master);   // 처음 한순간도 크게 나지 않게 0에서 시작
        musGain.gain.setValueAtTime(0, t);
        musGain.gain.linearRampToValueAtTime(MUSIC.gain, t + ms / 1000);
        musSource = ctx.createBufferSource();
        musSource.buffer = buffers['__m_' + musWant]; musSource.loop = true;
        musSource.connect(musGain); musSource.start();
        musPlaying = musWant;
      }
    } else if (state.mode === 'element') {
      Object.entries(musEls).forEach(([k, a]) => {
        const on = k === musWant;
        if (on && a.paused) { a.currentTime = 0; a.play().catch(() => {}); }
        rampElement(a, on && state.enabled ? Math.min(1, MUSIC.gain * state.volume) : 0, ms);
        if (!on) setTimeout(() => { if (k !== musWant) a.pause(); }, ms + 60);
      });
      musPlaying = musWant;
    }
  }

  // 정적 연출: ambience를 잠깐 거의 0으로 → hold → 원래대로
  function duck(holdMs = 500, downMs = 250, level = 0.08) {
    const back = ambLevel;
    setAmbience(level, downMs);
    ambLevel = back;
    return new Promise(r => setTimeout(r, downMs + holdMs));
  }
  function restore(ms = 900) { setAmbience(ambLevel, ms); }

  function setEnabled(on) {
    state.enabled = on; persist();
    if (state.mode === 'webaudio' && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(on ? state.volume : 0, t + 0.15);
    } else if (state.mode === 'element' && ambEl) {
      ambEl.volume = on ? Math.min(1, ambTarget(ambLevel) * state.volume) : 0;
      if (musEls[musPlaying]) musEls[musPlaying].volume = on ? Math.min(1, MUSIC.gain * state.volume) : 0;
    }
  }
  function setVolume(v) {
    state.volume = v; persist();
    if (state.mode === 'webaudio' && master && state.enabled) master.gain.value = v;
    if (state.mode === 'element' && ambEl && state.enabled) {
      ambEl.volume = Math.min(1, ambTarget(ambLevel) * v);
      if (musEls[musPlaying]) musEls[musPlaying].volume = Math.min(1, MUSIC.gain * v);
    }
  }

  window.Sound = {
    unlock, play, setAmbience, setMusic, duck, restore, setEnabled, setVolume,
    get enabled() { return state.enabled; },
    get volume() { return state.volume; },
    get musicOn() { return MUSIC.on; },
    get music() { return musPlaying; },                                   // 지금 틀고 있는 곡 이름 (점검용)
    get musicLevel() { return musGain ? musGain.gain.value : 0; },       // 지금 음악 음량 (점검용, Web Audio일 때)
    TRIGGERS: Object.keys(SOUNDS),
  };
})();
