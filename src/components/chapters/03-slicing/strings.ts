import { defineStrings } from '../../../i18n/ui';

export const s = defineStrings({
  zh: {
    ballLabel: '一个四维球穿过我们的空间：我们只看到一个先长大、再缩小的球',
    play: '播放',
    pause: '暂停',
    reset: '复位',
    first: '先到：',
    firstGroup: '超立方体先以哪一部分进入我们的空间',
    cell: '胞',
    face: '面',
    edge: '棱',
    vertex: '顶点',
    tesseractLabel:
      '超立方体穿过我们的三维空间时留下的截面。拖动可以绕着它转；滑块改变截面所在的 w 位置。角落里的小图是低一维的对照：立方体穿过平面国时的截面。',
    flatland: '低一维',
    empty: '空',
    cell24Label: '二十四胞体穿过我们的三维空间时留下的截面。拖动可以绕着它转。',
  },
  en: {
    ballLabel: 'A 4D ball passing through our space: all we see is a sphere that grows and then shrinks',
    play: 'Play',
    pause: 'Pause',
    reset: 'Reset',
    first: 'First in:',
    firstGroup: 'Which part of the tesseract enters our space first',
    cell: 'cell',
    face: 'face',
    edge: 'edge',
    vertex: 'vertex',
    tesseractLabel:
      'The cross-section a tesseract leaves in our 3D space as it passes through. Drag to walk around it; the slider moves the slice along w. The small inset is the same story one dimension down: a cube passing through Flatland.',
    flatland: 'One dimension down',
    empty: 'empty',
    cell24Label: 'The cross-section a 24-cell leaves in our 3D space as it passes through. Drag to walk around it.',
  },
});
