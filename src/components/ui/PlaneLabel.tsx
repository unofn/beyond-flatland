import { axisName } from './axisLabel';

/** A rotation plane named in its axis colours: "xw" with x red and w violet. */
export function PlaneLabel({ i, j }: { i: number; j: number }) {
  const cls = (k: number) => (k < 4 ? `axis-${k}` : undefined);
  return (
    <span className="ctl-plane">
      <span className={cls(i)}>{axisName(i)}</span>
      <span className={cls(j)}>{axisName(j)}</span>
    </span>
  );
}
