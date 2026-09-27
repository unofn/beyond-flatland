import type { Scene } from '../lib/scene';
import { open } from './open';
import { build } from './build';
import { slice } from './slice';
import { shadow } from './shadow';
import { unfold } from './unfold';
import { beyond } from './beyond';
import { data } from './data';
import { close } from './close';
import { thumbnail } from './thumbnail';

/** In film order; ids match the keys of SCRIPT. */
export const scenes: Scene[] = [open, build, slice, shadow, unfold, beyond, data, close];

/** Rendered on their own (?scene=id), never part of the film. */
export const extras: Scene[] = [thumbnail];
