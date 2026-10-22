/** Static posters remain the source for metadata, reduced motion and paused portraits. */
export function portraitSource(poster = '', animation = '', paused = false): string {
  return animation && !paused && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? animation
    : poster;
}
