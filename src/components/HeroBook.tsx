"use client";

export function HeroBook() {
  return (
    <div className="hero-book" aria-hidden="true">
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
        <div className="hero-lines" style={{ inset: "14% 14% 16% 16%" }}>
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
