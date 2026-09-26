/**
 * Dev-only style comparison: the same passage, figure and controls in the
 * shipped style and three proposals. Switch at the top; nothing here ships.
 */
import katex from 'katex';
import { useEffect, useState } from 'react';
import DemoTesseract, { type Variant } from './DemoTesseract';
import './styles-lab.css';

const VARIANTS: { id: Variant; name: string; note: string }[] = [
  { id: 'now', name: '现状', note: 'Libre Caslon + 思源宋体，直角细框，菱形滑块，拖动无惯性。' },
  {
    id: 'a',
    name: 'A 柔和书页',
    note: '霞鹜文楷正文 + Newsreader，标题减重，浅底无框的插图，圆形滑块，拖动带惯性，切换有缓动。',
  },
  { id: 'b', name: 'B 现代编辑', note: 'Figtree + 思源黑体，更大的圆角卡片插图，胶囊控件，留白更紧凑。' },
  { id: 'c', name: 'C 手绘笔记', note: '全书霞鹜文楷，方格纸底，手绘抖动的墨线，波浪下划线标题，手画边框的控件。' },
];

const tex = (s: string) => katex.renderToString(s, { throwOnError: false });

function readInitial(): Variant {
  try {
    const v = new URLSearchParams(location.search).get('v');
    if (v === 'now' || v === 'a' || v === 'b' || v === 'c') return v;
  } catch {
    /* ignore */
  }
  return 'a';
}

export default function StyleCompare() {
  const [v, setV] = useState<Variant>('a');
  useEffect(() => setV(readInitial()), []);
  useEffect(() => {
    const u = new URL(location.href);
    u.searchParams.set('v', v);
    history.replaceState(null, '', u);
    document.documentElement.dataset.sv = v;
  }, [v]);

  // Arrow keys switch variants for quick A/B looks.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [role="application"]')) return;
      const i = VARIANTS.findIndex((x) => x.id === v);
      if (e.key === 'ArrowRight') setV(VARIANTS[(i + 1) % VARIANTS.length]!.id);
      if (e.key === 'ArrowLeft') setV(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length]!.id);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [v]);

  const current = VARIANTS.find((x) => x.id === v)!;

  return (
    <div className="sv" data-v={v}>
      <nav className="sv-switch" aria-label="风格对比">
        <div className="sv-switch__tabs" role="tablist">
          {VARIANTS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === v} onClick={() => setV(x.id)}>
              {x.name}
            </button>
          ))}
        </div>
        <p className="sv-switch__note">{current.note}</p>
      </nav>

      <article className="sv-page" lang="zh-CN">
        <header className="sv-head">
          <p className="sv-num">第 4 章</p>
          <h1 className="sv-title">影子</h1>
          <p className="sv-sub">从墙上的立方体，到落进我们空间里的超立方体</p>
        </header>

        <p>
          一盏灯，一个铁丝弯成的立方体，一面墙。墙上的影子是平的，可它把整个立方体都交到了你手上，代价是会变形：离灯远的那一面显得小，转过去的那一面显得歪。
        </p>
        <p>
          往上走一维。想象一盏灯放在第四个方向 <span className="axis-3">w</span> 上，超立方体挡在灯和我们之间，影子就落进我们的三维空间。影子里的每一条棱，颜色都告诉你它原本沿着哪个方向：
          <span className="axis-0">x</span>、<span className="axis-1">y</span>、<span className="axis-2">z</span>、
          <span className="axis-3">w</span>。透视的缩放比例是{' '}
          <span dangerouslySetInnerHTML={{ __html: tex('\\tfrac{d}{d-w}') }} />。
        </p>

        <aside className="sv-square">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" />
          </svg>
          <p>小的那个不是小，是远。我花了好些年才学会这样看。</p>
        </aside>

        <figure className="sv-plate">
          <DemoTesseract key={v} variant={v} />
          <figcaption>
            <span className="sv-plate__n">图 2</span>
            超立方体投进三维空间的影子。拖动它转一转，松手后留意它怎么停下来。
          </figcaption>
        </figure>

        <p lang="en">
          The six squashed pyramids between the two cubes are cubes too, just as the trapezoids on the wall were really
          square faces. Eight cells, all present: the <span className="axis-3">w</span> edges join each corner of the small
          cube to its partner outside.
        </p>

        <details className="sv-deeper">
          <summary>
            <span className="sv-deeper__label">深入一点</span>
            <span>为什么远处的格子会缩小</span>
          </summary>
          <p>
            设灯在 <span className="axis-3">w</span> 方向距离 <span dangerouslySetInnerHTML={{ __html: tex('d') }} /> 处，一点的坐标为{' '}
            <span dangerouslySetInnerHTML={{ __html: tex('(x,y,z,w)') }} />，它的影子落在{' '}
            <span dangerouslySetInnerHTML={{ __html: tex('\\tfrac{d}{d-w}(x,y,z)') }} />。
          </p>
        </details>

        <section className="sv-steps" aria-label="滚动叙事中的步骤">
          <p className="sv-label">滚动叙事里，正在读的一步和还没读到的一步：</p>
          <div className="sv-step is-active">
            <p>
              <strong>在 x–w 平面里转。</strong>继续往下滚，图会替你转动。加粗的那个小立方体，一开始在里面。
            </p>
          </div>
          <div className="sv-step">
            <p>
              <strong>里外互换。</strong>它慢慢长大，从大立方体的一侧挤出去；转过半圈，里外正好对调。
            </p>
          </div>
        </section>

        <section className="sv-toc" aria-label="目录样式">
          <p className="sv-label">目录的样子：</p>
          <ol>
            <li>
              <span className="sv-toc__n">3</span>
              <div>
                <span className="sv-toc__t">截面</span>
                <span className="sv-toc__s">超立方体穿过我们的空间时，我们只能看到它的截面。</span>
              </div>
            </li>
            <li>
              <span className="sv-toc__n">4</span>
              <div>
                <span className="sv-toc__t">影子</span>
                <span className="sv-toc__s">先看立方体的影子，再把超立方体的影子投进我们的空间，在六个平面里转动它。</span>
              </div>
            </li>
            <li>
              <span className="sv-toc__n">5</span>
              <div>
                <span className="sv-toc__t">展开</span>
                <span className="sv-toc__s">把立方体摊成十字，再把超立方体在四维里折起来。</span>
              </div>
            </li>
          </ol>
        </section>
      </article>
    </div>
  );
}
