// Sebastian Uriarte Ramos | 12 de noviembre de 2026
// Simulador de vuelo, música, efectos y cielo nocturno para Blue Launch.
'use strict';

const byId = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

let audioContext;
let soundOn = false;
let soundChoice = false;

function setSound(enabled) {
  if (enabled) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    audioContext.resume().catch(() => {});
  }
  soundOn = enabled;
  byId('audio').setAttribute('aria-pressed', String(enabled));
}

function tone(from, to, duration, volume, delay = 0, type = 'sine') {
  if (!soundOn || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration);
}

byId('audio').addEventListener('click', () => {
  soundChoice = true;
  setSound(!soundOn);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#lanzar, #music-toggle')) {
    tone(320, 760, .21, .045);
    tone(910, 460, .18, .027, .07);
  }
});

const music = byId('ambient-music');
const musicToggle = byId('music-toggle');
const musicStatus = byId('music-status');
const updateMusicButton = () => {
  musicToggle.setAttribute('aria-pressed', String(!music.paused && !music.ended && !music.error));
};

music.addEventListener('playing', updateMusicButton);
music.addEventListener('pause', updateMusicButton);
music.addEventListener('ended', updateMusicButton);
music.addEventListener('error', updateMusicButton);
musicToggle.addEventListener('click', () => {
  musicStatus.textContent = '';
  if (!music.paused) {
    music.pause();
    updateMusicButton();
    return;
  }
  music.play().catch((error) => {
    if (error.name !== 'AbortError') {
      updateMusicButton();
      musicStatus.textContent = 'No se pudo reproducir la música. Vuelve a pulsar para intentarlo.';
    }
  });
});

const mascotMessages = [
  '¿Sabías que el apogeo es el punto más alto del vuelo? Ahí la velocidad vertical llega a cero.',
  'Prueba el simulador con y sin paracaídas. Compara la velocidad justo al aterrizar.',
  '¿Quieres ver dónde va el sensor? Selecciónalo en el despiece del cohete.',
  'En el túnel de viento, duplica la velocidad del aire y fíjate en la presión dinámica.',
  'Las estrellas fugaces son meteoros. ¡Mira el cielo de la página y atrapa una con la vista!',
  'El motor deja de empujar y el cohete todavía sube un poco por inercia. ¡Fíjate en el cambio de fase!',
];
let mascotMessageIndex = 0;
byId('medusita').addEventListener('click', () => {
  byId('mascot-message').textContent = mascotMessages[mascotMessageIndex];
  mascotMessageIndex = (mascotMessageIndex + 1) % mascotMessages.length;
});

document.querySelectorAll('.fact button').forEach((button) => {
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
  });
});

const sliders = {
  masa: (value) => value + ' g',
  empuje: (value) => number.format(value) + ' N',
  motor: (value) => number.format(value) + ' s',
  angulo: (value) => value + '°',
  viento: (value) => number.format(value) + ' m/s',
};
const form = byId('controles');
const parameters = [...form.querySelectorAll('input')];
for (const [id, format] of Object.entries(sliders)) {
  const field = byId(id);
  const output = byId(id + '-val');
  const update = () => { output.value = format(Number(field.value)); };
  field.addEventListener('input', update);
  update();
}

const phases = ['En plataforma', 'Ascenso con motor', 'Ascenso por inercia', 'Descenso con paracaídas', 'Descenso sin paracaídas', 'En tierra'];
const startPoint = { t: 0, x: 0, y: 0, vx: 0, vy: 0, phase: 0 };

