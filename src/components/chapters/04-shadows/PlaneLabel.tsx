import { axisName } from '../../ui';
import './shadows.css';

/** "xw" with x in red and w in violet: the plane named in its axis colours. */
export function PlaneLabel({ i, j }: { i: number; j: number }) {
  return (
    <span className="sh-plane">
      <span className={`axis-${Math.min(i, 3)}`}>{axisName(i)}</span>
      <span className={`axis-${Math.min(j, 3)}`}>{axisName(j)}</span>
    </span>
  );
}
