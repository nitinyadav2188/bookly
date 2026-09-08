"use client";

export function HeroBook() {
  return (
    <div className="hero-book" aria-hidden="true">
      <div className="absolute -left-2 -top-3 z-10">
        <span className="nb-ribbon bg-blue text-white">Flip it</span>
      </div>
      <div className="absolute -bottom-2 -right-1 z-10">
        <span className="nb-ribbon bg-lime text-black" style={{ transform: "rotate(5deg)" }}>
          Private
        </span>
      </div>
      <div className="hero-book-spread">
        <div className="hero-page left">
          <div className="hero-lines">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="hero-page right">
          <div className="hero-lines">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <div className="hero-spine" />
      <div className="hero-turning">
        <div className="hero-lines" style={{ inset: "16% 16% 18% 16%" }}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