function calculateFlight() {
  const mass = Number(byId('masa').value) / 1000;
  const thrust = Number(byId('empuje').value);
  const burn = Number(byId('motor').value);
  const angle = Number(byId('angulo').value) * Math.PI / 180;
  const parachute = byId('paracaidas').checked;
  const wind = Number(byId('viento').value);
  const dt = .005;
  const burnSteps = Math.round(burn / dt);
  const gravity = 9.81;
  const bodyDrag = .0007;
  const canopyDrag = .065;
  const deploymentTime = .8;
  let { x, y, vx, vy } = startPoint;
  let peak = startPoint;
  let descentStart = Infinity;
  const points = [startPoint];

  for (let i = 1; i <= 24000; i += 1) {
    const time = i * dt;
    const powered = i <= burnSteps;
    const priorVx = vx;
    const priorVy = vy;
    const airVx = vx - wind;
    const airSpeed = Math.hypot(airVx, vy);
    const opening = parachute ? Math.max(0, Math.min(1, (time - descentStart) / deploymentTime)) : 0;
    const drag = bodyDrag + (canopyDrag - bodyDrag) * opening ** 2;
    const power = powered ? thrust : 0;
    vx += (power * Math.sin(angle) - drag * airSpeed * airVx) / mass * dt;
    vy += ((power * Math.cos(angle) - drag * airSpeed * vy) / mass - gravity) * dt;
    const nextX = x + vx * dt;
    const nextY = y + vy * dt;
    if (nextY <= 0) {
      const fraction = y / (y - nextY);
      points.push({
        t: time - dt * (1 - fraction),
        x: x + (nextX - x) * fraction,
        y: 0,
        vx: priorVx + (vx - priorVx) * fraction,
        vy: priorVy + (vy - priorVy) * fraction,
        phase: 5,
      });
      break;
    }
    x = nextX;
    y = nextY;
    if (vy <= 0 && descentStart === Infinity) descentStart = time;
    const phase = powered ? 1 : time < descentStart ? 2 : parachute ? 3 : 4;
    const point = { t: time, x, y, vx, vy, phase };
    if (point.y > peak.y) peak = point;
    points.push(point);
  }
  return { points, peak, end: points.at(-1) };
}

const plot = byId('trayectoria');
const ctx = plot.getContext('2d');
const countdown = byId('cuenta');
const launch = byId('lanzar');
let flight;
let frame;
let timer;
let currentIndex = 0;
let currentPoint = startPoint;
let currentPhase = '';
let viewWidth = 20;
let viewHeight = 40;
const palette = ['#6884ae', '#f8bc65', '#8dbbff', '#96e3d7', '#f2a28d', '#c7d8f1'];

function sizeCanvas(canvas, context) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return [0, 0];
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return [width, height];
}

function gridStep(limit) {
  const estimate = limit / 5;
  const power = 10 ** Math.floor(Math.log10(estimate));
  return [1, 2, 2.5, 5, 10].find((step) => step * power >= estimate) * power;
}

function growView(limit, position, blend) {
  const required = position * 1.14;
  const target = Math.max(limit, position * 1.4);
  return Math.max(required, limit + (target - limit) * blend);
}

function drawRocket(context, x, y, angle, firing) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  if (firing) {
    context.fillStyle = '#f6bb61';
    context.beginPath();
    context.moveTo(-2.5, 5); context.lineTo(0, 15); context.lineTo(2.5, 5); context.fill();
  }
  context.fillStyle = '#e7effb';
  context.beginPath();
  context.moveTo(0, -12); context.quadraticCurveTo(5, -6, 4, 3);
  context.lineTo(7, 7); context.lineTo(0, 5); context.lineTo(-7, 7);
  context.lineTo(-4, 3); context.quadraticCurveTo(-5, -6, 0, -12); context.fill();
  context.fillStyle = '#263e64';
  context.fillRect(-3.5, -.5, 7, 2.5);
  context.restore();
}

