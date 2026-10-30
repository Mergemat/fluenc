import { useEffect, useState } from "react";

/** The time, read again every `every` ms while `ticking`, for a clock or countdown on screen. */
export function useNow(every: number, ticking = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every, ticking]);
  return now;
}
