import { useEffect, useState } from "react";
import { animationTokens } from "../tokens/animationTokens";

export function useReducedMotion() {
  const queryOverride =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("reduced");
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? queryOverride || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(queryOverride || mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return {
    reduced,
    scaleDuration: (ms: number) => (reduced ? Math.max(40, ms * animationTokens.reducedScale) : ms),
  };
}
