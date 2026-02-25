"use client";

import { useEffect, useRef, useState } from "react";
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
  | 'red' | 'red2';

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
  red2:    'text-red-600',
};

// Brand violets dominate; each status colour gets meaningful representation.
// Red appears twice to reflect overdue urgency. No pink/rose.
const PARTICLE_COLOURS: ParticleColour[] = [
  'violet', 'violet', 'violet2',
  'purple',
  'blue', 'blue',
  'green', 'emerald',
  'amber', 'orange',
  'red', 'red', 'red2',
];

// ── Icons ─────────────────────────────────────────────────────────────────────

const PROMPT_ICONS = [Brain, Bell, CalendarDays, MailOpen, CheckCircle, FileText, Users, Send, Clock, Receipt, Zap, Shield] as const;

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
};

// ── Particle generation ───────────────────────────────────────────────────────
// containerWidth is the full section width (≈ viewport width).
// originX = far right edge; originY = vertical centre of the visible section.

const generateParticles = (containerWidth: number, containerHeight: number): Particle[] => {
  const particles: Particle[] = [];

  const baseWidth = 1200;
  const sizeScale = Math.max(0.6, Math.min(1, containerWidth / baseWidth));

  const visibleHeight = Math.min(containerHeight, window.innerHeight * 0.7);
  const originX = containerWidth;          // far-right edge of the full section
  const originY = visibleHeight / 2;       // vertical centre

  const layers = [
    { count: 1,  radius: 0   }, // Layer 1: Centre
    { count: 6,  radius: 80  }, // Layer 2: Inner arc
    { count: 13, radius: 160 }, // Layer 3: Outer arc
  ];

  let particleId = 0;

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      let anglePos: number;
      if (layer.count === 1) {
        anglePos = Math.PI; // Straight left
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

      particles.push({
        id: particleId++,
        iconIndex: Math.floor(Math.random() * PROMPT_ICONS.length),
        colour: PARTICLE_COLOURS[Math.floor(Math.random() * PARTICLE_COLOURS.length)],
        size: (40 + Math.random() * 20) * sizeScale,
        x,
        y,
        vx: Math.cos(finalAngle) * speed,
        vy: Math.sin(finalAngle) * speed,
      });
    }
  });

  return particles;
};

// ── Shape renderer ────────────────────────────────────────────────────────────

const Shape = ({ particle }: { particle: Particle }) => {
  const x      = useMotionValue(particle.x);
  const y      = useMotionValue(particle.y);
  const rotate = useMotionValue(0);

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
        x,
        y,
        rotate,
        position: 'absolute',
        left: 0,
        top: 0,
        marginLeft: -particle.size / 2,
        marginTop:  -particle.size / 2,
        willChange: 'transform',
      }}
    >
      <Icon size={particle.size} strokeWidth={2.5} className={colourClass} />
    </motion.div>
  );
};

// ── HeroParticles ─────────────────────────────────────────────────────────────

export const HeroParticles = () => {
  const containerRef      = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationFrameRef = useRef<number>(undefined);
  const canMoveRef        = useRef(false);
  const dimensionsRef     = useRef({ width: 0, height: 0 });
  const isMobile          = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
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

    // Delay until the text + button entrance animation has fully settled (~1.5 s).
    const initTimer = setTimeout(() => {
      updateDimensions();
      const { width, height } = dimensionsRef.current;
      if (width === 0 || height === 0) return;

      const initialParticles = generateParticles(width, height);
      setParticles(initialParticles);
      canMoveRef.current = true;

      const animate = () => {
        setParticles(prevParticles => {
          if (!canMoveRef.current) return prevParticles;
          const { width: containerWidth, height: containerHeight } = dimensionsRef.current;

          const baseWidth = 1200;
          const sizeScale = Math.max(0.6, Math.min(1, containerWidth / baseWidth));
          void sizeScale; // referenced for future respawn logic

          const newParticles = prevParticles.map(p => {
            let newVx = p.vx * FRICTION;
            let newVy = p.vy * FRICTION;

            if (Math.abs(newVx) < VELOCITY_THRESHOLD && Math.abs(newVy) < VELOCITY_THRESHOLD) {
              newVx = 0;
              newVy = 0;
            }

            let newX = p.x + newVx;
            let newY = p.y + newVy;
            const particleRadius = p.size / 2;

            // Left-edge removal
            if (newX + particleRadius < -100) return null;

            // Top boundary bounce
            if (newY - particleRadius < 0) {
              newY  = particleRadius;
              newVy *= -0.8;
            }

            // Bottom boundary bounce
            if (newY + particleRadius > containerHeight) {
              newY  = containerHeight - particleRadius;
              newVy *= -0.8;
            }

            return { ...p, x: newX, y: newY, vx: newVx, vy: newVy };
          }).filter((p): p is Particle => p !== null);

          // Elastic particle-to-particle collision
          for (let i = 0; i < newParticles.length; i++) {
            for (let j = i + 1; j < newParticles.length; j++) {
              const p1 = newParticles[i];
              const p2 = newParticles[j];
              const dx  = p2.x - p1.x;
              const dy  = p2.y - p1.y;
              const distance    = Math.sqrt(dx * dx + dy * dy);
              const minDistance = (p1.size + p2.size) / 2;

              if (distance < minDistance && distance > 0) {
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

                const overlap      = minDistance - distance;
                const separationX  = (overlap / 2) * cos;
                const separationY  = (overlap / 2) * sin;
                p1.x -= separationX;
                p1.y -= separationY;
                p2.x += separationX;
                p2.y += separationY;
              }
            }
          }

          return [...newParticles];
        });

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, 1100);

    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', updateDimensions);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0">
      {particles.map(particle => (
        <Shape key={particle.id} particle={particle} />
      ))}
    </div>
  );
};
