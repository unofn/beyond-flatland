/**
 * Vertex / edge / square / cube counts for dimensions 0–4. Rows fill in as
 * the reader builds each shape in the figure above. The tesseract row is a
 * prediction: the reader guesses, then reveals, then sees the pattern.
 */
import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { Button } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { counts } from './geometry';
import { builtDim, tesseractRevealed } from './store';
import './extrusion.css';

const s = defineStrings({
  zh: {
    caption: '每一行，都是把上一行拖动一次得到的。',
    colShape: '形状',
    col0: '顶点',
    col1: '棱',
    col2: '正方形',
    col3: '立方体',
    shape0: '点',
    shape1: '线段',
    shape2: '正方形',
    shape3: '立方体',
    shape4: '超立方体',
    notYet: '还没搭出来',
    guess: '超立方体的{what}数，你的猜测',
    reveal: '揭晓',
    revealHint: '空着也可以直接揭晓。',
    right: '猜中了',
    yourGuess: '你猜 {n}',
    allRight: '四个全对。你还没见过它，就已经把它数清楚了。',
    someRight: '猜中了 {n} 个。没猜中的，看看下面的规律就知道差在哪里。',
    noneRight: '一个都没中也不要紧，第一次猜的人大多如此。规律其实只有一条。',
    skipped: '不猜也行。规律是这样的。',
    edges24: '24 条棱是最自然的猜法：原件 12 条，复制品 12 条。漏掉的 8 条，是八个顶点在拖动时各自扫出的那条紫色的棱。',
    pattern1: '顶点每拖一次就翻一倍：原件一份，复制品一份。',
    pattern2:
      '其余每一样，都是原来数目的两倍，再加上小一号的东西被拖动时扫出的新部分：每个旧顶点扫出一条新棱，每条旧棱扫出一个新正方形，每个旧正方形扫出一个新立方体。所以超立方体有 12 × 2 + 8 = 32 条棱。',
  },
  en: {
    caption: 'Each row is the row above, dragged once.',
    colShape: 'Shape',
    col0: 'Vertices',
    col1: 'Edges',
    col2: 'Squares',
    col3: 'Cubes',
    shape0: 'point',
    shape1: 'segment',
    shape2: 'square',
    shape3: 'cube',
    shape4: 'tesseract',
    notYet: 'not built yet',
    guess: 'Your guess: the tesseract’s {what}',
    reveal: 'Reveal',
    revealHint: 'You can reveal it without guessing.',
    right: 'right',
    yourGuess: 'you said {n}',
    allRight: 'All four right. You counted it before you ever saw it.',
    someRight: '{n} of four right. The pattern below shows where the others come from.',
    noneRight: 'None right this time, which is how most first guesses go. There is really only one rule.',
    skipped: 'Not guessing is fine too. Here is the rule.',
    edges24:
      '24 edges is the most natural guess: 12 on the original, 12 on the copy. The missing 8 are the violet edges the eight corners sweep out as they move.',
    pattern1: 'Vertices double every time: the original and the copy.',
    pattern2:
      'Everything else is twice the old count, plus the new pieces swept out by the next-smaller things as they are dragged: each old vertex sweeps a new edge, each old edge a new square, each old square a new cube. So the tesseract has 12 × 2 + 8 = 32 edges.',
  },
});

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** "12 × 2 + 8": how the tesseract count in column k comes from the cube row. */
function rule(k: number): string {
  const cube = counts(3);
  const twice = `${cube[k]} × 2`;
  return k === 0 ? twice : `${twice} + ${cube[k - 1]}`;
}

export default function CountTable({ locale, scrolly }: { locale: Locale; scrolly: string }) {
  const str = s[locale];
  const built = useStore(builtDim);
  const revealed = useStore(tesseractRevealed);
  const [guesses, setGuesses] = useState(['', '', '', '']);

  // A reader who lands below the figure (a link, a reload) has scrolled past
  // every build step, so fill the first four rows for them.
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const section = document.querySelector<HTMLElement>(`[data-scrolly="${scrolly}"]`);
    if (!section) return;
    const check = () => {
      if (section.getBoundingClientRect().bottom < window.innerHeight * 0.5) {
        setPassed(true);
        window.removeEventListener('scroll', check);
      }
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [scrolly]);

  const cols = [str.col0, str.col1, str.col2, str.col3];
  const shapes = [str.shape0, str.shape1, str.shape2, str.shape3, str.shape4];
  const answer = counts(4);
  const entered = guesses.filter((g) => g.trim() !== '').length;
  const correct = guesses.filter((g, k) => g.trim() !== '' && Number(g) === answer[k]).length;

  const rowHead = (d: number) => (
    <th scope="row">
      <span className={['ext-count__dim', d > 0 && `axis-${d - 1}`].filter(Boolean).join(' ')}>{d}</span>
      {shapes[d]}
    </th>
  );

  let verdict = str.skipped;
  if (entered > 0) verdict = correct === 4 ? str.allRight : correct > 0 ? fill(str.someRight, { n: correct }) : str.noneRight;

  return (
    <div className="ext-count">
      <table>
        <caption>{str.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{str.colShape}</th>
            {cols.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((d) => {
            const filled = d <= built || passed;
            const c = counts(d);
            return (
              <tr key={d}>
                {rowHead(d)}
                {c.map((n, k) => (
                  <td key={k}>
                    {filled ? (
                      n
                    ) : (
                      <span className="ext-count__empty">
                        <span aria-hidden="true">·</span>
                        <span className="visually-hidden">{str.notYet}</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="ext-count__predict">
            {rowHead(4)}
            {answer.map((n, k) => {
              const g = guesses[k]!.trim();
              return (
                <td key={k}>
                  {revealed ? (
                    <>
                      <span className="ext-count__answer">{n}</span>
                      <span className="ext-count__note">{rule(k)}</span>
                      {g !== '' && (
                        <span className="ext-count__note">{Number(g) === n ? str.right : fill(str.yourGuess, { n: g })}</span>
                      )}
                    </>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="?"
                      aria-label={fill(str.guess, { what: cols[k]!.toLowerCase() })}
                      value={guesses[k]}
                      onChange={(e) => {
                        const next = guesses.slice();
                        next[k] = e.currentTarget.value;
                        setGuesses(next);
                      }}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {!revealed && (
        <div className="ext-count__actions">
          <Button onClick={() => tesseractRevealed.set(true)}>{str.reveal}</Button>
          <span>{str.revealHint}</span>
        </div>
      )}
      <div className="ext-count__feedback" aria-live="polite">
        {revealed && (
          <>
            <p>{verdict}</p>
            {guesses[1]!.trim() === '24' && <p>{str.edges24}</p>}
            <p>{str.pattern1}</p>
            <p>{str.pattern2}</p>
          </>
        )}
      </div>
    </div>
  );
}
