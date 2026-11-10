/* Motion studies for the Pixelore partner card. The partner mark remains available as an image fallback. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...document.querySelectorAll('.pixelore[data-motion]')];
  const mark = new Image();
  mark.src = '/images/partners/pixelore-logo-dark.svg';
  let frame = 0;
  let last = 0;
  const states = cards.map((card) => ({
    card,
    canvas: card.querySelector('canvas'),
    visible: false,
    pointer: null,
    points: [],
    width: 0,
    height: 0,
  }));

  const resetField = (state) => {
    const sample = document.createElement('canvas');
    sample.width = Math.round(state.width);
    sample.height = Math.round(state.height);
    const context = sample.getContext('2d', { willReadFrequently: true });
    const width = Math.min(state.width * 0.64, 220);
    const height = width * (315 / 1750);
    context.drawImage(mark, (state.width - width) / 2, (state.height - height) / 2, width, height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    state.points = [];
    for (let y = 0; y < sample.height; y += 3) {
      for (let x = 0; x < sample.width; x += 3) {
        if (pixels[(y * sample.width + x) * 4 + 3] > 100) {
          state.points.push({ x, y, currentX: x, currentY: y });
        }
      }
    }
    if (state.points.length) state.card.classList.add('ready');
  };

  const resize = (state) => {
    const bounds = state.card.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    state.width = bounds.width;
    state.height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    state.canvas.width = Math.round(state.width * ratio);
    state.canvas.height = Math.round(state.height * ratio);
    state.canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    if (state.card.dataset.motion === 'field' && mark.complete && mark.naturalWidth)
      resetField(state);
  };

  const drawField = (state, context, dt) => {
    context.fillStyle = '#f7bb48';
    const rate = 1 - Math.exp(-dt / 145);
    for (const point of state.points) {
      let x = point.x;
      let y = point.y;
      if (state.pointer) {
        const dx = point.x - state.pointer.x;
        const dy = point.y - state.pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        const force = Math.max(0, 1 - distance / 54);
        x += (dx / distance) * force * 22;
        y += (dy / distance) * force * 22;
      }
      point.currentX += (x - point.currentX) * rate;
      point.currentY += (y - point.currentY) * rate;
      context.fillRect(point.currentX, point.currentY, 1.5, 1.5);
    }
  };

  const drawLight = (state, context, time) => {
    const cx = state.pointer?.x ?? state.width * (0.5 + 0.18 * Math.sin(time / 2400));
    const cy = state.pointer?.y ?? state.height / 2;
    const glow = context.createRadialGradient(cx, cy, 0, cx, cy, 92);
    glow.addColorStop(0, 'rgba(248,176,61,.23)');
    glow.addColorStop(1, 'rgba(248,176,61,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, state.width, state.height);
    for (let y = 14; y < state.height; y += 11) {
      for (let x = 14; x < state.width; x += 11) {
        const distance = Math.hypot(x - cx, y - cy);
        const alpha = 0.06 + Math.max(0, 1 - distance / 100) * 0.6;
        context.fillStyle = `rgba(250,190,80,${alpha})`;
        context.fillRect(x, y, 1.6, 1.6);
      }
    }
  };

  const tick = (time) => {
    frame = 0;
    if (document.hidden || reduceMotion.matches) return;
    const dt = Math.min(time - (last || time), 50);
    last = time;
    for (const state of states) {
      if (!state.visible || !state.width) continue;
      const context = state.canvas.getContext('2d');
      context.clearRect(0, 0, state.width, state.height);
      if (state.card.dataset.motion === 'field') drawField(state, context, dt);
      else drawLight(state, context, time);
    }
    if (states.some((state) => state.visible)) frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (
      !frame &&
      !document.hidden &&
      !reduceMotion.matches &&
      states.some((state) => state.visible)
    ) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const state = states.find((item) => item.card === entry.target);
      if (state) state.visible = entry.isIntersecting;
    }
    start();
  });
  states.forEach((state) => {
    observer.observe(state.card);
    state.card.addEventListener('pointermove', (event) => {
      const bounds = state.card.getBoundingClientRect();
      state.pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    });
    state.card.addEventListener('pointerleave', () => {
      state.pointer = null;
    });
    state.card.addEventListener('focus', () => {
      state.pointer = { x: state.width / 2, y: state.height / 2 };
    });
    state.card.addEventListener('blur', () => {
      state.pointer = null;
    });
  });
  const resizeAll = () => states.forEach(resize);
  mark.addEventListener('load', resizeAll);
  window.addEventListener('resize', resizeAll);
  document.addEventListener('visibilitychange', start);
  reduceMotion.addEventListener('change', start);
  resizeAll();
})();
