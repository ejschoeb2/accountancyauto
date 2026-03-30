"use client";

import { Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  company: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Prompt has been a real game changer for our practice. I no longer have those last-minute panics about missed deadlines, and everything feels far more organised from the client's point of view. Instead of scrambling to send emails at the last minute, we're now giving clients proper notice, which they really appreciate.\n\nWhat I like most is that the emails can still be personalised, so it doesn't feel automated or impersonal. Clients know it's still coming from me, and that trust we've built hasn't been lost. I just wish I'd had something like this years ago.",
    company: "Peninsula Accounting Ltd",
  },
  {
    quote:
      "Keeping on top of deadlines, especially with the growing regulatory pressure, has felt like an uphill struggle over the last few years. It's been all too easy for things to slip through the cracks and lead to penalties.\n\nSince installing Prompt, everything feels much more organised and under control. Ethan was great in guiding us through the setup, which made the whole process straightforward and manageable.\n\nWe started with the core features so we could get up and running quickly, and we're looking forward to exploring more of what it can do as we get used to it.",
    company: "Dolor Group",
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

            <blockquote className="text-[15px] text-muted-foreground leading-relaxed mb-8 space-y-4">
              {t.quote.split("\n\n").map((para, i) => (
                <p key={i}>
                  {i === 0 && <>&ldquo;</>}
                  {para}
                  {i === t.quote.split("\n\n").length - 1 && <>&rdquo;</>}
                </p>
              ))}
            </blockquote>

            <div>
              <p className="text-sm font-semibold text-foreground">
                {t.company}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
