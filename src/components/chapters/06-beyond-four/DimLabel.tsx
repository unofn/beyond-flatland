/** Slider label: a visible italic n, with the word for screen readers. */
export function DimLabel({ word }: { word: string }) {
  return (
    <>
      <span className="visually-hidden">{word} </span>
      <i>n</i>
    </>
  );
}
