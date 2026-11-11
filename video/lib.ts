import { interpolate, spring, type SpringConfig } from 'remotion'

/** Settled, slightly overshooting entrance — the house motion for panels. */
export const ENTER: SpringConfig = { damping: 200, mass: 0.55, stiffness: 120 }

/** Sharper, springier pop for things that should feel like a stamp landing. */
export const PUNCH: SpringConfig = { damping: 13, mass: 0.6, stiffness: 150 }

export const enter = (
  frame: number,
  fps: number,
  delay = 0,
  config: SpringConfig = ENTER,
): number => spring({ frame: Math.max(0, frame - delay), fps, config })

export const fade = (frame: number, from: number, to: number): number =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Vertical rise paired with a fade, the standard "panel arrives" move. */
export const rise = (progress: number, distance = 36): React.CSSProperties => ({
  opacity: progress,
  transform: `translateY(${(1 - progress) * distance}px)`,
})

export const MONO = 'var(--mono)'
export const SANS = 'var(--sans)'
