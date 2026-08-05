import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

export function FaqSection() {
  const t = useTranslations("landing");

  const faqItems = [
    { question: t("faq.0.question"), answer: t("faq.0.answer") },
    { question: t("faq.1.question"), answer: t("faq.1.answer") },
    { question: t("faq.2.question"), answer: t("faq.2.answer") },
    { question: t("faq.3.question"), answer: t("faq.3.answer") },
    { question: t("faq.4.question"), answer: t("faq.4.answer") },
    { question: t("faq.5.question"), answer: t("faq.5.answer") },
    { question: t("faq.6.question"), answer: t("faq.6.answer") },
  ];

  return (
    <section className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-10 lg:mb-16">
          <div className="inline-block px-4 py-1.5 mb-4 sm:mb-6 rounded-full border border-primary/30 bg-primary/5 text-primary text-[10px] sm:text-xs font-black tracking-widest uppercase">
            {t("faqBadge")}
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-4 sm:mb-6 text-foreground">
            {t("faqTitle1")}<span className="text-primary">{t("faqTitle2")}</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">{t("faqDesc")}</p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {faqItems.map((item, index) => (
            <details key={index} className="group bg-card border border-border neon-border-glow rounded-2xl sm:rounded-[2rem] overflow-hidden">
              <summary className="flex items-center justify-between p-5 sm:p-6 lg:p-8 cursor-pointer list-none hover:bg-secondary/50 transition-colors">
                <span className="text-base sm:text-lg lg:text-xl font-bold text-foreground pr-4">{item.question}</span>
                <ChevronDown className="text-primary transition-transform group-open:rotate-180 shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
              </summary>
              <div className="px-5 sm:px-6 lg:px-8 pb-5 sm:pb-6 lg:pb-8 text-muted-foreground text-sm sm:text-base lg:text-lg leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
