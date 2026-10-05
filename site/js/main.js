/* =========================================================
   BẢNG TRUY NÃ · Behavior layer
   Mọi nội dung đã có sẵn trong index.html. File này chỉ thêm hành vi:
   gió thổi, kéo giật poster, phóng to, lật hồ sơ mật, đèn dầu, đếm tiền truy nã.
   Mỗi tương tác đi theo chuỗi TRIGGER → STATE → OUTPUT (ghi chú ở từng phần).
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 0. Cấu hình ---------- */
  // Hệ số quy đổi tiền truy nã (Berry). Đổi ở đây là toàn trang tự tính lại.
  const BOUNTY_RATE = { loc: 10000, projects: 50000000, bugs: 1000000 };
  const TEAR_DISTANCE = 140; // kéo quá số px này thì poster rách khỏi đinh
  const DRAG_START = 8;      // dưới ngưỡng này vẫn tính là một cú bấm

  const noop = () => {};
  const sfx = window.SFX || { toggle: () => false, isOn: () => false, gust: noop, flap: noop, creak: noop, rip: noop, thud: noop };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fmt = new Intl.NumberFormat('vi-VN');

  const board = document.getElementById('wanted-board');
  const viewer = document.getElementById('viewer');
  const stage = viewer.querySelector('.viewer__stage');
  const countLabel = viewer.querySelector('.viewer__count');
  const soundBtn = document.querySelector('.sound-toggle');
  const lantern = board.querySelector('.lantern');

  // Poster thật sẽ được chuyển qua lại giữa tường và khung phóng to,
  // nên giữ sẵn tham chiếu tới từng phần của nó.
  const crew = Array.from(board.querySelectorAll('.poster')).map((poster, index) => {
    const paper = poster.querySelector('.poster__paper');
    return {
      index,
      poster,
      paper,
      sway: poster.querySelector('.poster__sway'),
      scrap: poster.querySelector('.poster__scrap'),
      front: paper.querySelector('.poster__face--front'),
      back: paper.querySelector('.poster__face--back'),
      title: paper.querySelector('.dossier__title'),
      openBtn: paper.querySelector('.poster__open'),
      doaBtn: paper.querySelector('.poster__doa'),
      backBtn: paper.querySelector('.dossier__back'),
      bountyEl: paper.querySelector('.poster__bounty [data-fill="bounty"]'),
      name: paper.querySelector('.poster__open').textContent.replace('Phóng to lệnh truy nã:', '').replace(/\s+/g, ' ').trim(),
      nail: poster.classList.contains('poster--nail-left') ? 'left'
        : poster.classList.contains('poster--nail-right') ? 'right' : 'both',
      bounty: 0,
      justDragged: false
    };
  });

  let active = null; // thành viên đang nằm trong khung phóng to
  let busy = false;  // đang chạy animation đóng khung

  /* ---------- 1. Tiền truy nã: tính từ data-loc / data-projects / data-bugs ---------- */
  function setNumber(el, value) {
    const text = fmt.format(value);
    if (el.textContent.trim() !== text) {
      console.warn(`[Bảng truy nã] Số "${el.textContent.trim()}" trong HTML không khớp công thức, đã sửa thành ${text}.`);
    }
    el.textContent = text;
    if (el instanceof HTMLDataElement) el.value = value;
  }

  function applyBounties() {
    document.querySelectorAll('[data-rate]').forEach((el) => setNumber(el, BOUNTY_RATE[el.dataset.rate]));

    let total = 0;
    crew.forEach((m) => {
      const d = m.paper.dataset;
      const values = { loc: Number(d.loc), projects: Number(d.projects), bugs: Number(d.bugs) };
      values['loc-berry'] = values.loc * BOUNTY_RATE.loc;
      values['projects-berry'] = values.projects * BOUNTY_RATE.projects;
      values['bugs-berry'] = values.bugs * BOUNTY_RATE.bugs;
      values.bounty = values['loc-berry'] + values['projects-berry'] + values['bugs-berry'];
      m.bounty = values.bounty;
      total += values.bounty;

      const row = document.querySelector(`#bounty-ledger tr[data-member="${m.poster.dataset.member}"]`);
      [m.paper, row].forEach((scope) => {
        if (!scope) return;
        scope.querySelectorAll('[data-fill]').forEach((el) => {
          if (el.dataset.fill in values) setNumber(el, values[el.dataset.fill]);
        });
      });
    });

    document.querySelectorAll('[data-fill="total"]').forEach((el) => setNumber(el, total));
    return total;
  }

  const counting = new WeakMap();
  function countUp(el, target, duration) {
    cancelAnimationFrame(counting.get(el));
    if (reduceMotion.matches) {
      el.textContent = fmt.format(target);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / (duration || 1400), 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt.format(Math.round(target * eased));
      if (p < 1) counting.set(el, requestAnimationFrame(tick));
    };
    counting.set(el, requestAnimationFrame(tick));
  }

  /* ---------- 2. Viền giấy rách: clip-path sinh ngẫu nhiên nhưng cố định theo seed ---------- */
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildEdges(rand) {
    const N = 24;
    const jitter = () => rand() * 1.1;
    const top = [], right = [], bottom = [], left = [];
    for (let i = 0; i <= N; i++) top.push([(i / N) * 100, jitter()]);
    for (let i = 1; i <= N; i++) right.push([100 - jitter(), (i / N) * 100]);
    for (let i = 1; i <= N; i++) bottom.push([100 - (i / N) * 100, 100 - jitter()]);
    for (let i = 1; i < N; i++) left.push([jitter(), 100 - (i / N) * 100]);

    // Sờn góc: kéo 4 điểm góc vào trong
    const chip = () => 1 + rand() * 2.6;
    top[0] = [chip(), chip()];
    top[N] = [100 - chip(), chip()];
    right[N - 1] = [100 - chip(), 100 - chip()];
    bottom[N - 1] = [chip(), 100 - chip()];

    // Vài vết khuyết nhỏ dọc mép giấy
    const bite = (edge, dx, dy) => {
      const k = 2 + Math.floor(rand() * (edge.length - 4));
      const depth = 2 + rand() * 2.5;
      edge[k] = [edge[k][0] + dx * depth, edge[k][1] + dy * depth];
    };
    if (rand() < 0.7) bite(right, -1, 0);
    if (rand() < 0.7) bite(bottom, 0, -1);
    if (rand() < 0.7) bite(left, 1, 0);

    return { top, right, bottom, left };
  }

  function jagLine(rand, a, b, steps) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const offset = i === 0 || i === steps ? 0 : (i % 2 ? 1 : -1) * (0.4 + rand() * 1.6);
      points.push([a[0] + dx * t + nx * offset, a[1] + dy * t + ny * offset]);
    }
    return points;
  }

  // Đường xé: phần trên đường ở lại dưới đinh (scrap), phần dưới là poster bị giật ra
  function tearShapes(rand, edges, nail) {
    const { top, right, bottom, left } = edges;
    if (nail === 'left') {
      const line = jagLine(rand, [0, 13], [30, 0], 10);
      return {
        paper: [...line, ...top.filter((p) => p[0] > 30), ...right, ...bottom, ...left.filter((p) => p[1] > 13)],
        scrap: [[0, 0], ...line.slice().reverse()]
      };
    }
    if (nail === 'right') {
      const line = jagLine(rand, [70, 0], [100, 13], 10);
      return {
        paper: [...top.filter((p) => p[0] < 70), ...line, ...right.filter((p) => p[1] > 13), ...bottom, ...left],
        scrap: [...line, [100, 0]]
      };
    }
    const y1 = 6 + rand() * 2.5;
    const y2 = 6 + rand() * 2.5;
    const line = jagLine(rand, [0, y1], [100, y2], 22);
    return {
      paper: [...line, ...right.filter((p) => p[1] > y2), ...bottom, ...left.filter((p) => p[1] > y1)],
      scrap: [[0, 0], [100, 0], ...line.slice().reverse()]
    };
  }

  const polygon = (points) =>
    `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;

  crew.forEach((m) => {
    const rand = seeded(1608 + m.index * 97);
    const edges = buildEdges(rand);
    m.tearShape = tearShapes(rand, edges, m.nail);
    m.paper.style.setProperty('--torn', polygon([...edges.top, ...edges.right, ...edges.bottom, ...edges.left]));
  });

  /* ---------- 3. Gió thổi ----------
     TRIGGER: hẹn giờ ngẫu nhiên 3,5–9 giây
     STATE:   cường độ gió + hướng gió
     OUTPUT:  class .is-gusting chạy keyframes "gust" lần lượt từng poster + tiếng giấy đập */
  let gustTimer = 0;

  function panOf(el) {
    const r = el.getBoundingClientRect();
    return ((r.left + r.width / 2) / window.innerWidth) * 2 - 1;
  }

  function scheduleGust(delay) {
    clearTimeout(gustTimer);
    if (reduceMotion.matches) return;
    gustTimer = setTimeout(gust, delay !== undefined ? delay : 3500 + Math.random() * 5500);
  }

  function gust() {
    if (document.hidden || active) return scheduleGust();
    const strength = 0.55 + Math.random() * 0.45;
    const order = Math.random() < 0.5 ? crew : crew.slice().reverse();
    sfx.gust(strength);
    order.forEach((m, i) => {
      setTimeout(() => {
        if (m.poster.classList.contains('is-out') || m.poster.classList.contains('is-dragging')) return;
        m.sway.style.setProperty('--gust-strength', strength.toFixed(2));
        m.sway.classList.remove('is-gusting');
        void m.sway.offsetWidth; // ép trình duyệt chạy lại animation từ đầu
        m.sway.classList.add('is-gusting');
        sfx.flap(strength, panOf(m.poster));
      }, i * 140);
    });
    if (Math.random() < 0.45) setTimeout(() => sfx.creak(0.5), 450);
    scheduleGust();
  }

  crew.forEach((m) => {
    m.sway.addEventListener('animationend', (event) => {
      if (event.animationName !== 'gust') return;
      // Keyframe cuối của "gust" khớp với điểm bắt đầu của "sway" nên chỉ cần bỏ delay âm
      m.sway.style.setProperty('--sway-delay', '0s');
      m.sway.classList.remove('is-gusting');
    });
  });

  /* ---------- 4. Kéo giật poster (tear off) ----------
     TRIGGER: pointerdown + pointermove trên poster (chuột hoặc cảm ứng), hoặc phím T
     STATE:   khoảng kéo so với TEAR_DISTANCE, class .is-dragging / .is-torn
     OUTPUT:  poster lệch theo tay; quá ngưỡng thì xé, mẩu giấy ở lại dưới đinh, poster bay vào giữa */
  crew.forEach((m) => {
    let start = null;
    let dragging = false;
    let strained = false;

    m.paper.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || active || busy) return;
      if (event.target.closest('.poster__doa')) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragging = false;
      strained = false;
    });

    m.paper.addEventListener('pointermove', (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const distance = Math.hypot(dx, dy);

      if (!dragging) {
        if (distance < DRAG_START) return;
        dragging = true;
        m.paper.setPointerCapture(event.pointerId);
        m.poster.classList.add('is-dragging');
        m.sway.classList.remove('is-gusting');
      }

      const rotation = Math.max(-14, Math.min(14, dx * 0.08));
      m.sway.style.translate = `${dx * 0.55}px ${dy * 0.55}px`;
      m.sway.style.rotate = `${rotation}deg`;

      if (!strained && distance > TEAR_DISTANCE * 0.55) {
        strained = true;
        sfx.creak(0.7);
      }
      if (distance >= TEAR_DISTANCE) {
        start = null;
        tear(m, rotation);
      }
    });

    const release = (event) => {
      if (!start || event.pointerId !== start.id) return;
      start = null;
      if (!dragging) return;
      // Chưa đủ lực: poster bật về chỗ cũ (transition có overshoot trong CSS)
      m.justDragged = true;
      setTimeout(() => { m.justDragged = false; }, 0);
      m.poster.classList.remove('is-dragging');
      m.sway.style.translate = '';
      m.sway.style.rotate = '';
      sfx.flap(0.45, panOf(m.poster));
    };
    m.paper.addEventListener('pointerup', release);
    m.paper.addEventListener('pointercancel', release);

    m.openBtn.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() !== 't' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (active || busy) return;
      event.preventDefault();
      tear(m, 0);
    });
  });

  function tear(m, rotation) {
    if (!m.poster.classList.contains('is-torn')) {
      m.poster.classList.add('is-torn');
      m.paper.style.setProperty('--torn', polygon(m.tearShape.paper));
      m.scrap.style.setProperty('--scrap', polygon(m.tearShape.scrap));
      sfx.rip(panOf(m.poster));
    } else {
      sfx.flap(0.9, panOf(m.poster));
    }
    openViewer(m, { spin: rotation + 8 });
  }

  /* ---------- 5. Phóng to (focus zoom) + lật hồ sơ ----------
     TRIGGER: bấm / Enter trên poster, bấm DEAD OR ALIVE, ← →, Esc
     STATE:   active (ai đang được xem), .is-flipped, aria-expanded, inert
     OUTPUT:  poster thật bay từ tường vào <dialog> (kỹ thuật FLIP), lật 3D sang hồ sơ mật */
  function setFlipped(m, flipped, options) {
    const opts = Object.assign({ focus: true, sound: true }, options);
    m.paper.classList.toggle('is-flipped', flipped);
    m.front.inert = flipped;
    m.back.inert = !flipped;
    m.doaBtn.setAttribute('aria-expanded', String(flipped));
    if (flipped) m.back.scrollTop = 0;
    if (opts.sound) sfx.flap(0.5);
    if (opts.focus) (flipped ? m.title : m.doaBtn).focus({ preventScroll: true });
  }

  function setInViewer(m, inViewer) {
    m.poster.classList.toggle('is-out', inViewer);
    m.openBtn.tabIndex = inViewer ? -1 : 0;
  }

  function updateCount() {
    countLabel.textContent = `${active.index + 1} / ${crew.length} · ${active.name}`;
  }

  function centerOf(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function openViewer(m, options) {
    if (active || busy) return;
    const opts = Object.assign({ flip: false, spin: 0 }, options);

    // F(irst): ghi lại vị trí và kích thước poster trên tường
    const fromCenter = centerOf(m.paper.getBoundingClientRect());
    const fromWidth = m.paper.offsetWidth;
    const tilt = parseFloat(getComputedStyle(m.poster).rotate) || 0;

    // L(ast): chuyển poster thật vào khung phóng to
    stage.append(m.paper);
    m.poster.classList.remove('is-dragging');
    m.sway.style.translate = '';
    m.sway.style.rotate = '';
    setInViewer(m, true);
    active = m;
    updateCount();
    viewer.showModal();
    sfx.flap(0.7, 0);
    countUp(m.bountyEl, m.bounty);

    const finish = () => {
      if (opts.flip) setFlipped(m, true);
      else m.doaBtn.focus({ preventScroll: true });
    };
    m.doaBtn.focus({ preventScroll: true });
    if (reduceMotion.matches) return finish();

    // I(nvert) + P(lay): đặt poster về chỗ cũ bằng transform rồi cho nó bay về vị trí mới
    const toCenter = centerOf(m.paper.getBoundingClientRect());
    const scale = fromWidth / m.paper.offsetWidth;
    const dx = fromCenter.x - toCenter.x;
    const dy = fromCenter.y - toCenter.y;
    const animation = m.paper.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${tilt + opts.spin}deg)` },
      { transform: `translate(0px, 0px) scale(1) rotate(${opts.spin ? -2 : 0}deg)`, offset: 0.75 },
      { transform: 'translate(0px, 0px) scale(1) rotate(0deg)' }
    ], { duration: 700, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    animation.onfinish = finish;
  }

  function returnToWall(m) {
    m.sway.append(m.paper);
    setInViewer(m, false);
  }

  function closeViewer() {
    if (!active || busy) return;
    busy = true;
    const m = active;
    const wasFlipped = m.paper.classList.contains('is-flipped');
    m.paper.classList.add('no-transition');
    setFlipped(m, false, { focus: false, sound: false });
    viewer.classList.add('is-closing');

    const finish = () => {
      returnToWall(m);
      viewer.classList.remove('is-closing');
      active = null;
      if (viewer.open) viewer.close();
      requestAnimationFrame(() => m.paper.classList.remove('no-transition'));
      busy = false;
      sfx.thud();
      m.openBtn.focus();
    };
    if (reduceMotion.matches) return finish();

    const from = centerOf(m.paper.getBoundingClientRect());
    const to = centerOf(m.sway.getBoundingClientRect());
    const scale = m.sway.offsetWidth / m.paper.offsetWidth;
    const tilt = parseFloat(getComputedStyle(m.poster).rotate) || 0;
    const animation = m.paper.animate([
      { transform: `translate(0px, 0px) scale(1) rotate(0deg) rotateY(${wasFlipped ? 180 : 0}deg)` },
      { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(${scale}) rotate(${tilt}deg) rotateY(0deg)` }
    ], { duration: 560, easing: 'cubic-bezier(.5, 0, .25, 1)', fill: 'forwards' });
    animation.onfinish = () => {
      finish();
      animation.cancel();
    };
  }

  function swap(step) {
    if (!active || busy) return;
    const old = active;
    const next = crew[(old.index + step + crew.length) % crew.length];

    old.paper.classList.add('no-transition');
    setFlipped(old, false, { focus: false, sound: false });
    returnToWall(old);
    requestAnimationFrame(() => old.paper.classList.remove('no-transition'));

    stage.append(next.paper);
    setInViewer(next, true);
    active = next;
    updateCount();
    next.doaBtn.focus({ preventScroll: true });
    countUp(next.bountyEl, next.bounty);
    sfx.flap(0.6, step * 0.5);

    if (!reduceMotion.matches) {
      next.paper.animate([
        { transform: `translateX(${step * 90}px) rotate(${step * 6}deg)` },
        { transform: 'translateX(0) rotate(0deg)' }
      ], { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    }
  }

  crew.forEach((m) => {
    m.back.inert = true;

    m.openBtn.addEventListener('click', () => {
      if (m.justDragged) return;
      openViewer(m);
    });

    m.doaBtn.addEventListener('click', () => {
      if (active === m) setFlipped(m, !m.paper.classList.contains('is-flipped'));
      else openViewer(m, { flip: true });
    });

    m.backBtn.addEventListener('click', () => setFlipped(m, false));
  });

  viewer.addEventListener('cancel', (event) => {
    // Esc: chặn đóng ngay để kịp chạy animation dán poster lại lên tường
    event.preventDefault();
    closeViewer();
  });

  viewer.addEventListener('close', () => {
    // Phòng trường hợp trình duyệt vẫn đóng dialog mà không qua closeViewer()
    if (!active) return;
    const m = active;
    setFlipped(m, false, { focus: false, sound: false });
    returnToWall(m);
    active = null;
    busy = false;
    viewer.classList.remove('is-closing');
  });

  viewer.addEventListener('click', (event) => {
    if (event.target === viewer || event.target === stage) closeViewer();
  });

  viewer.querySelector('.viewer__close').addEventListener('click', closeViewer);
  viewer.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => swap(Number(btn.dataset.step)));
  });

  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); swap(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); swap(-1); }
  });

  // Vuốt ngang trên màn hình cảm ứng để đổi thành viên
  let swipe = null;
  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') swipe = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) swap(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { swipe = null; });

  /* ---------- 6. Đèn dầu theo con trỏ ----------
     TRIGGER: pointermove trên tường, hoặc focus vào một poster bằng bàn phím
     STATE:   toạ độ --lx / --ly
     OUTPUT:  quầng sáng radial-gradient di chuyển, phần còn lại chìm trong bóng tối */
  let lightFrame = 0;
  let lightPos = null;
  function moveLight(x, y) {
    lightPos = [x, y];
    if (lightFrame) return;
    lightFrame = requestAnimationFrame(() => {
      lightFrame = 0;
      lantern.style.setProperty('--lx', `${lightPos[0]}px`);
      lantern.style.setProperty('--ly', `${lightPos[1]}px`);
    });
  }
  board.addEventListener('pointermove', (event) => {
    const r = board.getBoundingClientRect();
    moveLight(event.clientX - r.left, event.clientY - r.top);
  });
  board.addEventListener('focusin', (event) => {
    const poster = event.target.closest('.poster');
    if (!poster) return;
    const r = board.getBoundingClientRect();
    const c = centerOf(poster.getBoundingClientRect());
    moveLight(c.x - r.left, c.y - r.top);
  });

  /* ---------- 7. Nút âm thanh ----------
     TRIGGER: bấm nút   STATE: aria-pressed   OUTPUT: bật/tắt AudioContext + nhãn nút */
  soundBtn.addEventListener('click', () => {
    const on = sfx.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('.sound-toggle__label').textContent = on ? 'Âm thanh: bật' : 'Âm thanh: tắt';
    if (!on) return;
    if (reduceMotion.matches) setTimeout(() => sfx.creak(0.6), 200);
    else scheduleGust(200);
  });

  /* ---------- 8. Khởi động ---------- */
  // Có JS thì mới bật các nút (bản không JS giữ nguyên disabled để không gây hiểu nhầm)
  board.querySelectorAll('button[disabled]').forEach((btn) => { btn.disabled = false; });

  const crewTotal = applyBounties();
  const headerTotal = document.querySelector('.site-header [data-fill="total"]');
  countUp(headerTotal, crewTotal, 2000);

  const ledgerTotal = document.querySelector('#bounty-ledger [data-fill="total"]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      countUp(ledgerTotal, crewTotal, 1600);
      observer.disconnect();
    }, { threshold: 0.6 });
    observer.observe(ledgerTotal);
  }

  scheduleGust(1200);
  reduceMotion.addEventListener('change', () => scheduleGust());
})();
