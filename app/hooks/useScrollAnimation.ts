import { useEffect, useState, useRef } from "react";

/**
 * A custom hook to detect if an element is in the viewport using IntersectionObserver.
 * @param {number} threshold - A value from 0 to 1 indicating how much of the element must be visible.
 * @returns {{ ref: React.RefObject, inView: boolean }}
 */
export function useScrollAnimation(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold }
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, [threshold]);

  return { ref, inView };
}
