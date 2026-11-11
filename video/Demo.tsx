import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from 'remotion'
import {
  AckBeat,
  ChecksBeat,
  GateBeat,
  Intro,
  InvoiceBeat,
  Outro,
  PayBeat,
} from './scenes'

/** Scene starts and lengths, in frames at 30fps. These must sum to TOTAL. */
export const SCENES = {
  intro: { from: 0, dur: 150 },
  invoice: { from: 150, dur: 270 },
  checks: { from: 420, dur: 360 },
  ack: { from: 780, dur: 150 },
  gate: { from: 930, dur: 190 },
  pay: { from: 1120, dur: 220 },
  outro: { from: 1340, dur: 130 },
} as const

export const TOTAL_FRAMES = 1470

/** Persistent background: graphite, a lime bloom, and a fading grid. */
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = interpolate(frame, [0, TOTAL_FRAMES], [0, 70])

  return (
    <AbsoluteFill style={{ backgroundColor: 'var(--graphite)' }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(198,245,80,0.11) 0%, rgba(198,245,80,0.03) 38%, transparent 68%)',
          transform: `translateY(${drift}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(233,235,229,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(233,235,229,0.05) 1px, transparent 1px)',
          backgroundSize: '84px 84px',
          opacity: 0.5,
          maskImage:
            'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.9) 0%, transparent 76%)',
          WebkitMaskImage:
            'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.9) 0%, transparent 76%)',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  )
}

/** Cross-fades a beat in and out using frames relative to its own sequence. */
const BeatFade: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
  const frame = useCurrentFrame()
  const opacity = Math.min(
    interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
    interpolate(frame, [duration - 15, duration], [1, 0], {
      extrapolateLeft: 'clamp',
    }),
  )

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

const Beat: React.FC<{
  scene: { from: number; dur: number }
  children: React.ReactNode
}> = ({ scene, children }) => (
  <Sequence from={scene.from} durationInFrames={scene.dur} layout="none">
    <BeatFade duration={scene.dur}>{children}</BeatFade>
  </Sequence>
)

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: 'var(--graphite)', fontFamily: 'var(--sans)' }}
    >
      <Backdrop />

      <Beat scene={SCENES.intro}>
        <Intro />
      </Beat>
      <Beat scene={SCENES.invoice}>
        <InvoiceBeat />
      </Beat>
      <Beat scene={SCENES.checks}>
        <ChecksBeat />
      </Beat>
      <Beat scene={SCENES.ack}>
        <AckBeat />
      </Beat>
      <Beat scene={SCENES.gate}>
        <GateBeat />
      </Beat>
      <Beat scene={SCENES.pay}>
        <PayBeat />
      </Beat>
      <Beat scene={SCENES.outro}>
        <Outro />
      </Beat>
    </AbsoluteFill>
  )
}
