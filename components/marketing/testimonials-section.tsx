"use client";

import { Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "We used to spend hours every week chasing clients for documents and checking deadlines. Prompt replaced all of that — reminders go out automatically, uploads come back organised, and nothing slips through. It's genuinely changed how we run the practice.",
    author: "Sarah Mitchell",
    role: "Practice Manager",
    company: "Peninsula Accounting",
  },
  {
    quote:
      "We started using Prompt to handle Self Assessment reminders for our medical professionals. Within the first month, our on-time submission rate jumped noticeably. The automated sequences mean we set it once and forget it — clients get nudged at the right time without us lifting a finger.",
    author: "James Hargreaves",
    role: "Director",
    company: "Dolor Medical",
  },
];

export const TestimonialsSection = () => (
  <section className="relative z-[1] py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">
      {/* Header */}
      <div className="mb-16">
        <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
          Trusted by Practices
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
          Don&apos;t take our<br className="hidden lg:block" /> word for it.
        </h2>
      </div>

      {/* Testimonial cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {testimonials.map((t) => (
          <div
            key={t.company}
            className="relative rounded-2xl bg-card border border-border/60 shadow-lg p-8 md:p-10 flex flex-col justify-between"
          >
            <Quote
              size={28}
              className="text-violet-500/30 mb-5 shrink-0"
            />

            <blockquote className="text-[15px] text-muted-foreground leading-relaxed mb-8">
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            <div>
              <p className="text-sm font-semibold text-foreground">
                {t.author}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {t.role}, {t.company}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
