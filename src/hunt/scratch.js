// Independently implemented foil effect inspired by Piotr Prus's demonstration.
// The hunt supplies the reveal only after the server approves it.
const activeFoils = new Set();
const cardStates = new WeakMap();
const denialKey = 'devfest-y2k-hunt-motion-denied';
let autoPermissionAttempted = false;
try {
  autoPermissionAttempted = sessionStorage.getItem(denialKey) === 'yes';
} catch {
  // Storage can be unavailable; in-memory state still prevents repeat prompts.
}
let activeGestures = 0;
let removalObserver;
let motionListening = false;
let motionOptedIn = false;
let motionState = autoPermissionAttempted ? 'denied' : 'idle';
let allowedMotion = false;
let allowedOrientation = false;
let firstPose = null;
let currentSource = '';
let lastScreenAngle = null;
let lastMotionAt = 0;
let waitingTimer;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const tiltDegrees = 7;
const sensitivity = 1;
const response = 0.28;

function setMotionState(state) {
  if (motionState === state) return;
  motionState = state;
  activeFoils.forEach((foil) => foil.syncMotion(state));
}

function screenAxes(x, y, angle) {
  if (angle === 90) return [y, -x];
  if (angle === 180) return [-x, -y];
  if (angle === 270) return [-y, x];
  return [x, y];
}

