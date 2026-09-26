import { scrollyAtom } from './store';

/**
 * Drives every [data-scrolly] section on the page. The reading line sits at
 * 45% of the viewport height on wide screens and just below the sticky figure
 * on narrow ones (see --scrolly-line in scrolly.css).
 */
export function initScrolly(): void {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-scrolly]'));
  if (!sections.length) return;

  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target as HTMLElement);
      else visible.delete(e.target as HTMLElement);
    }
    schedule();
  });
  sections.forEach((s) => io.observe(s));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Figures follow a smoothed position (step + progress within it), so wheel
  // notches and trackpad jitter turn into a continuous glide. Text highlighting
  // below stays on the raw position.
  interface Track {
    target: { pos: number; total: number };
    current: { pos: number; total: number };
  }
  const tracks = new Map<string, Track>();
  let animating = false;
  let lastT = 0;

  function publish(id: string, pos: number, total: number) {
    const step = Math.floor(pos + 1e-6);
    const progress = step < 0 ? 0 : Math.min(1, Math.max(0, pos - step));
    const a = scrollyAtom(id);
    const prev = a.get();
    if (prev.step !== step || Math.abs(prev.progress - progress) > 1e-4 || Math.abs(prev.total - total) > 1e-4)
      a.set({ step, progress, total });
  }

  function animate(now: number) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    const k = 1 - Math.exp(-dt * 11);
    let moving = false;
    for (const [id, t] of tracks) {
      const dp = t.target.pos - t.current.pos;
      const dtot = t.target.total - t.current.total;
      if (Math.abs(dp) < 5e-4 && Math.abs(dtot) < 5e-4) {
        t.current = { ...t.target };
      } else {
        t.current.pos += dp * k;
        t.current.total += dtot * k;
        moving = true;
      }
      publish(id, t.current.pos, t.current.total);
    }
    if (moving) requestAnimationFrame(animate);
    else animating = false;
  }

  function follow(id: string, pos: number, total: number) {
    let t = tracks.get(id);
    if (!t || reduced) {
      // First reading (or reduced motion): no glide, just be there.
      t = { target: { pos, total }, current: { pos, total } };
      tracks.set(id, t);
      publish(id, pos, total);
      return;
    }
    t.target = { pos, total };
    if (!animating) {
      animating = true;
      lastT = performance.now();
      requestAnimationFrame(animate);
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  function readingLine(section: HTMLElement): number {
    const v = getComputedStyle(section).getPropertyValue('--scrolly-line').trim();
    const frac = v.endsWith('%') ? parseFloat(v) / 100 : 0.45;
    return window.innerHeight * frac;
  }

  function update() {
    queued = false;
    for (const section of visible) {
      const id = section.dataset.scrolly!;
      const steps = Array.from(section.querySelectorAll<HTMLElement>(':scope [data-step]'));
      const line = readingLine(section);
      let step = -1;
      let progress = 0;
      steps.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.top <= line) {
          step = i;
          progress = Math.min(1, Math.max(0, (line - r.top) / Math.max(r.height, 1)));
        }
      });
      steps.forEach((el, i) => el.classList.toggle('is-active', i === step));
      const sr = section.getBoundingClientRect();
      const total = Math.min(1, Math.max(0, (line - sr.top) / Math.max(sr.height, 1)));
      follow(id, step < 0 ? -1 : step + Math.min(progress, 0.9999), total);
    }
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();
}
