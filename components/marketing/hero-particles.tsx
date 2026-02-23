"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Mail,
  Calendar,
  Clock,
  FileText,
  Users,
  Bell,
  CheckCircle,
  AlertCircle,
  Send,
  BarChart2,
  Layers,
  Receipt,
} from "lucide-react";

// ── Colours ──────────────────────────────────────────────────────────────────

type ParticleColour = 'danger' | 'critical' | 'warning' | 'info' | 'green' | 'neutral';

const PARTICLE_COLOUR_CLASSES: Record<ParticleColour, string> = {
  danger:   'text-status-danger',
  critical: 'text-status-critical',
  warning:  'text-status-warning',
  info:     'text-status-info',
  green:    'text-green-500',
  neutral:  'text-status-neutral',
};

const PARTICLE_COLOURS: ParticleColour[] = ['danger', 'critical', 'warning', 'info', 'green', 'neutral'];

// ── Icons ─────────────────────────────────────────────────────────────────────

const PROMPT_ICONS = [Mail, Calendar, Clock, FileText, Users, Bell, CheckCircle, AlertCircle, Send, BarChart2, Layers, Receipt] as const;

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

const generateParticles = (containerWidth: number, containerHeight: number): Particle[] => {
  const particles: Particle[] = [];

  const baseWidth = 1200;
  const sizeScale = Math.max(0.6, Math.min(1, containerWidth / baseWidth));

  const visibleHeight = Math.min(containerHeight, window.innerHeight * 0.7);
  const originX = containerWidth - 50;
  const originY = (visibleHeight / 2) + 132;

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

      const speed = (1.5 + Math.random() * 3.5) * Math.max(0.8, sizeScale);

      particles.push({
        id: particleId++,
        iconIndex: Math.floor(Math.random() * PROMPT_ICONS.length),
        colour: PARTICLE_COLOURS[Math.floor(Math.random() * PARTICLE_COLOURS.length)],
        size: (35 + Math.random() * 25) * sizeScale,
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

            // Right boundary bounce
            if (newX + particleRadius > containerWidth) {
              newX  = containerWidth - particleRadius;
              newVx *= -0.8;
            }

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
    }, 100);

    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', updateDimensions);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 h-[150vh] pointer-events-none z-0">
      {particles.map(particle => (
        <Shape key={particle.id} particle={particle} />
      ))}
    </div>
  );
};
