import { useEffect, type RefObject } from 'react';

/**
 * Replays the `.cc-page-enter` animation on an element whenever `key` changes
 * (the shell passes the pathname). The page itself is not remounted, so no
 * state is lost; duration and easing come from the motion tokens, so reduced
 * motion makes it instant.
 */
export function usePageEnter(ref: RefObject<HTMLElement | null>, key: string): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('cc-page-enter');
    // Force a style flush so re-adding the class restarts the animation.
    void el.offsetWidth;
    el.classList.add('cc-page-enter');
    // animationend bubbles: ignore the page's own children finishing first.
    const done = (e: AnimationEvent) => {
      if (e.target === el) el.classList.remove('cc-page-enter');
    };
    el.addEventListener('animationend', done);
    return () => el.removeEventListener('animationend', done);
  }, [ref, key]);
}
