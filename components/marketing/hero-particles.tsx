"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Brain,
  Bell,
  CalendarDays,
  MailOpen,
  CheckCircle,
  FileText,
  Users,
  Send,
  Clock,
  Receipt,
  Zap,
  Shield,
} from "lucide-react";

// ── Colours ──────────────────────────────────────────────────────────────────
// Colours map to the traffic-light status system in DESIGN.md:
//   violet/purple = brand, blue = Scheduled, green = Records Received,
//   amber = Approaching, orange = Critical, red = Overdue (no pink/rose)
type ParticleColour =
  | 'violet' | 'violet2' | 'purple'
  | 'blue'
  | 'green' | 'emerald'
  | 'amber' | 'orange'
  | 'red';

const PARTICLE_COLOUR_CLASSES: Record<ParticleColour, string> = {
  violet:  'text-violet-500',
  violet2: 'text-violet-400',
  purple:  'text-purple-500',
  blue:    'text-blue-500',
  green:   'text-green-500',
  emerald: 'text-emerald-400',
  amber:   'text-amber-500',
  orange:  'text-orange-500',
  red:     'text-red-500',
};

const PARTICLE_COLOURS: ParticleColour[] = [
  'violet', 'violet', 'violet2',
  'purple',
  'blue', 'blue',
  'green', 'emerald',
  'amber', 'orange',
  'red',
];

// ── Icons ─────────────────────────────────────────────────────────────────────

const PROMPT_ICONS = [Brain, Bell, CalendarDays, MailOpen, CheckCircle, FileText, Users, Send, Clock, Receipt, Zap, Shield] as const;

// ── Physics constants ─────────────────────────────────────────────────────────

const FRICTION = 0.985;
const VELOCITY_THRESHOLD = 0.01;

// ── Data types ────────────────────────────────────────────────────────────────

// Static data drives React rendering — never changes after spawn.
type ParticleStatic = {
  id: number;
  iconIndex: number;
  colour: ParticleColour;
  size: number;
  initX: number;
  initY: number;
};

// Physics state lives only in a ref — never touches React state.
type ParticlePhysics = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

// ── Particle generation ───────────────────────────────────────────────────────

const generateParticles = (
  containerWidth: number,
  containerHeight: number,
): { statics: ParticleStatic[]; physics: ParticlePhysics[] } => {
  const baseWidth = 1200;
  const sizeScale = Math.max(0.6, Math.min(1, containerWidth / baseWidth));
  const visibleHeight = Math.min(containerHeight, window.innerHeight * 0.7);
  const originX = containerWidth;
  const originY = visibleHeight / 2;

  const layers = [
    { count: 1,  radius: 0   },
    { count: 6,  radius: 80  },
    { count: 13, radius: 160 },
  ];

  const statics: ParticleStatic[] = [];
  const physics: ParticlePhysics[] = [];
  let id = 0;

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      let anglePos: number;
      if (layer.count === 1) {
        anglePos = Math.PI;
      } else {
        const spanDegrees = 144;
        const centerAngle = 180;
        const startAngle = (centerAngle - spanDegrees / 2) * (Math.PI / 180);
        const endAngle   = (centerAngle + spanDegrees / 2) * (Math.PI / 180);
        anglePos = startAngle + (i / (layer.count - 1)) * (endAngle - startAngle);
      }

      const x = originX + Math.cos(anglePos) * layer.radius;
      const y = originY + Math.sin(anglePos) * layer.radius;

      const velocityAngleBase = layer.radius === 0 ? Math.PI : anglePos;
      const variation = (Math.random() - 0.5) * (Math.PI / 6);
      const finalAngle = velocityAngleBase + variation;
      const speed = (2 + Math.random() * 3) * Math.max(0.8, sizeScale);
      const size = (40 + Math.random() * 20) * sizeScale;

      statics.push({
        id,
        iconIndex: Math.floor(Math.random() * PROMPT_ICONS.length),
        colour: PARTICLE_COLOURS[Math.floor(Math.random() * PARTICLE_COLOURS.length)],
        size,
        initX: x,
        initY: y,
      });

      physics.push({
        id,
        x,
        y,
        vx: Math.cos(finalAngle) * speed,
        vy: Math.sin(finalAngle) * speed,
        size,
      });

      id++;
    }
  });

  return { statics, physics };
};

// ── Shape renderer ────────────────────────────────────────────────────────────
// Registers a direct-update callback so the RAF loop can push positions
// straight to motion values — zero React re-renders per frame.

type UpdateFn = (x: number, y: number, speed: number) => void;

