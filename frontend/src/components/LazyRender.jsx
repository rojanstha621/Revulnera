import React, { useEffect, useRef, useState } from "react";

export default function LazyRender({ children, minHeight = 320 }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current || isVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "300px 0px",
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        children
      ) : (
        <div
          className="card border border-slate-700 bg-slate-900/40 animate-pulse"
          style={{ minHeight }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