function updateTilt(source, x, y, sensitivity, alreadyScreenAxes = false) {
  if (!motionOptedIn || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const angle = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
  if (!alreadyScreenAxes) [x, y] = screenAxes(x, y, angle);
  if (currentSource !== source || !firstPose || lastScreenAngle !== angle) {
    currentSource = source;
    firstPose = { x, y };
    lastScreenAngle = angle;
  }
  // Compare against the first comfortable resting position instead of clamping
  // an upright phone at the end of the range. This works flat or upright.
  const angularDifference = (value, baseline) => ((value - baseline + 540) % 360) - 180;
  const dx = angularDifference(x, firstPose.x) / sensitivity;
  const dy = angularDifference(y, firstPose.y) / sensitivity;
  clearTimeout(waitingTimer);
  setMotionState('active');
  waitingTimer = setTimeout(() => {
    if (motionState === 'active') setMotionState('unavailable');
  }, 10000);
  activeFoils.forEach((foil) => foil.tilt(dx, dy));
}

function motionChanged(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (
    !acceleration ||
    !Number.isFinite(acceleration.x) ||
    !Number.isFinite(acceleration.y) ||
    !Number.isFinite(acceleration.z)
  )
    return;
  const angle = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
  const [x, y] = screenAxes(acceleration.x, acceleration.y, angle);
  const z = acceleration.z;
  if (Math.hypot(x, y, z) < 1) return;
  // Derive angular roll and pitch from all three gravity axes: unlike raw y,
  // atan2 keeps the foil responsive near a phone's upright position.
  const roll = (Math.atan2(x, Math.hypot(y, z)) * 180) / Math.PI;
  const pitch = (Math.atan2(y, z) * 180) / Math.PI;
  lastMotionAt = performance.now();
  updateTilt('motion', roll, pitch, 30, true);
}

function orientationChanged(event) {
  if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
  // Prefer gravity data when it is arriving, but use orientation independently
  // when a browser reports null motion values or motion stops.
  if (lastMotionAt && performance.now() - lastMotionAt < 1200) return;
  updateTilt('orientation', event.gamma, event.beta, 30);
}

function stopSensors() {
  if (motionListening) {
    window.removeEventListener('devicemotion', motionChanged);
    window.removeEventListener('deviceorientation', orientationChanged);
  }
  motionListening = false;
  clearTimeout(waitingTimer);
  firstPose = null;
  currentSource = '';
  lastScreenAngle = null;
  lastMotionAt = 0;
}

function startSensors() {
  if (!activeFoils.size || !motionOptedIn || motionListening) return;
  if (document.hidden) {
    setMotionState('unavailable');
    return;
  }
  if (allowedMotion) window.addEventListener('devicemotion', motionChanged, { passive: true });
  if (allowedOrientation)
    window.addEventListener('deviceorientation', orientationChanged, { passive: true });
  motionListening = true;
  setMotionState('waiting');
  clearTimeout(waitingTimer);
  waitingTimer = setTimeout(() => {
    if (motionState === 'waiting') setMotionState('unavailable');
  }, 6000);
}

function visibilityChanged() {
  if (document.hidden) {
    stopSensors();
    if (motionOptedIn) setMotionState('unavailable');
  } else if (motionOptedIn && (allowedMotion || allowedOrientation)) {
    startSensors();
  }
}

function requestTilt() {
  if (motionState === 'requesting') return;
  setMotionState('requesting');
  motionOptedIn = true;
  stopSensors();
  const sources = [
    ['motion', window.DeviceMotionEvent, 'ondevicemotion'],
    ['orientation', window.DeviceOrientationEvent, 'ondeviceorientation'],
  ];
  // Invoke every permission method synchronously in this click handler: iOS
  // requires a user gesture, which can be lost after awaiting the first call.
  const requests = sources.map(([name, api, eventName]) => {
    if (!api && !(eventName in window)) return { name, promise: Promise.resolve('unsupported') };
    try {
      const result =
        typeof api?.requestPermission === 'function' ? api.requestPermission() : 'granted';
      return { name, promise: Promise.resolve(result) };
    } catch {
      return { name, promise: Promise.resolve('denied') };
    }
  });
  Promise.allSettled(requests.map(({ promise }) => promise)).then((results) => {
    const granted = (index) =>
      results[index].status === 'fulfilled' && results[index].value === 'granted';
    allowedMotion = granted(0);
    allowedOrientation = granted(1);
    if (!allowedMotion && !allowedOrientation) {
      const denied = results.some(
        (result) => result.status === 'rejected' || result.value === 'denied',
      );
      if (denied) {
        try {
          sessionStorage.setItem(denialKey, 'yes');
        } catch {
          // Denial remains recorded for this page even without session storage.
        }
      }
      setMotionState(denied ? 'denied' : 'unavailable');
      return;
    }
    try {
      sessionStorage.removeItem(denialKey);
    } catch {
      // Sensor use does not depend on storage.
    }
    if (activeFoils.size) startSensors();
    else setMotionState('waiting');
  });
}

function automaticPermission(event) {
  if (autoPermissionAttempted || motionOptedIn || reducedMotion.matches || !event.isTrusted) return;
  if (!activeFoils.size || activeGestures) return;
  if (!(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)) return;
  if (
    event.composedPath().some((node) => node instanceof Element && node.matches('.motion-button'))
  )
    return;
  if (event.type === 'pointerup' && event.pointerType !== 'touch' && event.pointerType !== 'pen')
    return;
  autoPermissionAttempted = true;
  requestTilt();
}

function unregisterFoil(foil) {
  if (!activeFoils.delete(foil)) return;
  foil.cleanup();
  if (activeFoils.size) return;
  stopSensors();
  removalObserver?.disconnect();
  removalObserver = undefined;
  document.removeEventListener('visibilitychange', visibilityChanged);
}

// Only ask on touch input while there is an active scratch card.
if ('PointerEvent' in window) document.addEventListener('pointerup', automaticPermission);
else document.addEventListener('touchend', automaticPermission, { passive: true });

function registerFoil(foil) {
  activeFoils.add(foil);
  foil.syncMotion(motionState);
  if (!removalObserver) {
    removalObserver = new MutationObserver(() => {
      activeFoils.forEach((entry) => {
        if (!entry.element.isConnected) unregisterFoil(entry);
      });
    });
    removalObserver.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', visibilityChanged);
  }
  requestAnimationFrame(() => {
    if (!activeFoils.has(foil)) return;
    const root = foil.element.getRootNode();
    if (root instanceof ShadowRoot)
      removalObserver?.observe(root, { childList: true, subtree: true });
  });
  if (motionOptedIn && (allowedMotion || allowedOrientation)) startSensors();
}

/**
 * One sensor subscription moves the album's CSS foils together.
 * @param {HTMLElement} element
 * @param {(state: string) => void} onState
 */
export function bindAlbumMotion(element, onState) {
  const entry = {
    element,
    syncMotion: onState,
    cleanup() {
      element.style.removeProperty('--album-rotate-x');
      element.style.removeProperty('--album-rotate-y');
      element.style.removeProperty('--album-sheen-x');
    },
    tilt(x, y) {
      if (reducedMotion.matches) return;
      const roll = clamp(x, -1, 1);
      const pitch = clamp(y, -1, 1);
      element.style.setProperty('--album-rotate-x', `${-pitch * 5}deg`);
      element.style.setProperty('--album-rotate-y', `${roll * 6}deg`);
      element.style.setProperty('--album-sheen-x', `${roll * 42}%`);
    },
  };
  registerFoil(entry);
  return () => unregisterFoil(entry);
}

export function enableAlbumMotion() {
  autoPermissionAttempted = true;
  requestTilt();
}

/** @param {{label?: string, content?: string, onReveal?: (foil: string) => boolean | Promise<boolean>}} options */
export function scratch({ label, content, onReveal } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'scratch-widget';
  const stage = document.createElement('div');
  stage.className = 'scratch-stage';
  const surface = document.createElement('div');
  surface.className = 'scratch-surface';
  const answer = document.createElement('div');
  answer.className = 'scratch-answer';
  answer.textContent = content || '';
  answer.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'scratch-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const dustCanvas = document.createElement('canvas');
  dustCanvas.className = 'scratch-dust';
  dustCanvas.setAttribute('aria-hidden', 'true');
  const instruction = document.createElement('span');
  instruction.className = 'scratch-instruction';
  instruction.textContent = label || 'Scratch to reveal';
  instruction.setAttribute('aria-hidden', 'true');
  const controls = document.createElement('div');
  controls.className = 'scratch-controls';
  const hint = document.createElement('span');
  hint.textContent = 'Scratch with your finger or mouse';
  const reveal = document.createElement('button');
  reveal.className = 'reveal-button';
  reveal.type = 'button';
  reveal.textContent = 'Reveal';
  reveal.setAttribute('aria-label', `Reveal ${label || 'the hidden message'}`);
  const status = document.createElement('span');
  status.className = 'sr-only';
  status.setAttribute('aria-live', 'polite');
  controls.append(hint, reveal, status);
  surface.append(answer, canvas, instruction);
  stage.append(surface, dustCanvas);
  wrapper.append(stage, controls);

  const hasTouchInput =
    navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  let motionButton;
  let motionStatus;
  if (hasTouchInput) {
    motionButton = document.createElement('button');
    motionButton.type = 'button';
    motionButton.className = 'motion-button';
    motionButton.addEventListener('click', () => {
      autoPermissionAttempted = true;
      requestTilt();
    });
    motionStatus = document.createElement('span');
    motionStatus.className = 'motion-status';
    motionStatus.setAttribute('aria-live', 'polite');
    controls.append(motionButton, motionStatus);
  }

  function syncMotion(state) {
    if (!motionButton || !motionStatus) return;
    const labels = {
      idle: ['Enable phone tilt', 'Allow motion access if your phone asks.'],
      requesting: ['Requesting permission…', 'Waiting for motion permission.'],
      waiting: ['Waiting for motion…', 'Move or tilt your phone to activate the foil.'],
      active: ['Tilt active', 'Tilt your phone to move the holographic light.'],
      denied: [
        'Try phone tilt again',
        'Motion permission denied. Check browser settings and reload.',
      ],
      unavailable: [
        'Try phone tilt again',
        'No motion data yet. Check device and browser settings, then retry.',
      ],
    };
    const [buttonText, message] = labels[state] || labels.idle;
    motionButton.textContent = buttonText;
    motionButton.disabled = state === 'requesting' || state === 'waiting' || state === 'active';
    motionStatus.textContent = message;
  }

  let done = false;
  let checking = false;
  let dragging = false;
  let previous = null;
  let moves = 0;
  let initialized = false;
  let frame = 0;
  let tiltX = 0;
  let tiltY = 0;
  let resizeObserver = null;
  let touchId = null;
  let activePointerId = null;
  let cardState = null;
  let cardFrozen = false;
  let audioContext;
  let audioBuffer;
  let audioLoad;
  let lastSound = 0;
  let lastGrain = -1;
  let soundTravel = Infinity;
  let dustFrame = 0;
  let lastDustAt = 0;
  let dustFreshness = 0;
  const dustMargin = 28;
  const particles = [];
  const dustCtx = dustCanvas.getContext('2d');
  // Piotr Prus's 16 recorded 120 ms grains, filtered for the selected fine scrape:
  // https://github.com/PiotrPrus/holographic-lottery-coupon-agsl/tree/b508047d66da1df656b2ee85f1320d63670290e0/app/src/main/res/raw
  // Fetch ahead of the gesture; browsers still require AudioContext activation by the user.
  const soundData = fetch('/audio/piotr-scratch-fine.wav')
    .then((result) => {
      if (!result.ok) throw new Error('Scratch sound unavailable');
      return result.arrayBuffer();
    })
    .catch(() => null);
  function prepareSound() {
    if (audioLoad) {
      if (audioContext?.state === 'suspended') void audioContext.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
      void audioContext.resume().catch(() => {});
      audioLoad = soundData
        .then((data) => data && audioContext.decodeAudioData(data))
        .then((buffer) => {
          audioBuffer = buffer;
          if (dragging && audioBuffer) playScratchSound(performance.now());
        })
        .catch(() => {});
    } catch {
      // The interaction stays usable when audio is unavailable.
    }
  }
  function playScratchSound(now) {
    if (!audioBuffer || !audioContext || audioContext.state !== 'running' || now - lastSound < 45)
      return;
    if (soundTravel < 14) return;
    soundTravel = 0;
    lastSound = now;
    let index = Math.floor(Math.random() * 16);
    if (index === lastGrain) index = (index + 1) % 16;
    lastGrain = index;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = audioBuffer;
    source.playbackRate.value = 0.92 + Math.random() * 0.16;
    gain.gain.value = 0.55;
    source.connect(gain).connect(audioContext.destination);
    source.start(0, index * 0.12, 0.12);
  }
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const maskCtx = mask.getContext('2d', { willReadFrequently: true });
  let cssWidth = 0;
  let cssHeight = 0;
  function ensureCard() {
    if (cardState) return cardState;
    // Move only the foil, answer and instruction; surrounding controls stay put.
    const target = surface;
    let state = cardStates.get(target);
    if (!state) {
      state = {
        target,
        x: 0,
        y: 0,
        frozen: 0,
        users: new Set(),
        initialTransform: target.style.transform,
      };
      cardStates.set(target, state);
    }
    state.users.add(entry);
    cardState = state;
    return state;
  }
  function paintCard(state) {
    if (state.frozen) return;
    const rotateX = -state.y * tiltDegrees;
    const rotateY = state.x * tiltDegrees;
    const size = getComputedStyle(state.target);
    const halfWidth = (parseFloat(size.width) || state.target.clientWidth) / 2;
    const halfHeight = (parseFloat(size.height) || state.target.clientHeight) / 2;
    const perspective = 2200;
    let scale = 1;
    if (halfWidth && halfHeight) {
      const rx = (rotateX * Math.PI) / 180;
      const ry = (rotateY * Math.PI) / 180;
      const sx = Math.sin(rx);
      const cx = Math.cos(rx);
      const sy = Math.sin(ry);
      const cy = Math.cos(ry);
      // Keep each projected corner within the surface's stationary layout box.
      // Keep the tilted surface clear of the surrounding controls.
      for (const x of [-halfWidth, halfWidth]) {
        for (const y of [-halfHeight, halfHeight]) {
          const projectedX = cy * x;
          const projectedY = cx * y + sx * sy * x;
          const depth = sx * y - cx * sy * x;
          const xLimit = Math.abs(projectedX) + (halfWidth * depth) / perspective;
          const yLimit = Math.abs(projectedY) + (halfHeight * depth) / perspective;
          if (xLimit > 0) scale = Math.min(scale, halfWidth / xLimit);
          if (yLimit > 0) scale = Math.min(scale, halfHeight / yLimit);
        }
      }
    }
    scale = clamp(scale, 0, 1);
    state.target.style.transform = `perspective(${perspective}px) scale3d(${scale}, ${scale}, ${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }
  function freezeCard() {
    if (cardFrozen) return;
    const state = ensureCard();
    state.frozen++;
    activeGestures++;
    cardFrozen = true;
    state.target.style.transform = 'none';
  }
  function releaseCard() {
    if (!cardFrozen || !cardState) return;
    cardFrozen = false;
    cardState.frozen = Math.max(0, cardState.frozen - 1);
    activeGestures = Math.max(0, activeGestures - 1);
    paintCard(cardState);
  }
  function detachCard() {
    releaseCard();
    if (!cardState) return;
    cardState.users.delete(entry);
    if (!cardState.users.size) {
      cardState.target.style.transform = cardState.initialTransform;
      cardStates.delete(cardState.target);
    }
    cardState = null;
  }
  const entry = {
    element: wrapper,
    syncMotion,
    cleanup() {
      removeFallbackListeners();
      detachCard();
      resizeObserver?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (dustFrame) cancelAnimationFrame(dustFrame);
      frame = 0;
      dustFrame = 0;
      particles.length = 0;
      if (audioContext && audioContext.state !== 'closed')
        void audioContext.close().catch(() => {});
    },
    tilt(x, y) {
      if (reducedMotion.matches) return;
      const targetX = clamp(x * sensitivity, -1, 1);
      const targetY = clamp(y * sensitivity, -1, 1);
      tiltX += (targetX - tiltX) * response;
      tiltY += (targetY - tiltY) * response;
      const state = ensureCard();
      state.x = tiltX;
      state.y = tiltY;
      paintCard(state);
      scheduleDraw();
    },
  };

  function resize() {
    if (!ctx || !maskCtx) return false;
    const widthCss = canvas.clientWidth;
    const heightCss = canvas.clientHeight;
    if (!widthCss || !heightCss) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(widthCss * ratio);
    const height = Math.round(heightCss * ratio);
    if (!initialized || mask.width !== width || mask.height !== height) {
      const old = document.createElement('canvas');
      old.width = mask.width;
      old.height = mask.height;
      if (initialized) old.getContext('2d').drawImage(mask, 0, 0);
      mask.width = width;
      mask.height = height;
      canvas.width = width;
      canvas.height = height;
      dustCanvas.width = Math.round((widthCss + dustMargin * 2) * ratio);
      dustCanvas.height = Math.round((heightCss + dustMargin * 2) * ratio);
      if (initialized) maskCtx.drawImage(old, 0, 0, width, height);
      else {
        maskCtx.fillStyle = '#000';
        maskCtx.fillRect(0, 0, width, height);
      }
      initialized = true;
    }
    cssWidth = widthCss;
    cssHeight = heightCss;
    return true;
  }

  function render() {
    frame = 0;
    if (done || !resize()) return;
    const width = cssWidth;
    const height = cssHeight;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const metal = ctx.createLinearGradient(0, 0, 0, height);
    metal.addColorStop(0, '#858995');
    metal.addColorStop(0.24, '#c9cdd1');
    metal.addColorStop(0.53, '#e0e1df');
    metal.addColorStop(0.78, '#aaaeb5');
    metal.addColorStop(1, '#7d838e');
    ctx.fillStyle = metal;
    ctx.fillRect(0, 0, width, height);

    // Two broad diffraction bands and a moving pool of light span both axes.
    const lightX = width * (0.5 + tiltX * 0.58);
    const lightY = height * (0.5 + tiltY * 0.55);
    const spectrum = ctx.createLinearGradient(
      -width * 0.2 + tiltX * width * 0.32,
      -height * 0.55 + tiltY * height * 0.5,
      width * 1.2 + tiltX * width * 0.32,
      height * 1.55 + tiltY * height * 0.5,
    );
    spectrum.addColorStop(0, 'rgba(157,172,213,0.18)');
    spectrum.addColorStop(0.23, 'rgba(221,166,195,0.42)');
    spectrum.addColorStop(0.43, 'rgba(238,209,157,0.46)');
    spectrum.addColorStop(0.64, 'rgba(151,214,202,0.47)');
    spectrum.addColorStop(0.82, 'rgba(171,169,223,0.4)');
    spectrum.addColorStop(1, 'rgba(219,173,190,0.2)');
    ctx.fillStyle = spectrum;
    ctx.fillRect(0, 0, width, height);

    const fringe = ctx.createLinearGradient(
      width * 0.15 - tiltX * width * 0.25,
      -height * 0.5 - tiltY * height * 0.35,
      width * 0.85 - tiltX * width * 0.25,
      height * 1.5 - tiltY * height * 0.35,
    );
    fringe.addColorStop(0, 'rgba(255,255,255,0)');
    fringe.addColorStop(0.36, 'rgba(255,235,244,0.06)');
    fringe.addColorStop(0.48, 'rgba(255,255,255,0.25)');
    fringe.addColorStop(0.58, 'rgba(184,231,228,0.12)');
    fringe.addColorStop(0.72, 'rgba(255,255,255,0)');
    ctx.fillStyle = fringe;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, width * 0.65);
    glow.addColorStop(0, 'rgba(255,255,255,0.26)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    // Fine, deterministic lines and small facets suggest brushed aluminium.
    for (let y = 0; y < height; y += 2) {
      const alpha = 0.07 + ((y * 31) % 17) / 260;
      ctx.fillStyle = y % 4 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(50,56,65,${alpha * 0.65})`;
      ctx.fillRect(0, y, width, 0.65);
    }
    for (let i = 0; i < 60; i++) {
      const noiseX = Math.sin(i * 127.1 + 29) * 43758.5453;
      const noiseY = Math.sin(i * 311.7 + 41) * 43758.5453;
      const x = (noiseX - Math.floor(noiseX)) * width;
      const y = (noiseY - Math.floor(noiseY)) * height;
      const alignment = Math.cos(i * 7.3 + tiltX * 7 + tiltY * 5);
      const distance = Math.hypot((x - lightX) / width, (y - lightY) / height);
      const sparkle = Math.max(0, (alignment - 0.88) / 0.12) * Math.max(0, 1 - distance);
      ctx.fillStyle = `rgba(255,255,255,${sparkle * 0.72})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    // Intersect the foil with the persistent scratch mask after each redraw.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function scheduleDraw() {
    if (!frame && !done) frame = requestAnimationFrame(render);
  }

  async function finish() {
    if (done || checking) return;
    checking = true;
    reveal.disabled = true;
    reveal.textContent = 'Checking…';
    let approved = false;
    try {
      // Preserve the exact remaining foil before a successful state update replaces this widget.
      if (frame) cancelAnimationFrame(frame);
      render();
      const foil = initialized ? canvas.toDataURL('image/png') : '';
      approved = (await onReveal?.(foil)) !== false;
    } catch {
      status.textContent = 'Could not check the card. Try Reveal again.';
    } finally {
      checking = false;
      if (!approved) {
        reveal.disabled = false;
        reveal.textContent = 'Reveal';
      }
    }
    if (!approved) return;
    done = true;
    dragging = false;
    activePointerId = null;
    touchId = null;
    previous = null;
    if (frame) cancelAnimationFrame(frame);
    unregisterFoil(entry);
    resizeObserver?.disconnect();
    canvas.style.opacity = '0';
    canvas.style.pointerEvents = 'none';
    instruction.hidden = true;
    answer.removeAttribute('aria-hidden');
    hint.textContent = 'Revealed';
    reveal.disabled = true;
    reveal.textContent = 'Revealed';
    if (motionButton) motionButton.hidden = true;
    if (motionStatus) motionStatus.hidden = true;
    status.textContent = `Revealed: ${content || ''}`;
  }
  function drawDust(now) {
    dustFrame = 0;
    if (!dustCtx || !dustCanvas.width || !cssWidth) return;
    const scaleX = dustCanvas.width / (cssWidth + dustMargin * 2);
    const scaleY = dustCanvas.height / (cssHeight + dustMargin * 2);
    dustCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    dustCtx.clearRect(0, 0, cssWidth + dustMargin * 2, cssHeight + dustMargin * 2);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = (now - p.start) / 1000;
      if (age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      dustCtx.globalAlpha = Math.max(0, 1 - age / p.life);
      dustCtx.fillStyle = p.color;
      dustCtx.beginPath();
      dustCtx.arc(
        p.x + dustMargin + p.vx * age,
        p.y + dustMargin + p.vy * age + 180 * age * age,
        p.size,
        0,
        Math.PI * 2,
      );
      dustCtx.fill();
    }
    dustCtx.globalAlpha = 1;
    if (particles.length && !document.hidden) dustFrame = requestAnimationFrame(drawDust);
  }
  function scratchFeedback(p, freshness) {
    if (freshness <= 0) return;
    const now = performance.now();
    if (!reducedMotion.matches && dustCtx && now - lastDustAt > 25) {
      lastDustAt = now;
      const count = Math.max(1, Math.round(4 * freshness));
      for (let i = 0; i < count && particles.length < 70; i++) {
        particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 100,
          vy: -25 - Math.random() * 90,
          size: 0.8 + Math.random() * 1.4,
          life: 0.35 + Math.random() * 0.35,
          start: now,
          color: ['#555b67', '#d6d8d9', '#8e939b'][Math.floor(Math.random() * 3)],
        });
      }
      if (!dustFrame) dustFrame = requestAnimationFrame(drawDust);
    }
    if (freshness > 0.05) playScratchSound(now);
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function checkCoverage() {
    if (done || !initialized) return;
    const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
    let clear = 0;
    let samples = 0;
    for (let i = 3; i < pixels.length; i += 256) {
      samples++;
      if (pixels[i] < 64) clear++;
    }
    if (samples && clear / samples > 0.42) finish();
  }
  function erase(event) {
    if (!dragging || checking || done || !initialized) return;
    const p = point(event);
    const rect = canvas.getBoundingClientRect();
    // A small patch estimates how much untouched foil surrounds the moving blade.
    // Sampling a patch, instead of a single pixel, tapers dust at scratched edges.
    const scaleX = mask.width / rect.width;
    const scaleY = mask.height / rect.height;
    const sampleX = clamp(Math.floor((p.x - 7) * scaleX), 0, mask.width - 1);
    const sampleY = clamp(Math.floor((p.y - 7) * scaleY), 0, mask.height - 1);
    const sampleWidth = Math.max(1, Math.min(Math.ceil(14 * scaleX), mask.width - sampleX));
    const sampleHeight = Math.max(1, Math.min(Math.ceil(14 * scaleY), mask.height - sampleY));
    const pixels = maskCtx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;
    let untouched = 0;
    let samples = 0;
    for (let i = 3; i < pixels.length; i += 16) {
      samples++;
      if (pixels[i] > 64) untouched++;
    }
    const fresh = samples ? untouched / samples : 0;
    dustFreshness += (fresh - dustFreshness) * 0.4;
    if (previous) soundTravel += Math.hypot(p.x - previous.x, p.y - previous.y);
    scratchFeedback(p, fresh > 0.02 ? dustFreshness : 0);
    if (!reducedMotion.matches) {
      tiltX += (clamp((p.x / rect.width) * 2 - 1, -1, 1) - tiltX) * 0.16;
      tiltY += (clamp((p.y / rect.height) * 2 - 1, -1, 1) - tiltY) * 0.16;
    }
    maskCtx.setTransform(mask.width / rect.width, 0, 0, mask.height / rect.height, 0, 0);
    maskCtx.globalCompositeOperation = 'destination-out';
    const from = previous || p;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const length = Math.hypot(dx, dy);
    const nx = length ? -dy / length : 0;
    const ny = length ? dx / length : 1;
    const half = 12 + (moves % 5) * 0.6;
    maskCtx.beginPath();
    if (length < 0.5) {
      maskCtx.rect(p.x - 2, p.y - half, 4, half * 2);
    } else {
      maskCtx.moveTo(from.x + nx * half, from.y + ny * half);
      maskCtx.lineTo(p.x + nx * half, p.y + ny * half);
      maskCtx.lineTo(p.x - nx * half, p.y - ny * half);
      maskCtx.lineTo(from.x - nx * half, from.y - ny * half);
      maskCtx.closePath();
    }
    maskCtx.fill();
    maskCtx.globalCompositeOperation = 'source-over';
    previous = p;
    moves++;
    instruction.hidden = true;
    scheduleDraw();
    if (moves % 12 === 0) checkCoverage();
  }
  function coalesced(event) {
    let samples = [];
    try {
      samples = event.getCoalescedEvents?.() || [];
    } catch {
      // Browsers may expose the method but reject a synthetic or stale event.
    }
    if (!samples.length) samples = [event];
    samples.forEach(erase);
  }

  function endGesture(event) {
    releaseCard();
    dragging = false;
    previous = null;
    soundTravel = Infinity;
    dustFreshness = 0;
    touchId = null;
    activePointerId = null;
    removeFallbackListeners();
    checkCoverage();
    if (event?.type === 'pointerup' || event?.type === 'touchend') automaticPermission(event);
  }

  function fallbackPointerMove(event) {
    if (event.pointerId === activePointerId && !event.composedPath().includes(canvas))
      coalesced(event);
  }
  function fallbackPointerEnd(event) {
    if (event.pointerId === activePointerId) endGesture(event);
  }
  function fallbackPointerBlur() {
    if (dragging) endGesture();
  }
  function installPointerFallback() {
    window.addEventListener('pointermove', fallbackPointerMove);
    window.addEventListener('pointerup', fallbackPointerEnd);
    window.addEventListener('pointercancel', fallbackPointerEnd);
    window.addEventListener('blur', fallbackPointerBlur);
  }
  function fallbackMouseEnd() {
    endGesture();
  }
  function fallbackMouseMove(event) {
    if (!event.composedPath().includes(canvas)) erase(event);
  }
  function touchMove(event) {
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchId);
    if (!touch || !dragging) return;
    event.preventDefault();
    erase(touch);
  }
  function touchEnd(event) {
    if (Array.from(event.changedTouches).some((item) => item.identifier === touchId))
      endGesture(event);
  }
  function removeFallbackListeners() {
    window.removeEventListener('pointermove', fallbackPointerMove);
    window.removeEventListener('pointerup', fallbackPointerEnd);
    window.removeEventListener('pointercancel', fallbackPointerEnd);
    window.removeEventListener('blur', fallbackPointerBlur);
    window.removeEventListener('mousemove', fallbackMouseMove);
    window.removeEventListener('mouseup', fallbackMouseEnd);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('touchend', touchEnd);
    window.removeEventListener('touchcancel', touchEnd);
  }

  if ('PointerEvent' in window) {
    canvas.addEventListener('pointerdown', (event) => {
      if (dragging || checking || done) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      prepareSound();
      freezeCard();
      if (!initialized) render();
      dragging = true;
      activePointerId = event.pointerId;
      previous = null;
      window.addEventListener('blur', fallbackPointerBlur);
      try {
        if (!canvas.setPointerCapture) throw new Error('Pointer capture unavailable');
        canvas.setPointerCapture(event.pointerId);
      } catch {
        installPointerFallback();
      }
      coalesced(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (
        !dragging &&
        !reducedMotion.matches &&
        event.pointerType === 'mouse' &&
        motionState !== 'active'
      ) {
        const rect = canvas.getBoundingClientRect();
        entry.tilt(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          ((event.clientY - rect.top) / rect.height) * 2 - 1,
        );
      }
      if (event.pointerId === activePointerId) coalesced(event);
    });
    canvas.addEventListener('pointerup', fallbackPointerEnd);
    canvas.addEventListener('pointercancel', fallbackPointerEnd);
    canvas.addEventListener('lostpointercapture', (event) => {
      // Capture may disappear while a finger or button is still down. Keep
      // the stroke alive and follow this pointer until its actual up/cancel.
      if (!done && dragging && event.pointerId === activePointerId) installPointerFallback();
    });
  } else {
    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || checking || done) return;
      prepareSound();
      freezeCard();
      if (!initialized) render();
      dragging = true;
      previous = null;
      erase(event);
      window.addEventListener('mousemove', fallbackMouseMove);
      window.addEventListener('mouseup', fallbackMouseEnd);
    });
    canvas.addEventListener('mousemove', (event) => {
      if (!reducedMotion.matches && motionState !== 'active') {
        const rect = canvas.getBoundingClientRect();
        entry.tilt(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          ((event.clientY - rect.top) / rect.height) * 2 - 1,
        );
      }
      erase(event);
    });
    canvas.addEventListener(
      'touchstart',
      (event) => {
        if (dragging || checking || done || !event.changedTouches.length) return;
        prepareSound();
        freezeCard();
        if (!initialized) render();
        event.preventDefault();
        const touch = event.changedTouches[0];
        touchId = touch.identifier;
        dragging = true;
        previous = null;
        erase(touch);
        window.addEventListener('touchmove', touchMove, { passive: false });
        window.addEventListener('touchend', touchEnd);
        window.addEventListener('touchcancel', touchEnd);
      },
      { passive: false },
    );
  }
  reveal.addEventListener('click', finish);
  resizeObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (cardState) paintCard(cardState);
          scheduleDraw();
        })
      : null;
  resizeObserver?.observe(surface);
  registerFoil(entry);
  scheduleDraw();
  return wrapper;
}