const Shape = ({
  particle,
  registerUpdate,
}: {
  particle: ParticleStatic;
  registerUpdate: (id: number, fn: UpdateFn | null) => void;
}) => {
  const x      = useMotionValue(particle.initX);
  const y      = useMotionValue(particle.initY);
  const rotate = useMotionValue(0);

  useEffect(() => {
    registerUpdate(particle.id, (newX, newY, speed) => {
      x.set(newX);
      y.set(newY);
      rotate.set(rotate.get() + speed * 2);
    });
    return () => registerUpdate(particle.id, null);
  // x/y/rotate are stable MotionValue refs — intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particle.id, registerUpdate]);

  const Icon        = PROMPT_ICONS[particle.iconIndex % PROMPT_ICONS.length];
  const colourClass = PARTICLE_COLOUR_CLASSES[particle.colour];

  return (
    <motion.div
      style={{
        x,
        y,
        rotate,
        position:    'absolute',
        left:        0,
        top:         0,
        marginLeft:  -particle.size / 2,
        marginTop:   -particle.size / 2,
        willChange:  'transform',
      }}
    >
      <Icon size={particle.size} strokeWidth={2.5} className={colourClass} />
    </motion.div>
  );
};

// ── HeroParticles ─────────────────────────────────────────────────────────────

export const HeroParticles = () => {
  const containerRef    = useRef<HTMLDivElement>(null);
  const [statics, setStatics] = useState<ParticleStatic[]>([]);
  const physicsRef      = useRef<ParticlePhysics[]>([]);
  const updateCallbacks = useRef<Map<number, UpdateFn>>(new Map());
  const animFrameRef    = useRef<number>(undefined);
  const dimensionsRef   = useRef({ width: 0, height: 0 });
  const isMobile        = useIsMobile();

  // Stable callback — Shape components register once on mount.
  const registerUpdate = useCallback((id: number, fn: UpdateFn | null) => {
    if (fn) {
      updateCallbacks.current.set(id, fn);
    } else {
      updateCallbacks.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      dimensionsRef.current = {
        width:  container.clientWidth,
        height: container.clientHeight,
      };
    };

    const initTimer = setTimeout(() => {
      updateDimensions();
      const { width, height } = dimensionsRef.current;
      if (width === 0 || height === 0) return;

      const { statics: initialStatics, physics: initialPhysics } = generateParticles(width, height);
      physicsRef.current = initialPhysics;
      setStatics(initialStatics);

      const animate = () => {
        const { height: containerHeight } = dimensionsRef.current;
        const removedIds: number[] = [];

        const nextPhysics = physicsRef.current.map(p => {
          let newVx = p.vx * FRICTION;
          let newVy = p.vy * FRICTION;

          if (Math.abs(newVx) < VELOCITY_THRESHOLD && Math.abs(newVy) < VELOCITY_THRESHOLD) {
            newVx = 0;
            newVy = 0;
          }

          let newX = p.x + newVx;
          let newY = p.y + newVy;
          const r  = p.size / 2;

          if (newX + r < -100) {
            removedIds.push(p.id);
            return null;
          }

          if (newY - r < 0)               { newY = r;                   newVy *= -0.8; }
          if (newY + r > containerHeight)  { newY = containerHeight - r; newVy *= -0.8; }

          return { ...p, x: newX, y: newY, vx: newVx, vy: newVy };
        }).filter((p): p is ParticlePhysics => p !== null);

        // Elastic collisions
        for (let i = 0; i < nextPhysics.length; i++) {
          for (let j = i + 1; j < nextPhysics.length; j++) {
            const p1 = nextPhysics[i];
            const p2 = nextPhysics[j];
            const dx  = p2.x - p1.x;
            const dy  = p2.y - p1.y;
            const dist    = Math.sqrt(dx * dx + dy * dy);
            const minDist = (p1.size + p2.size) / 2;

            if (dist < minDist && dist > 0) {
              const angle = Math.atan2(dy, dx);
              const sin   = Math.sin(angle);
              const cos   = Math.cos(angle);

              const vx1 = p1.vx * cos + p1.vy * sin;
              const vy1 = p1.vy * cos - p1.vx * sin;
              const vx2 = p2.vx * cos + p2.vy * sin;
              const vy2 = p2.vy * cos - p2.vx * sin;

              p1.vx = vx2 * cos - vy1 * sin;
              p1.vy = vy1 * cos + vx2 * sin;
              p2.vx = vx1 * cos - vy2 * sin;
              p2.vy = vy2 * cos + vx1 * sin;

              const overlap = minDist - dist;
              const sx      = (overlap / 2) * cos;
              const sy      = (overlap / 2) * sin;
              p1.x -= sx; p1.y -= sy;
              p2.x += sx; p2.y += sy;
            }
          }
        }

        physicsRef.current = nextPhysics;

        // Push positions directly to motion values — no React setState.
        nextPhysics.forEach(p => {
          const cb = updateCallbacks.current.get(p.id);
          if (cb) cb(p.x, p.y, Math.sqrt(p.vx * p.vx + p.vy * p.vy));
        });

        // React state only touched when a particle leaves the screen (rare).
        if (removedIds.length > 0) {
          setStatics(prev => prev.filter(s => !removedIds.includes(s.id)));
        }

        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);
    }, 1100);

    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', updateDimensions);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-10">
      {statics.map(s => (
        <Shape key={s.id} particle={s} registerUpdate={registerUpdate} />
      ))}
    </div>
  );
};
