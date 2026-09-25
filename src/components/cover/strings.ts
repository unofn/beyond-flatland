import { defineStrings } from '../../i18n/ui';

/** Cover and contents strings. Two native texts, not translations. */
export const coverStrings = defineStrings({
  zh: {
    otherTitle: 'Beyond Flatland',
    description: '一本关于维度的交互式小书：从平面国出发，一维一维往上走，直到四维和更高的空间。',
    invite1: '正方形先生住在一个平面上，一辈子只见过线段。',
    invite2: '从上方俯视，他的整个世界一览无余，连屋子里面也看得清清楚楚。',
    invite3: '这本书的每一章，都把这一步再往上挪一维，直到你站到他的位置上：面对一个比你的世界多出一个方向的形体，只看得见它的影子。',
    begin: '开始阅读',
    contents: '目录',
    empty: '章节还在写作中，先去实验室看看吧。',
    colophonHead: '版本说明',
    colophon1: '本书的设想来自埃德温·A·阿博特的《平面国：一个多维的传奇》（1884），用色取自奥利弗·伯恩的《欧几里得几何原本前六卷》（1847）。',
    colophon2: '全书以中文和英文各写一遍，两个版本各自成文。',
    otherEdition: '阅读英文版',
    colophon3: '正文字体为 Libre Caslon 与思源宋体。',
    heroLabel:
      '平面国的一角：正方形先生、一座五边形的房子（屋里有个六边形）、一个等腰三角形、一个圆和一个五边形。画面先从平面之内看，只有一条线；随后视线升到平面上方，俯看整个平面。',
    captionLine: '正方形先生眼中的世界：一条线，近处浓，远处淡。',
    captionRising: '离开平面，形状开始显现。',
    captionAbove: '从上方看，每个图形都完整可见，连屋子里面也一览无余。',
    tilt: '俯视角度',
    tiltValue: '高出平面 {n} 度',
  },
  en: {
    otherTitle: '超越平面国',
    description:
      'A small interactive book about dimensions: start in Flatland and climb one dimension at a time, up to the fourth and beyond.',
    invite1: 'A Square lives on a flat plane and has only ever seen lines.',
    invite2: 'From above, you can take in his whole world at once, even the inside of his house.',
    invite3:
      'Each chapter takes that step one dimension higher, until you stand where he stood: before a shape with one more direction than your world, seeing only its shadow.',
    begin: 'Start reading',
    contents: 'Contents',
    empty: 'The chapters are still being written. The Laboratory is open.',
    colophonHead: 'Colophon',
    colophon1:
      'The premise comes from Edwin A. Abbott’s *Flatland: A Romance of Many Dimensions* (1884); the colours from Oliver Byrne’s *The First Six Books of the Elements of Euclid* (1847).',
    colophon2: 'The book is written twice, in English and in Chinese, each text on its own terms.',
    otherEdition: 'Read the Chinese edition',
    colophon3: 'Set in Libre Caslon and Noto Serif SC.',
    heroLabel:
      'A corner of Flatland: A Square, a pentagonal house with a hexagon inside, an isosceles triangle, a circle and a pentagon. It is first seen from within the plane, as a single line; then the view rises above the plane and looks down on it.',
    captionLine: 'What A Square sees: a single line, darker where things are near, fainter where they are far.',
    captionRising: 'Rising out of the plane, the shapes begin to appear.',
    captionAbove: 'From above, every shape is whole, and you can see inside the house.',
    tilt: 'Viewing angle',
    tiltValue: '{n} degrees above the plane',
  },
});