function drawPlot() {
  if (!ctx) return;
  const [w, h] = sizeCanvas(plot, ctx);
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  const left = 45, top = 33, right = w - 23, bottom = h - 48;
  const px = (x) => left + x / viewWidth * (right - left);
  const py = (y) => bottom - y / viewHeight * (bottom - top);

  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = '#9fb1cf';
  ctx.textAlign = 'right';
  const yStep = gridStep(viewHeight);
  for (let i = 0; i <= Math.floor(viewHeight / yStep); i += 1) {
    const value = i * yStep;
    const y = py(value);
    ctx.strokeStyle = i ? '#223450' : '#587198';
    ctx.beginPath();
    ctx.moveTo(left, y); ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(String(value), left - 8, y + 4);
  }
  ctx.textAlign = 'center';
  const xStep = gridStep(viewWidth);
  for (let i = 0; i <= Math.floor(viewWidth / xStep); i += 1) {
    const value = i * xStep;
    const x = px(value);
    ctx.strokeStyle = i ? '#223450' : '#587198';
    ctx.beginPath();
    ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.fillText(String(value), x, bottom + 16);
  }
  ctx.textAlign = 'left';
  ctx.fillText('Altura (m)', left, 17);
  ctx.textAlign = 'center';
  ctx.fillText('Distancia horizontal (m)', (left + right) / 2, bottom + 35);

  const point = currentPoint;
  if (flight && point.t > 0) {
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    let lastPhase = -1;
    for (let index = 1; index <= currentIndex; index += 1) {
      const sample = flight.points[index];
      const phase = sample.phase === 5 ? flight.points[index - 1].phase : sample.phase;
      if (phase !== lastPhase) {
        if (lastPhase !== -1) ctx.stroke();
        ctx.beginPath();
        const prior = flight.points[index - 1];
        ctx.moveTo(px(prior.x), py(prior.y));
        ctx.strokeStyle = palette[phase];
        lastPhase = phase;
      }
      ctx.lineTo(px(sample.x), py(sample.y));
    }
    if (lastPhase === -1) {
      ctx.beginPath();
      ctx.moveTo(px(startPoint.x), py(startPoint.y));
      ctx.strokeStyle = palette[point.phase];
    }
    ctx.lineTo(px(point.x), py(point.y));
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  const x = px(point.x);
  const y = py(point.y);
  if (point.phase === 3) {
    ctx.strokeStyle = '#96e3d7';
    ctx.beginPath();
    ctx.arc(x, y - 12, 9, Math.PI, 0);
    ctx.lineTo(x, y - 2); ctx.lineTo(x - 9, y - 12);
    ctx.stroke();
    ctx.fillStyle = '#e7effb';
    ctx.fillRect(x - 2, y - 2, 4, 7);
  } else {
    const angle = point.phase === 4 ? Math.PI - Math.atan2(point.vx, -point.vy) : Math.atan2(point.vx, Math.max(.001, point.vy));
    drawRocket(ctx, x, y - (point.y === 0 ? 8 : 0), angle, point.phase === 1);
  }
}

function report(point, status = phases[point.phase]) {
  if (status !== currentPhase) {
    byId('fase').textContent = status;
    currentPhase = status;
  }
  byId('altura').textContent = number.format(point.y) + ' m';
  byId('distancia').textContent = number.format(point.x) + ' m';
  byId('velocidad').textContent = number.format(Math.hypot(point.vx, point.vy)) + ' m/s';
  byId('apogeo').textContent = flight && point.t >= flight.peak.t ? number.format(flight.peak.y) + ' m' : '—';
  byId('tiempo').textContent = number.format(point.t) + ' s';
}

function lockControls(locked) {
  for (const input of parameters) input.disabled = locked;
  launch.disabled = locked;
}

function reset() {
  cancelAnimationFrame(frame);
  clearTimeout(timer);
  flight = undefined;
  currentIndex = 0;
  currentPoint = startPoint;
  viewWidth = 20;
  viewHeight = 40;
  countdown.hidden = true;
  lockControls(false);
  report(startPoint);
  drawPlot();
}
byId('reiniciar').addEventListener('click', reset);
form.addEventListener('input', () => {
  const parachute = byId('paracaidas').checked;
  const legend = byId('descenso-leyenda');
  legend.textContent = parachute ? 'Con paracaídas' : 'Sin paracaídas';
  legend.classList.toggle('freefall', !parachute);
  if (flight && !launch.disabled) reset();
});

function playFlight() {
  countdown.hidden = true;
  const start = performance.now();
  const replaySpeed = Math.max(1, flight.end.t / 13);
  let lastFrame = start;
  function animate(now) {
    const elapsed = reduced.matches ? flight.end.t : (now - start) * replaySpeed / 1000;
    while (currentIndex < flight.points.length - 1 && flight.points[currentIndex + 1].t <= elapsed) currentIndex += 1;
    const point = flight.points[currentIndex];
    const next = flight.points[currentIndex + 1];
    currentPoint = point;
    if (next) {
      const fraction = (elapsed - point.t) / (next.t - point.t);
      currentPoint = { ...point, t: elapsed };
      for (const axis of ['x', 'y', 'vx', 'vy']) {
        currentPoint[axis] += (next[axis] - point[axis]) * fraction;
      }
    }
    const blend = reduced.matches ? 1 : 1 - Math.exp(-(now - lastFrame) / 170);
    lastFrame = now;
    const highest = elapsed >= flight.peak.t ? flight.peak.y : currentPoint.y;
    viewWidth = growView(viewWidth, currentPoint.x, blend);
    viewHeight = growView(viewHeight, highest, blend);
    report(currentPoint);
    drawPlot();
    if (currentIndex < flight.points.length - 1) {
      frame = requestAnimationFrame(animate);
    } else {
      lockControls(false);
    }
  }
  frame = requestAnimationFrame(animate);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (launch.disabled) return;
  if (!soundChoice && !soundOn) setSound(true);
  reset();
  flight = calculateFlight();
  lockControls(true);
  drawPlot();
  function step(remaining) {
    countdown.hidden = false;
    if (remaining > 0) {
      countdown.textContent = remaining;
      report(startPoint, 'Despegue en ' + remaining);
      tone(470 + (3 - remaining) * 100, 600 + (3 - remaining) * 100, .26, .105, 0, 'triangle');
      timer = setTimeout(() => step(remaining - 1), 1000);
      return;
    }
    countdown.textContent = '¡Despegue!';
    report(startPoint, '¡Despegue!');
    tone(240, 68, .55, .12, 0, 'triangle');
    tone(580, 1100, .45, .07, .03);
    timer = setTimeout(playFlight, 430);
  }
  step(3);
});
new ResizeObserver(drawPlot).observe(plot);
reset();

