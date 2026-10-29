# Teludens motion specification

The entry shell uses only the shared press, hover, selection, and panel durations. Motion communicates state change; it is not decorative. The current implementation transitions control feedback and the skip link only. Loading does not use an indeterminate animation.

`prefers-reduced-motion: reduce` reduces all animation and transition duration to 0.01ms, disables repeated animation, and restores automatic scrolling. No interaction depends on animation completion.
