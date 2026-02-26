"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
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
  Building2,
  Briefcase,
  Calculator,
  CreditCard,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Percent,
  FileCheck,
  BadgeCheck,
} from "lucide-react";

// ── Colours ──────────────────────────────────────────────────────────────────
// Matches hero-particles.tsx: violet/purple = brand, blue = Scheduled,
// green = Records Received, amber = Approaching, orange = Critical, red = Overdue

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
// Full icon pool matching hero-particles.tsx

const PROMPT_ICONS = [
  Brain, Bell, CalendarDays, MailOpen, CheckCircle, FileText, Users, Send, Clock, Receipt, Zap, Shield,
  Building2, Briefcase, Calculator, CreditCard, TrendingUp, BarChart3, FolderOpen, Percent, FileCheck, BadgeCheck,
] as const;

// ── Physics constants ─────────────────────────────────────────────────────────

const FRICTION = 0.985;
const VELOCITY_THRESHOLD = 0.01;

// ── Particle type ─────────────────────────────────────────────────────────────

type Particle = {
  id: number;
  iconIndex: number;
  colour: ParticleColour;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isStopped: boolean;
};

// ── Particle generation ───────────────────────────────────────────────────────

const generateParticles = (containerWidth: number, containerHeight: number): Particle[] => {
  const particles: Particle[] = [];
  const baseWidth = 1200;
  const sizeScale = Math.max(0.6, Math.min(1, containerWidth / baseWidth));

  let particleId = 0;

  const layers = [
    { count: 1, radius: 0   },
    { count: 2, radius: 60  },
    { count: 4, radius: 120 },
  ];

  const corners = [
    { x: 20,                  side: 'left'  },
    { x: containerWidth - 20, side: 'right' },
  ] as const;

  corners.forEach(corner => {
    const originY = containerHeight - 20;

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        let anglePos: number;
        if (corner.side === 'left') {
          const span   = 60;
          const center = -45;
          const start  = (center - span / 2) * (Math.PI / 180);
          const end    = (center + span / 2) * (Math.PI / 180);
          anglePos = layer.count === 1 ? center * (Math.PI / 180) : start + (i / (layer.count - 1)) * (end - start);
        } else {
          const span   = 60;
          const center = -135;
          const start  = (center - span / 2) * (Math.PI / 180);
          const end    = (center + span / 2) * (Math.PI / 180);
          anglePos = layer.count === 1 ? center * (Math.PI / 180) : start + (i / (layer.count - 1)) * (end - start);
        }

        const x = corner.x + Math.cos(anglePos) * layer.radius * sizeScale;
        const y = originY   + Math.sin(anglePos) * layer.radius * sizeScale;

        const speed      = (2 + Math.random() * 3) * Math.max(0.8, sizeScale);
        const variation  = (Math.random() - 0.5) * (Math.PI / 12);
        const finalAngle = anglePos + variation;

        particles.push({
          id:        particleId++,
          iconIndex: Math.floor(Math.random() * PROMPT_ICONS.length),
          colour:    PARTICLE_COLOURS[Math.floor(Math.random() * PARTICLE_COLOURS.length)],
          size:      (40 + Math.random() * 20) * sizeScale,
          x,
          y,
          vx:        Math.cos(finalAngle) * speed,
          vy:        Math.sin(finalAngle) * speed,
          isStopped: false,
        });
      }
    });
  });

  return particles;
};

// ── Shape renderer ────────────────────────────────────────────────────────────

const Shape = ({ particle }: { particle: Particle }) => {
  const x      = useMotionValue(particle.x);
  const y      = useMotionValue(particle.y);
  const rotate = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });

  useEffect(() => {
    x.set(particle.x);
    y.set(particle.y);
    const rotationSpeed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy) * 2;
    rotate.set(rotate.get() + rotationSpeed);
  }, [particle.x, particle.y, particle.vx, particle.vy, x, y, rotate]);

  const Icon        = PROMPT_ICONS[particle.iconIndex % PROMPT_ICONS.length];
  const colourClass = PARTICLE_COLOUR_CLASSES[particle.colour];

  return (
    <motion.div
      style={{
        x: springX,
        y: springY,
        rotate,
        position: 'absolute',
        left: 0,
        top: 0,
        marginLeft: -particle.size / 2,
        marginTop:  -particle.size / 2,
      }}
    >
      <Icon size={particle.size} strokeWidth={2.5} className={colourClass} />
    </motion.div>
  );
};