const sky = byId('cielo');
const skyCtx = sky.getContext('2d');
const stars = Array.from({ length: 160 }, (_, index) => {
  const bright = index % 13 === 0;
  return {
    x: Math.random(),
    y: Math.random(),
    size: bright ? 1.6 + Math.random() * .6 : .7 + Math.random() * .7,
    phase: Math.random() * Math.PI * 2,
    opacity: bright ? .68 : .24 + Math.random() * .28,
    color: index % 7 === 0 ? '#fff0ca' : '#d8e7ff',
  };
});
let sparks = [];
let lastSpark = 0;
let skyFrame;
let skyStart = 0;

document.addEventListener('pointermove', (event) => {
  const now = performance.now();
  if (reduced.matches || event.pointerType === 'touch' || now - lastSpark < 27) return;
  lastSpark = now;
  sparks.push({ x: event.clientX, y: event.clientY, time: now, dx: (Math.random() - .5) * 24 });
});

function renderSky(now) {
  if (!skyCtx) return;
  const [width, height] = sizeCanvas(sky, skyCtx);
  skyCtx.clearRect(0, 0, width, height);
  const time = (now - skyStart) / 1000;
  const staticSky = reduced.matches;
  for (const star of stars) {
    const x = star.x * width;
    const y = star.y * height;
    const twinkle = staticSky ? 0 : Math.sin(time * 1.15 + star.phase) * .10;
    skyCtx.fillStyle = star.color;
    if (star.size > 1.5) {
      skyCtx.globalAlpha = .10;
      skyCtx.beginPath();
      skyCtx.arc(x, y, star.size * 1.25, 0, Math.PI * 2);
      skyCtx.fill();
    }
    skyCtx.globalAlpha = star.opacity + twinkle;
    skyCtx.beginPath();
    skyCtx.arc(x, y, star.size / 2, 0, Math.PI * 2);
    skyCtx.fill();
  }
  skyCtx.globalAlpha = 1;
  if (staticSky) return;

  const meteorTime = time + 1.7;
  const meteor = meteorTime % 3.2;
  if (meteor < 1.35) {
    const lane = Math.floor(meteorTime / 3.2) % 3;
    const x = width * [.82, .62, .91][lane] - meteor * Math.min(240, width * .36);
    const y = height * [.13, .33, .22][lane] + meteor * 130;
    const trail = skyCtx.createLinearGradient(x, y, x + 100, y - 55);
    trail.addColorStop(0, '#e1ecffdf');
    trail.addColorStop(1, '#80aaf800');
    skyCtx.strokeStyle = trail;
    skyCtx.globalAlpha = Math.sin(meteor / 1.35 * Math.PI);
    skyCtx.beginPath();
    skyCtx.moveTo(x, y); skyCtx.lineTo(x + 100, y - 55); skyCtx.stroke();
  }

  const crossing = (time + 7.5) % 15;
  if (crossing < 3.4) {
    const cycle = Math.floor((time + 7.5) / 15);
    const side = cycle % 2 ? .87 : .56;
    skyCtx.globalAlpha = .66 * Math.sin(crossing / 3.4 * Math.PI);
    drawRocket(skyCtx, width * side + crossing * 45, height * .83 - crossing * height * .25, .38, true);
  }
  skyCtx.globalAlpha = 1;
  sparks = sparks.filter((spark) => now - spark.time < 350);
  for (const spark of sparks) {
    const age = (now - spark.time) / 350;
    skyCtx.fillStyle = 'rgba(246,187,97,' + (1 - age) * .64 + ')';
    skyCtx.beginPath();
    skyCtx.arc(spark.x + spark.dx * age, spark.y + 13 * age, Math.max(.2, 1.65 - age), 0, Math.PI * 2);
    skyCtx.fill();
  }
  skyFrame = requestAnimationFrame(renderSky);
}

