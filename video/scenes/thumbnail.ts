/**
 * The YouTube thumbnail (not part of the film): the HOME tesseract large on
 * the right, the title large on the left. Thumbnails are seen small, so the
 * type is big and the strokes are heavy. Render with
 *   node video/render.ts --scenes thumbnail --stills 0.5
 */
import { HOME_ROT, TESSERACT } from '../lib/handoff';
import { el, type Scene } from '../lib/scene';
import { PolyInk, makeStage } from '../lib/stage';

export const thumbnail: Scene = {
  id: 'thumbnail',
  subtitles: false,
  mount({ root, tokens }) {
    const host = el(root, 'div', '', { position: 'absolute', left: '860px', top: '40px', width: '1040px', height: '1000px' });
    const stage = makeStage(host, { extent: 2.75 });
    const tess = new PolyInk(stage, tokens, TESSERACT, 9);

    const words = el(root, 'div', '', { position: 'absolute', left: '110px', top: '230px', width: '820px' });
    el(words, 'div', '', { fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '150px', lineHeight: '1.1', letterSpacing: '0.04em', color: tokens.ink }, '超越<br>平面国');
    el(words, 'div', '', { fontSize: '76px', fontStyle: 'italic', marginTop: '26px', color: tokens.inkSoft }, 'Beyond Flatland');
    el(words, 'div', '', { fontSize: '56px', marginTop: '30px', color: tokens.inkSoft }, '看见<span class="axis-3">第四维</span>');
    el(words, 'div', '', { fontSize: '48px', marginTop: '4px', color: tokens.inkSoft }, 'seeing the <span class="axis-3">fourth</span> dimension');

    return () => {
      tess.update(HOME_ROT, { depth: 3, persp: 1, distance: 3, faceOpacity: 0.05 });
      stage.render();
    };
  },
};
