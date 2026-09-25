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
      const a = scrollyAtom(id);
      const prev = a.get();
      if (prev.step !== step || Math.abs(prev.progress - progress) > 1e-3 || Math.abs(prev.total - total) > 1e-3)
        a.set({ step, progress, total });
    }
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();
}