function updateSky() {
  cancelAnimationFrame(skyFrame);
  sparks = [];
  if (document.hidden) return;
  skyStart = performance.now();
  if (reduced.matches) {
    renderSky(skyStart);
  } else {
    skyFrame = requestAnimationFrame(renderSky);
  }
}
reduced.addEventListener('change', updateSky);
document.addEventListener('visibilitychange', updateSky);
window.addEventListener('resize', () => {
  if (reduced.matches) renderSky(performance.now());
});
updateSky();

const parts = {
  ojiva: {
    name: 'Ojiva',
    category: 'AERODINÁMICA',
    description: 'Es la punta del cohete. Su perfil curvo ayuda a reducir la resistencia del aire durante el ascenso.',
  },
  sensor: {
    name: 'Sensor',
    category: 'MEDICIÓN',
    description: 'Viaja dentro del fuselaje. Un altímetro barométrico, por ejemplo, usa los cambios de presión para estimar la altura y localizar el apogeo.',
  },
  paracaidas: {
    name: 'Paracaídas',
    category: 'RECUPERACIÓN',
    description: 'Viaja plegado dentro del cuerpo. Al abrirse aumenta la resistencia del aire y frena el descenso antes del aterrizaje.',
  },
  fuselaje: {
    name: 'Fuselaje',
    category: 'ESTRUCTURA',
    description: 'Es el cuerpo del cohete. Une la punta con la base y aloja las piezas internas, como el sensor y el paracaídas.',
  },
  motor: {
    name: 'Motor',
    category: 'PROPULSIÓN',
    description: 'Se ubica en la base. Expulsa gases hacia abajo para impulsar el cohete durante los primeros instantes del vuelo.',
  },
  alerones: {
    name: 'Alerones',
    category: 'ESTABILIDAD',
    description: 'Se colocan cerca de la base. El aire que pasa alrededor de ellos ayuda a corregir pequeñas inclinaciones durante el ascenso.',
  },
};
const anatomy = byId('despiece');
const partButtons = [...anatomy.querySelectorAll('[data-part]')];
for (const button of partButtons) {
  button.addEventListener('click', () => {
    const selected = button.dataset.part;
    const part = parts[selected];
    for (const control of partButtons) {
      control.setAttribute('aria-pressed', String(control.dataset.part === selected));
    }
    byId('part-category').textContent = part.category;
    byId('part-name').textContent = part.name;
    byId('part-description').textContent = part.description;
  });
}

const viewButton = byId('anatomy-toggle');
viewButton.addEventListener('click', () => {
  const assembled = anatomy.dataset.assembled !== 'true';
  anatomy.dataset.assembled = String(assembled);
  viewButton.textContent = assembled ? 'Ver despiece' : 'Ver ensamblado';
  byId('anatomy-view').textContent = assembled ? 'VISTA ENSAMBLADA' : 'VISTA DESPIEZADA';
});

