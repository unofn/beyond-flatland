/**
 * The k-face counts of the n-cube for n = 0…12. The reader first predicts the
 * edges of the 5-cube; the rest of the table appears when they reveal it.
 */
import { useId, useState } from 'react';
import { hypercubeFaceCount } from '../../../lib/nd';
import { Button, Slider } from '../../ui';
import type { Locale } from '../../../i18n/locales';
import { MAX_N, formatCount, setDimension, useDimension } from './state';
import { s } from './strings';
import { DimLabel } from './DimLabel';
import './beyond.css';

/** The entry the reader predicts: edges (k = 1) of the 5-cube. */
const ASK_N = 5;
const ASK_K = 1;
const ANSWER = hypercubeFaceCount(ASK_N, ASK_K);

export default function CountTable({ locale }: { locale: Locale }) {
  const str = s[locale];
  const n = useDimension();
  const [guess, setGuess] = useState('');
  const [revealed, setRevealed] = useState(false);
  const inputId = useId();

  const rows = Array.from({ length: (revealed ? MAX_N : ASK_N) + 1 }, (_, i) => i);
  const cols = Array.from({ length: MAX_N + 1 }, (_, k) => k);
  const kName = [str.k0, str.k1, str.k2, str.k3];

  const g = Number(guess);
  const verdict = !revealed
    ? ''
    : guess.trim() === '' || !Number.isFinite(g)
      ? str.answerIs.replace('{a}', String(ANSWER))
      : g === ANSWER
        ? str.right.replace('{a}', String(ANSWER))
        : str.wrong.replace('{a}', String(ANSWER)).replace('{g}', guess.trim());

  return (
    <div className="bf-count">
      <form
        className="bf-predict"
        onSubmit={(e) => {
          e.preventDefault();
          setRevealed(true);
        }}
      >
        <label htmlFor={inputId}>{str.predict}</label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={0}
          value={guess}
          disabled={revealed}
          onChange={(e) => setGuess(e.currentTarget.value)}
        />
        {!revealed && <Button type="submit">{str.reveal}</Button>}
        <p className="bf-predict__verdict" aria-live="polite">
          {verdict}
        </p>
      </form>

      <div className="bf-table-wrap" role="region" aria-label={str.tableCaption} tabIndex={0}>
        <table className="bf-table">
          <caption>{str.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col" className="bf-table__corner">
                <span>n</span>
                <span className="bf-table__sub">k</span>
              </th>
              {cols.map((k) => (
                <th scope="col" key={k}>
                  {k}
                  {k < 4 && <span className="bf-table__sub">{kName[k]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className={r === n ? 'is-current' : undefined} aria-current={r === n ? 'true' : undefined}>
                <th scope="row">{r}</th>
                {cols.map((k) => {
                  // Until the reveal, the asked row shows only what comes before the question.
                  if (k > r || (!revealed && r === ASK_N && k > ASK_K)) return <td key={k} className="bf-table__empty" />;
                  if (!revealed && r === ASK_N && k === ASK_K)
                    return (
                      <td key={k} className="bf-table__ask">
                        <button type="button" onClick={() => setRevealed(true)} aria-label={str.revealCell}>
                          ?
                        </button>
                      </td>
                    );
                  return (
                    <td key={k} className={revealed && r === ASK_N && k === ASK_K ? 'bf-table__answer' : undefined}>
                      {formatCount(hypercubeFaceCount(r, k), locale)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!revealed && <p className="bf-count__more">{str.moreRows}</p>}

      <div className="ctl-row bf-count__controls">
        <Slider
          label={<DimLabel word={str.dim} />}
          value={n}
          min={0}
          max={MAX_N}
          step={1}
          onChange={setDimension}
          format={(x) => `${x}`}
          valueText={(x) => str.dimValue.replace('{n}', String(x))}
        />
      </div>
    </div>
  );
}
