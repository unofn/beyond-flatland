import { defineStrings } from '../../i18n/ui';
import type { Locale } from '../../i18n/locales';
import type { Family } from './shapes';

export const s = defineStrings({
  zh: {
    title: '实验室',
    intro: '这里没有故事，只有全部参数：挑一个形体，选一种看法，在任意一个平面里转动它。',
    back: '回到目录',

    object: '形体',
    family: '种类',
    cube: '立方体',
    simplex: '单纯形',
    cross: '正轴形',
    cell24: '24 胞体',
    dimension: '维度',
    only4d: '只存在于四维',
    counts: '{v} 个顶点 · {e} 条棱 · {f} 个面',

    view: '看法',
    viewKind: '看法',
    projection: '投影',
    section: '截面',
    projMode: '投影方式',
    perspective: '透视',
    orthographic: '正交',
    distance: '视点距离',
    distanceHint: '以形体半径为单位',
    firstContact: '先碰到截面的是',
    tilt: '法向',
    offset: '截面位置',
    shadow: '同时画出它沿法向的影子',

    rotation: '旋转',
    familiar: '熟悉的平面',
    beyond: '经过 w 及更高维的平面',
    planesCount: '{n} 个',
    spinPlane: '在 {p} 平面里自转',
    play: '播放',
    pause: '暂停',
    speed: '自转速度',
    resetRotation: '转回原位',
    dragHint: '拖动图形可绕它转动；聚焦图形后也可用方向键。',

    look: '笔触',
    depth: '纵深',
    depth0: '平涂墨线',
    depth1: '透视墨线',
    depth2: '远处变淡',
    depth3: '半透明的面',
    depth4: '第四维线索',
    lineWidth: '线宽',
    colour: '颜色',
    byAxis: '按轴着色',
    ink: '墨色',

    share: '分享',
    shareHint: '地址栏随时记着当前的设置，把链接发给别人，他们看到的就是这一幅。',
    copy: '复制链接',
    copied: '已复制',
    resetAll: '全部复位',
    showControls: '显示控制',
    hideControls: '收起控制',
    controls: '控制面板',

    // Honest captions for what the drawing shows.
    capFlat: '{name}，平铺在纸面上。',
    capSolid: '{name}，画在三维里。',
    capPersp: '{name}的透视投影：{chain}，每一步视点都在 {d} 倍半径处。',
    capPersp1: '{name}的透视投影：{chain}，视点在 {d} 倍半径处。',
    capOrtho: '{name}的正交投影：{chain}，直接去掉多出来的坐标。',
    capSect2: '一条直线切过{name}：截面是一条线段。',
    capSect3: '一个平面切过{name}：截面是一个多边形。',
    capSect4: '一个三维超平面切过{name}：截面是一个立体。',
    capSectHi: '一个 {h} 维超平面切过{name}：截面本身是 {h} 维的，这里再把它{how}到三维（{chain}）。',
    capSectPersp: '透视投影',
    capSectOrtho: '正交投影',
    capShadow: '淡线是整个形体沿法向投下的影子。',
    capEmpty: '超平面此刻没有碰到形体。',
    canvasLabel: '{caption}拖动或按方向键可绕它转动。',

    sq: '正方形',
    cube3: '立方体',
    cube4: '超立方体',
    cubeN: '{n} 维立方体',
    tri: '三角形',
    tet: '正四面体',
    cell5: '正五胞体',
    simplexN: '{n} 维单纯形',
    diamond: '立在角上的正方形',
    oct: '正八面体',
    cell16: '正十六胞体',
    crossN: '{n} 维正轴形',
    cell24Name: '正二十四胞体',

    face0: '顶点',
    face1: '棱',
    face2: '面',
    face3: '胞',
    faceK: '{k} 维面',
  },
  en: {
    title: 'Laboratory',
    intro: 'No story here, only the controls: pick a shape, choose how to look at it, and turn it in any plane you like.',
    back: 'Back to contents',

    object: 'Object',
    family: 'Family',
    cube: 'Cube',
    simplex: 'Simplex',
    cross: 'Cross',
    cell24: '24-cell',
    dimension: 'Dimension',
    only4d: 'exists only in four dimensions',
    counts: '{v} vertices · {e} edges · {f} faces',

    view: 'View',
    viewKind: 'View',
    projection: 'Projection',
    section: 'Section',
    projMode: 'Projection',
    perspective: 'Perspective',
    orthographic: 'Orthographic',
    distance: 'Eye distance',
    distanceHint: 'in units of the object’s radius',
    firstContact: 'First to meet the hyperplane',
    tilt: 'Normal',
    offset: 'Cut at',
    shadow: 'Also draw its shadow along the normal',

    rotation: 'Rotation',
    familiar: 'Familiar planes',
    beyond: 'Planes through w and beyond',
    planesCount: '{n}',
    spinPlane: 'Spin in the {p} plane',
    play: 'Play',
    pause: 'Pause',
    speed: 'Spin speed',
    resetRotation: 'Turn back',
    dragHint: 'Drag the drawing to orbit it, or focus it and use the arrow keys.',

    look: 'Look',
    depth: 'Depth',
    depth0: 'flat ink',
    depth1: 'ink in perspective',
    depth2: 'fading with distance',
    depth3: 'translucent faces',
    depth4: 'w cue',
    lineWidth: 'Line width',
    colour: 'Colour',
    byAxis: 'By axis',
    ink: 'Ink',

    share: 'Share',
    shareHint: 'The address bar always holds the current settings. Send the link and the recipient sees this exact figure.',
    copy: 'Copy link',
    copied: 'Copied',
    resetAll: 'Reset everything',
    showControls: 'Show controls',
    hideControls: 'Hide controls',
    controls: 'Controls',

    capFlat: '{A} {name}, lying flat on the page.',
    capSolid: '{A} {name}, drawn in three dimensions.',
    capPersp: 'Perspective projection of {a} {name}: {chain}, with the eye {d} radii away at each step.',
    capPersp1: 'Perspective projection of {a} {name}: {chain}, with the eye {d} radii away.',
    capOrtho: 'Orthographic projection of {a} {name}: {chain}, simply dropping the extra coordinates.',
    capSect2: 'A line cuts {a} {name}: the section is a segment.',
    capSect3: 'A plane cuts {a} {name}: the section is a polygon.',
    capSect4: 'A 3-dimensional hyperplane cuts {a} {name}: the section is a solid.',
    capSectHi: 'A {h}-dimensional hyperplane cuts {a} {name}: the section is itself {h}-dimensional, shown here by {how} ({chain}).',
    capSectPersp: 'perspective projection',
    capSectOrtho: 'orthographic projection',
    capShadow: 'Faint lines: the whole object’s shadow along the normal.',
    capEmpty: 'The hyperplane misses the object right now.',
    canvasLabel: '{caption} Drag or use the arrow keys to orbit it.',

    sq: 'square',
    cube3: 'cube',
    cube4: 'tesseract',
    cubeN: '{n}-cube',
    tri: 'triangle',
    tet: 'tetrahedron',
    cell5: '5-cell',
    simplexN: '{n}-simplex',
    diamond: 'square standing on a corner',
    oct: 'octahedron',
    cell16: '16-cell',
    crossN: '{n}-orthoplex',
    cell24Name: '24-cell',

    face0: 'vertex',
    face1: 'edge',
    face2: 'face',
    face3: 'cell',
    faceK: '{k}-face',
  },
});

export type Str = (typeof s)['zh'];

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function shapeName(locale: Locale, family: Family, n: number): string {
  const t = s[locale];
  if (family === 'cell24') return t.cell24Name;
  const table: Record<Exclude<Family, 'cell24'>, (string | undefined)[]> = {
    cube: [undefined, undefined, t.sq, t.cube3, t.cube4],
    simplex: [undefined, undefined, t.tri, t.tet, t.cell5],
    cross: [undefined, undefined, t.diamond, t.oct, t.cell16],
  };
  const general = { cube: t.cubeN, simplex: t.simplexN, cross: t.crossN }[family];
  return table[family][n] ?? fill(general, { n });
}

export function faceName(locale: Locale, k: number): string {
  const t = s[locale];
  return [t.face0, t.face1, t.face2, t.face3][k] ?? fill(t.faceK, { k });
}