const windCanvas = byId('wind-canvas');
const windContext = windCanvas.getContext('2d');
const windSpeed = byId('wind-speed');
const windAngle = byId('wind-angle');
const airDensity = 1.225;
let windOffset = 0;
let lastWindFrame;
let windFrame;
let windVisible = false;

function renderWind() {
  if (!windContext) return;
  const [width, height] = sizeCanvas(windCanvas, windContext);
  if (!width || !height) return;
  const ctx = windContext;
  ctx.clearRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width / 420, height / 240, 1.35);
  const angle = Number(windAngle.value) * Math.PI / 180;

  ctx.strokeStyle = '#22344e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = width % 28 / 2; x < width; x += 28) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = height % 28 / 2; y < height; y += 28) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  for (let line = 0; line < 12; line += 1) {
    const offset = (line - 5.5) * 15;
    const streamY = (x) => {
      const localX = (x - centerX) / scale;
      const influence = Math.exp(-Math.pow((localX - 15) / 95, 4));
      const gap = Math.sign(offset) * 25 * Math.exp(-Math.abs(offset) / 37);
      return centerY + scale * (offset + influence * (gap + Math.tan(angle) * localX));
    };
    ctx.beginPath();
    ctx.moveTo(0, streamY(0));
    for (let x = 4; x <= width + 4; x += 4) ctx.lineTo(x, streamY(x));
    ctx.strokeStyle = '#719dc980';
    ctx.stroke();
    ctx.fillStyle = '#a1e3f5';
    for (let x = (windOffset + line * 23) % 108; x < width; x += 108) {
      ctx.beginPath();
      ctx.arc(x, streamY(x), 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const shell = ctx.createLinearGradient(0, -13, 0, 13);
  shell.addColorStop(0, '#e9f2ff');
  shell.addColorStop(1, '#7291bb');
  ctx.fillStyle = shell;
  ctx.strokeStyle = '#c9ddf7';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-99, 0);
  ctx.quadraticCurveTo(-74, -11, -54, -11);
  ctx.lineTo(48, -11);
  ctx.lineTo(72, -24);
  ctx.lineTo(89, -24);
  ctx.lineTo(78, -10);
  ctx.lineTo(88, -7);
  ctx.lineTo(88, 7);
  ctx.lineTo(78, 10);
  ctx.lineTo(89, 24);
  ctx.lineTo(72, 24);
  ctx.lineTo(48, 11);
  ctx.lineTo(-54, 11);
  ctx.quadraticCurveTo(-74, 11, -99, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#182e53';
  ctx.fillRect(-48, -11, 12, 22);
  ctx.fillStyle = '#eeb962';
  ctx.fillRect(-36, -11, 5, 22);
  ctx.restore();
}

function animateWind(now) {
  if (lastWindFrame !== undefined) {
    windOffset = (windOffset + Number(windSpeed.value) * Math.min(now - lastWindFrame, 50) * .0026) % 108;
  }
  lastWindFrame = now;
  renderWind();
  windFrame = requestAnimationFrame(animateWind);
}

function updateWindMotion() {
  cancelAnimationFrame(windFrame);
  lastWindFrame = undefined;
  if (windVisible && !reduced.matches && !document.hidden) windFrame = requestAnimationFrame(animateWind);
}

function updateWindControls() {
  const speed = Number(windSpeed.value);
  byId('wind-speed-value').value = speed + ' m/s';
  byId('wind-angle-value').value = windAngle.value + '°';
  byId('wind-pressure').value = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(.5 * airDensity * speed ** 2) + ' Pa';
  renderWind();
}

windSpeed.addEventListener('input', updateWindControls);
windAngle.addEventListener('input', updateWindControls);
new ResizeObserver(renderWind).observe(windCanvas);
new IntersectionObserver(([entry]) => {
  windVisible = entry.isIntersecting;
  updateWindMotion();
}).observe(windCanvas);
reduced.addEventListener('change', updateWindMotion);
document.addEventListener('visibilitychange', updateWindMotion);
updateWindControls();

byId('quick-launch').addEventListener('click', () => {
  byId('simulador').scrollIntoView({ block: 'start' });
  byId('reiniciar').focus({ preventScroll: true });
  if (!launch.disabled) form.requestSubmit(launch);
});
