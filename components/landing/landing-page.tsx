"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "./hero-section";
import { FeaturesSection } from "./features-section";
import { TestimonialSection } from "./testimonial-section";
import { LandingPricingSection } from "./pricing-section";
import { FaqSection } from "./faq-section";

interface LandingPageProps {
  locale: string;
}

export default function LandingPage({ locale }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans antialiased">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection locale={locale} />
        <TestimonialSection />
        <LandingPricingSection locale={locale} />
        <FaqSection />
      </main>
      <Footer />
      <style jsx global>{`
        .font-sans {
          font-family: var(--font-inter), 'Noto Sans SC', system-ui, sans-serif;
        }

        .hero-gradient {
          background: radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.12) 0%, transparent 70%);
        }

        .dark .hero-gradient {
          background: radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.15) 0%, transparent 70%);
        }

        :root .hero-gradient {
          background: radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.08) 0%, transparent 70%);
        }

        .grid-bg {
          background-image: linear-gradient(hsl(var(--primary) / 0.08) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--primary) / 0.08) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black, transparent 80%);
        }

        .dark .grid-bg {
          background-image: linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px);
        }

        :root .grid-bg {
          background-image: linear-gradient(hsl(var(--primary) / 0.04) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--primary) / 0.04) 1px, transparent 1px);
        }

        .float-particle {
          animation: float 20s infinite linear;
        }

        @keyframes float {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(20vw); opacity: 0; }
        }

        .neon-text-glow {
          text-shadow: 0 0 20px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.15);
        }

        .dark .neon-text-glow {
          text-shadow: 0 0 20px hsl(var(--primary) / 0.4), 0 0 40px hsl(var(--primary) / 0.2);
        }

        .glass-pricing {
          background: hsl(var(--card) / 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid hsl(var(--border) / 0.5);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
        }

        .dark .glass-pricing {
          background: hsl(var(--card) / 0.4);
          border: 1px solid hsl(var(--border) / 0.08);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
        }

        .neon-border-glow {
          box-shadow: 0 0 20px hsl(var(--primary) / 0.12), inset 0 0 12px hsl(var(--primary) / 0.04);
          border-color: hsl(var(--primary) / 0.15);
        }

        .dark .neon-border-glow {
          box-shadow: 0 0 25px hsl(var(--primary) / 0.15), inset 0 0 15px hsl(var(--primary) / 0.05);
          border-color: transparent;
        }

        .neon-border-glow-pro {
          box-shadow: 0 0 30px hsl(var(--primary) / 0.2), inset 0 0 15px hsl(var(--primary) / 0.06);
          border-color: hsl(var(--primary) / 0.2);
        }

        .dark .neon-border-glow-pro {
          box-shadow: 0 0 40px hsl(var(--primary) / 0.3), inset 0 0 20px hsl(var(--primary) / 0.1);
          border-color: hsl(var(--primary) / 0.5);
        }

        .scanline {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            transparent 50%,
            hsl(var(--primary) / 0.03) 50%
          );
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.3;
        }

        .dark .scanline {
          background: linear-gradient(
            to bottom,
            transparent 50%,
            hsl(var(--primary) / 0.05) 50%
          );
          background-size: 100% 4px;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
