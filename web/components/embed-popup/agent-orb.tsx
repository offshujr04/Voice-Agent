'use client';

import { motion } from 'motion/react';
import { type AgentState } from '@livekit/components-react';

interface AgentOrbProps {
  state: AgentState;
}

/**
 * A soft "smoke mesh" orb: a few blurred, translucent loops in the accent color
 * (--agent-green) slowly counter-rotating, so they weave into an organic, glowing
 * blob with a bright center. Animation speed reflects the agent state.
 */
export function AgentOrb({ state }: AgentOrbProps) {
  const isConnecting = state === 'connecting' || state === 'initializing';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  // Base lap time — faster when speaking, slower when idle.
  const base = isSpeaking ? 4 : isListening ? 7 : isConnecting ? 3 : 9;

  // Each loop: size (% of the orb), tilt, opacity, spin direction, speed factor.
  // Crisp thin strokes with a soft glow so the overlapping loops read as a mesh.
  const loops = [
    { w: 94, h: 78, rot: 0, op: 0.9, dir: 1, mul: 1 },
    { w: 76, h: 96, rot: 55, op: 0.8, dir: -1, mul: 1.35 },
    { w: 98, h: 68, rot: -40, op: 0.7, dir: 1, mul: 1.7 },
  ];

  return (
    <div className="relative grid size-8 shrink-0 place-items-center">
      {/* faint glow so the mesh sits on a soft halo (kept subtle, not blurry) */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-[2px] opacity-50"
        style={{
          background: 'radial-gradient(circle at 50% 50%, var(--agent-green-soft) 0%, transparent 70%)',
        }}
      />
      {loops.map((l, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: `${l.w}%`,
            height: `${l.h}%`,
            border: '1.25px solid var(--agent-green)',
            opacity: l.op,
            // Middle ground: defined strokes, slightly soft edge + a faint glow.
            filter: 'blur(0.5px) drop-shadow(0 0 1.5px var(--agent-green-soft))',
          }}
          initial={{ rotate: l.rot }}
          animate={{ rotate: l.rot + l.dir * 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: base * l.mul }}
        />
      ))}
    </div>
  );
}
