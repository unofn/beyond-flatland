/**
 * The film's narration, one continuous story in eight movements. English is
 * spoken (voice.ts); both languages are burned in as subtitles (zh above,
 * en below). Each cue becomes one voice clip, and the measured clip lengths
 * set every movement's timing.
 *
 * `hold` adds seconds of silence after a cue so the picture can finish a move.
 * `sub: false` keeps a cue off the subtitle band (the scene sets it itself).
 * `say` overrides what is spoken, with macOS speech commands such as
 * [[slnc 400]] (a pause in ms) at the turns of the story; `en` stays the subtitle.
 */
export interface Cue {
  en: string;
  zh: string;
  say?: string;
  hold?: number;
  sub?: boolean;
}

export const SCRIPT: Record<string, Cue[]> = {
  open: [
    {
      en: 'This is Flatland: a world with length and width, but no height. A Square lives here.',
      zh: '这是平面国：一个只有长和宽、没有高的世界。正方形先生住在这里。',
    },
    { en: 'One day a sphere passes through his world. He never sees a sphere.', zh: '有一天，一个球穿过他的世界。他从来没看见球。' },
    { en: 'He sees a point, then a circle that grows, shrinks, and disappears.', zh: '他只看到一个点，然后一个圆，变大，变小，消失。', hold: 0.4 },
    {
      en: 'Now turn the question around. What would we see if something four-dimensional passed through our space?',
      zh: '现在把问题倒过来：如果一个四维的东西穿过我们的空间，我们会看到什么？',
      hold: 0.6,
    },
  ],
  build: [
    { en: 'First we need a four-dimensional thing. Build it the way you would build a cube.', zh: '先得有一个四维的东西。就像造立方体那样来造它。' },
    { en: 'Drag a point, and you get a line. Drag the line, a square. Drag the square, a cube.', zh: '拖动一个点，得到线段；拖动线段，得到正方形；拖动正方形，得到立方体。', hold: 0.3 },
    {
      en: 'Now drag the cube in a fourth direction, at right angles to all three. That is a tesseract: sixteen corners, bounded by eight cubes.',
      zh: '再把立方体朝第四个方向拖，这个方向和前三个都垂直。这就是超立方体：十六个顶点，由八个立方体围成。',
      hold: 0.8,
    },
  ],
  slice: [
    {
      en: 'Let it pass through our space. Just as A Square saw only a slice of the sphere, we see only a slice of the tesseract.',
      zh: '让它穿过我们的空间。正方形先生只看到球的截面，我们也只看到超立方体的截面。',
    },
    {
      en: 'Corner first, it arrives as a tiny tetrahedron, swells into an octahedron, and shrinks away again.',
      zh: '如果顶点先到，它先是一个小小的四面体，长成八面体，再缩小、消失。',
      hold: 0.8,
    },
  ],
  shadow: [
    {
      en: 'But look again at the tesseract we built. It never entered our space at all.',
      say: 'But look again [[slnc 150]] at the tesseract we built. [[slnc 500]] It never entered our space at all.',
      zh: '可是回头看看我们造的那个超立方体，它根本没进过我们的空间。',
      hold: 0.3,
    },
    {
      en: 'What we drew was its shadow, the way a cube casts a flat shadow on a wall.',
      say: 'What we drew [[slnc 250]] was its shadow, [[slnc 300]] the way a cube casts a flat shadow on a wall.',
      zh: '我们画出来的，是它的影子，就像立方体在墙上投下一个平面的影子。',
      hold: 0.4,
    },
    {
      en: 'Turn it in a plane that reaches into the fourth direction, and the shadow does what no solid can: the inner cube passes through the outer one, and they trade places.',
      zh: '在伸向第四个方向的平面里转动它，影子就做出任何立体都做不到的事：里面的立方体穿过外面的，两者交换了位置。',
      hold: 1.0,
    },
  ],
  unfold: [
    {
      en: 'There is a third way to look. Unfold a cube, and you get six squares in a cross.',
      say: 'There is a third way to look. [[slnc 400]] Unfold a cube, and you get six squares in a cross.',
      zh: '还有第三种看法。把立方体展开，得到六个正方形拼成的十字。',
      hold: 0.3,
    },
    {
      en: 'Unfold a tesseract, and you get eight cubes: the cross Salvador Dalí painted in 1954.',
      zh: '把超立方体展开，得到八个立方体。达利 1954 年画的，正是这个十字。',
      hold: 1.0,
    },
  ],
  beyond: [
    {
      en: 'And four is not the end. Fold it back up and keep going: five dimensions, six, twelve.',
      say: 'And four is not the end. [[slnc 400]] Fold it back up, and keep going: [[slnc 200]] five dimensions, [[slnc 150]] six, [[slnc 250]] twelve.',
      zh: '四维也不是尽头。把它合起来，接着往上走：五维、六维、十二维。',
      hold: 0.6,
    },
    {
      en: 'Each new direction doubles the corners. A twelve-dimensional cube has four thousand and ninety-six.',
      zh: '每多一个方向，顶点就翻一倍。十二维的立方体有 4,096 个顶点。',
      hold: 0.6,
    },
  ],
  data: [
    {
      en: 'Now forget the cube, and keep the points. A point in many dimensions is just a list of numbers.',
      say: 'Now forget the cube, [[slnc 200]] and keep the points. [[slnc 400]] A point in many dimensions is just a list of numbers.',
      zh: '现在忘掉立方体，只留下这些点。多维空间里的一个点，不过是一串数字。',
    },
    {
      en: 'Four measurements of a flower make a point in four dimensions. A hundred and fifty flowers make a cloud we cannot see.',
      zh: '一朵花的四个测量值，就是四维空间里的一个点。一百五十朵花，是一团我们看不见的点云。',
    },
    {
      en: 'So we look at its shadow, and turn it until it shows the most. Three kinds of iris come apart.',
      zh: '所以我们看它的影子，转到能看出最多东西的角度。三种鸢尾花分开了。',
      hold: 0.8,
    },
  ],
  close: [
    {
      en: 'This is how we work with more than three dimensions: slices, shadows, unfoldings, and one careful step up.',
      say: 'This is how we work with more than three dimensions: [[slnc 300]] slices, [[slnc 100]] shadows, [[slnc 100]] unfoldings, [[slnc 250]] and one careful step up.',
      zh: '我们就是这样对付三维以上的空间的：看截面，看影子，看展开，再小心地往上走一步。',
    },
    {
      en: 'Just as A Square, watching a circle, came to know a sphere.',
      say: 'Just as A Square, [[slnc 150]] watching a circle, [[slnc 200]] came to know a sphere.',
      zh: '就像正方形先生看着一个圆，认识了一个球。',
      hold: 0.8,
    },
    { en: 'Beyond Flatland. An explorable book.', zh: '超越平面国。一本可以动手读的书。', hold: 3.0, sub: false },
  ],
};
