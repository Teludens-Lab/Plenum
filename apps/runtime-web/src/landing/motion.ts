// Scroll choreography from the approved v12 reference, owned by the mounted landing.
export function mountLandingMotion(root: HTMLElement) {
  /* ---------- Shared state ---------- */
  let ORDER = ['design', 'deliver', 'audit'];
  /* Camera stops for each ring: scale, and the point the camera centres on (% of the drawing) */
  let STOPS = [
    { scale: 2.35, ox: 46.5, oy: 61 },
    { scale: 1.45, ox: 49, oy: 57 },
    { scale: 1, ox: 49, oy: 56.5 }
  ];
  /* Share of each third of the scroll spent holding still at a ring before moving on */
  let HOLD = 0.5;
  /* Scroll progress at which the room starts to fade out */
  let EXIT_START = 0.88;
  let header = root.querySelector<HTMLElement>('.site-header')!;
  let room = root.querySelector<HTMLElement>('.room')!;
  let stage = root.querySelector<HTMLElement>('.room__stage')!;
  let sticky = root.querySelector<HTMLElement>('.room__sticky')!;
  let frame = root.querySelector<HTMLElement>('.room__frame')!;
  let peek = root.querySelector<HTMLElement>('.peek')!;
  let cue = root.querySelector<HTMLElement>('.hero__cue')!;
  let meterFill = root.querySelector<HTMLElement>('.room__meter-fill')!;
  let ticks = Array.from(root.querySelectorAll<HTMLElement>('.room__tick'));
  let steps = Array.from(root.querySelectorAll<HTMLElement>('.step'));
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stacked = window.matchMedia('(max-width: 900px)');

  function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- Room: from the table out to the gallery ---------- */
  let currentRing: string | null = 'design';
  let ticking = false;
  let animationFrame = 0;
  let observer: IntersectionObserver | undefined;

  function setRoomRing(ring: string) {
    if (ring === currentRing) { return; }
    currentRing = ring;
    stage.setAttribute('data-ring', ring);
    steps.forEach(function (step) {
      step.classList.toggle('is-active', step.getAttribute('data-ring') === ring);
    });
  }

  /* Maps scroll progress (0-1) to a camera position (0-2): hold at a ring, then move to the next */
  function cameraPosition(progress: number) {
    let segment = Math.min(ORDER.length - 1, Math.floor(progress * ORDER.length));
    if (segment >= ORDER.length - 1) { return ORDER.length - 1; }
    let local = progress * ORDER.length - segment;
    if (local < HOLD) { return segment; }
    return segment + easeInOut((local - HOLD) / (1 - HOLD));
  }

  /* ---------- Bridge: carries the table from the hero into the room ---------- */
  function updateBridge(roomRect: DOMRect, headerH: number) {
    let vh = window.innerHeight;
    let span = vh - headerH;
    let bridge = clamp(1 - (roomRect.top - headerH) / span, 0, 1);

    cue.style.opacity = String(1 - clamp(bridge / 0.25, 0, 1));

    if (reduceMotion.matches) {
      peek.style.visibility = 'hidden';
      stage.style.opacity = '';
      return;
    }

    let w = frame.offsetWidth;
    let fh = frame.offsetHeight;
    let ox = 0.465 * w;
    let oy = 0.61 * fh;
    let stageRect = stage.getBoundingClientRect();

    /* Where the table sits once the room is pinned in place */
    let endX = stageRect.left + (stageRect.width - w) / 2 + ox;
    let endY = stageRect.top + (stageRect.height - fh) / 2 + oy - (roomRect.top - headerH);
    /* Where it starts: centred, just rising over the bottom edge of the hero */
    let startX = window.innerWidth / 2;
    let startY = vh - 0.07 * fh;

    let t = easeInOut(bridge);
    let x = lerp(startX, endX, t);
    let y = lerp(startY, endY, t);
    let scale = lerp(1, STOPS[0]!.scale, t);
    let handover = clamp((bridge - 0.96) / 0.04, 0, 1);

    peek.style.width = w + 'px';
    peek.style.transform = 'translate(' + (x - ox).toFixed(1) + 'px,' + (y - oy).toFixed(1) + 'px) scale(' + scale.toFixed(4) + ')';
    peek.style.setProperty('--outside', (0.14 * t).toFixed(3));
    peek.style.opacity = String(1 - handover);
    peek.style.visibility = handover >= 1 ? 'hidden' : 'visible';
    stage.style.opacity = String(handover);
  }

  function updateRoom() {
    ticking = false;

    if (stacked.matches) {
      frame.style.transform = '';
      frame.style.transformOrigin = '';
      stage.style.opacity = '';
      sticky.style.opacity = '';
      stage.removeAttribute('data-ring');
      peek.style.visibility = 'hidden';
      cue.style.opacity = '';
      currentRing = null;
      return;
    }

    let headerH = header.offsetHeight;
    let rect = room.getBoundingClientRect();

    updateBridge(rect, headerH);

    let travel = rect.height - (window.innerHeight - headerH);
    let progress = travel > 0 ? clamp((headerH - rect.top) / travel, 0, 1) : 0;
    let camera = cameraPosition(progress);

    /* The text changes as the camera settles on the next ring */
    setRoomRing(ORDER[Math.min(ORDER.length - 1, Math.floor(camera + 0.25))]!);

    /* The room fades out over the last stretch, so it is gone before it unpins and the closing arrives */
    sticky.style.opacity = String(1 - clamp((progress - EXIT_START) / (1 - EXIT_START), 0, 1));

    meterFill.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
    ticks.forEach(function (tick, i) {
      tick.classList.toggle('is-reached', progress >= i / ORDER.length - 0.001);
    });

    if (reduceMotion.matches) {
      frame.style.transform = '';
      frame.style.transformOrigin = '';
      return;
    }

    let from = STOPS[Math.floor(camera)]!;
    let to = STOPS[Math.ceil(camera)]!;
    let mix = camera - Math.floor(camera);
    frame.style.transformOrigin = lerp(from.ox, to.ox, mix).toFixed(2) + '% ' + lerp(from.oy, to.oy, mix).toFixed(2) + '%';
    frame.style.transform = 'scale(' + lerp(from.scale, to.scale, mix).toFixed(4) + ')';
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      animationFrame = window.requestAnimationFrame(updateRoom);
    }
  }

  /* ---------- Header: the small wordmark appears once the large one has scrolled away ---------- */
  let heroMark = root.querySelector<HTMLElement>('.hero__wordmark')!;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      header.classList.toggle('is-past-hero', !entries[0]!.isIntersecting);
    }, { rootMargin: '-' + header.offsetHeight + 'px 0px 0px 0px' });
    observer.observe(heroMark);
  } else {
    header.classList.add('is-past-hero');
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  if (stacked.addEventListener) {
    stacked.addEventListener('change', requestUpdate);
    reduceMotion.addEventListener('change', requestUpdate);
  }
  updateRoom();

  return () => {
    window.cancelAnimationFrame(animationFrame);
    observer?.disconnect();
    window.removeEventListener("scroll", requestUpdate);
    window.removeEventListener("resize", requestUpdate);
    stacked.removeEventListener("change", requestUpdate);
    reduceMotion.removeEventListener("change", requestUpdate);
  };
}