// ── FooterParticles ───────────────────────────────────────────────────────────

interface FooterParticlesProps {
  isTriggered: boolean;
}

export const FooterParticles = ({ isTriggered }: FooterParticlesProps) => {
  const containerRef      = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationFrameRef = useRef<number>(undefined);
  const hasSpawnedRef     = useRef(false);
  const dimensionsRef     = useRef({ width: 0, height: 0 });
  const isMobile          = useIsMobile();

  useEffect(() => {
    if (!isTriggered || hasSpawnedRef.current || isMobile) return;

    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      if (container) {
        dimensionsRef.current = {
          width:  container.clientWidth,
          height: container.clientHeight,
        };
      }
    };

    updateDimensions();
    const { width, height } = dimensionsRef.current;
    if (width === 0 || height === 0) return;

    setParticles(generateParticles(width, height));
    hasSpawnedRef.current = true;

    const animate = () => {
      setParticles(prevParticles => {
        const { width: containerWidth, height: containerHeight } = dimensionsRef.current;

        let newParticles = prevParticles.map(p => {
          // Stopped particles remain in place (confetti-scatter effect)
          if (p.isStopped) return p;

          let newVx = p.vx * FRICTION;
          let newVy = p.vy * FRICTION;

          const hasStopped = Math.abs(newVx) < VELOCITY_THRESHOLD && Math.abs(newVy) < VELOCITY_THRESHOLD;

          if (hasStopped) {
            return { ...p, vx: 0, vy: 0, isStopped: true };
          }

          let newX = p.x + newVx;
          let newY = p.y + newVy;
          const particleRadius = p.size / 2;

          // Fall off the bottom
          if (newY - particleRadius > containerHeight) return null;
          // Fall off the sides
          if (newX + particleRadius < -100 || newX - particleRadius > containerWidth + 100) return null;

          // Slight bounce off top
          if (newY - particleRadius < 0) {
            newY  = particleRadius;
            newVy *= -0.5;
          }

          return { ...p, x: newX, y: newY, vx: newVx, vy: newVy, isStopped: false };
        }).filter((p): p is Particle => p !== null);

        // Particle-to-particle collision (only for moving particles)
        for (let i = 0; i < newParticles.length; i++) {
          for (let j = i + 1; j < newParticles.length; j++) {
            const p1 = newParticles[i];
            const p2 = newParticles[j];

            if (p1.isStopped && p2.isStopped) continue;

            const dx  = p2.x - p1.x;
            const dy  = p2.y - p1.y;
            const distance    = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (p1.size + p2.size) / 2;

            if (distance < minDistance && distance > 0) {
              const angle = Math.atan2(dy, dx);
              const sin   = Math.sin(angle);
              const cos   = Math.cos(angle);

              if (!p1.isStopped && !p2.isStopped) {
                const vx1 = p1.vx * cos + p1.vy * sin;
                const vy1 = p1.vy * cos - p1.vx * sin;
                const vx2 = p2.vx * cos + p2.vy * sin;
                const vy2 = p2.vy * cos - p2.vx * sin;

                p1.vx = vx2 * cos - vy1 * sin;
                p1.vy = vy1 * cos + vx2 * sin;
                p2.vx = vx1 * cos - vy2 * sin;
                p2.vy = vy2 * cos + vx1 * sin;
              }

              const overlap     = minDistance - distance;
              const separationX = (overlap / 2) * cos;
              const separationY = (overlap / 2) * sin;

              if (!p1.isStopped) { p1.x -= separationX; p1.y -= separationY; }
              if (!p2.isStopped) { p2.x += separationX; p2.y += separationY; }
            }
          }
        }

        return [...newParticles];
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isTriggered, isMobile]);

  if (isMobile) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map(particle => (
        <Shape key={particle.id} particle={particle} />
      ))}
    </div>
  );
};
