import { ArrowRight, MessageSquare, Layers, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

export function FeaturesSection({ locale }: { locale: string }) {
  const t = useTranslations("landing");

  return (
    <section id="features" className="py-16 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-12 lg:mb-28">
        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tighter mb-6 lg:mb-8 leading-[1.1] text-foreground">
          {t("featuresTitle1")}<span className="text-primary italic">{t("featuresTitle2")}</span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light opacity-80 px-4">
          {t("featuresDesc")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* 编辑器模式卡片 */}
        <FeatureCard
          icon={<Layers className="text-primary w-12 h-12 transition-transform duration-500 group-hover:rotate-12" />}
          badge={t("editorBadge")}
          title={t("editorTitle")}
          description={t("editorDesc")}
          ctaText={t("editorCta")}
          href={`/${locale}/editor`}
        />

        {/* 对话模式卡片 */}
        <FeatureCard
          icon={<MessageSquare className="text-primary w-12 h-12 transition-transform duration-500 group-hover:rotate-12" />}
          badge={t("chatBadge")}
          title={t("chatTitle")}
          description={t("chatDesc")}
          prompt={t("chatPrompt")}
          ctaText={t("chatCta")}
          isDialogue
          href={`/${locale}/chat`}
        />
      </div>
    </section>
  );
}

interface FeatureCardProps {
  icon: ReactNode;
  badge: string;
  title: string;
  description: string;
  tools?: string[];
  prompt?: string;
  ctaText: string;
  isDialogue?: boolean;
  href?: string;
}

function FeatureCard({ icon, badge, title, description, tools, prompt, ctaText, isDialogue, href }: FeatureCardProps) {
  return (
    <div className="group relative overflow-hidden bg-gradient-to-br from-secondary/50 via-card/80 to-background p-6 sm:p-8 lg:p-12 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3.5rem] flex flex-col justify-between transition-all duration-700 hover:scale-[1.01] border border-border/80 hover:border-primary/40 shadow-lg dark:shadow-2xl min-h-[400px] sm:min-h-[450px] lg:min-h-[500px]">
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary/10 blur-[100px] rounded-full group-hover:bg-primary/20 transition-colors duration-700"></div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 lg:mb-10">
          <div className="w-16 h-16 sm:w-20 lg:w-24 sm:h-20 lg:h-24 bg-primary/10 rounded-2xl sm:rounded-3xl flex items-center justify-center border border-primary/20 group-hover:border-primary/60 transition-all shadow-[0_0_30px_rgba(0,229,229,0.1)] group-hover:shadow-[0_0_40px_rgba(0,229,229,0.3)]">
            {icon}
          </div>
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-primary/60 border border-primary/20 px-3 sm:px-4 py-1.5 rounded-full backdrop-blur-sm">
            {badge}
          </span>
        </div>

        <div>
          <h3 className="text-3xl sm:text-4xl lg:text-6xl font-black mb-4 sm:mb-6 tracking-tight text-foreground group-hover:text-primary transition-colors duration-500">
            {title}
          </h3>
          <p className="text-base sm:text-lg lg:text-2xl text-muted-foreground leading-relaxed mb-6 sm:mb-8 font-light max-w-xl">
            {description}
          </p>
        </div>

          <div className="mt-auto pt-6 sm:pt-8 border-t border-border flex justify-end">
          {tools && (
            <div className="flex -space-x-3">
              {tools.map((tool, index) => (
                <div key={index} className="w-10 h-10 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[10px] font-bold text-primary">
                  {tool}
                </div>
              ))}
            </div>
          )}
          {href ? (
            <Link href={href} className="flex items-center space-x-4 text-primary font-black group/btn text-sm sm:text-base tracking-widest uppercase py-2">
              <span className="border-b-2 border-primary/20 group-hover/btn:border-primary transition-all pb-1 duration-300">
                {ctaText}
              </span>
              {isDialogue ? <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 group-hover/btn:translate-x-3 transition-transform duration-300" /> : <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover/btn:translate-x-3 transition-transform duration-300" />}
            </Link>
          ) : (
            <div className="flex items-center space-x-4 text-primary font-black text-sm sm:text-base tracking-widest uppercase py-2">
              <span className="border-b-2 border-primary/20 pb-1">
                {ctaText}
              </span>
              {isDialogue ? <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" /> : <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
