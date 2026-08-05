"use client";

import { useTranslations } from 'next-intl';

export function TestimonialSection() {
  const t = useTranslations("landing");

  const testimonials = [
    {
      quote: t("testimonial1Quote"),
      name: "Alex Chen",
      role: t("testimonial1Role"),
      avatar: "https://img.editf.com/home/Alex-Chen.jpg",
      isHighlight: false,
    },
    {
      quote: t("testimonial2Quote"),
      name: "Sarah Miller",
      role: t("testimonial2Role"),
      avatar: "https://img.editf.com/home/Sarah-Miller.jpg",
      isHighlight: true,
    },
    {
      quote: t("testimonial3Quote"),
      name: "David Kim",
      role: t("testimonial3Role"),
      avatar: "https://img.editf.com/home/David-Kim.jpg",
      isHighlight: false,
    },
  ];

  return (
    <section className="py-12 sm:py-16 lg:py-32 bg-gradient-to-b from-background to-card/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 sm:mb-12 lg:mb-20 px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-4 lg:mb-6 leading-[1.1] text-foreground">
            {t("testimonialTitleFrom")}<span className="text-primary italic">{t("testimonialTitle1")} </span>{t("testimonialTitle2")}
          </h2>
          <div className="h-1 w-16 lg:w-24 bg-primary/80 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-8 relative px-4 sm:px-6 lg:px-0">
          <span className="text-[10rem] sm:text-[12rem] lg:text-[15rem] font-black absolute -top-20 sm:-top-32 lg:-top-40 left-0 text-primary/[0.03] sm:text-primary/[0.04] lg:text-primary/[0.05] leading-none pointer-events-none select-none hidden sm:block">"</span>

          {testimonials.map((item, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden p-5 sm:p-6 lg:p-10 rounded-2xl sm:rounded-3xl border transition-all duration-500 hover:scale-[1.01] flex flex-col justify-between ${
                item.isHighlight
                  ? "bg-card border-primary/20 shadow-[0_0_25px_rgba(0,229,229,0.06)] dark:shadow-[0_0_35px_rgba(0,229,229,0.1)] sm:transform sm:-translate-y-3 hover:shadow-[0_0_40px_rgba(0,229,229,0.15)] dark:hover:shadow-[0_0_50px_rgba(0,229,229,0.2)]"
                  : "bg-card/50 border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              }`}
            >
              {/* Background glow on hover */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 bg-primary/5 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
                item.isHighlight ? "group-hover:bg-primary/10" : ""
              }`}></div>

              <div className="relative z-10">
                <p className="text-sm sm:text-base lg:text-xl font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors duration-500">
                  {item.quote}
                </p>
              </div>

              <footer className="flex items-center space-x-3 sm:space-x-4 mt-5 sm:mt-6 lg:mt-auto">
                <img
                  alt={item.name}
                  className={`w-10 h-10 sm:w-11 sm:h-11 lg:w-14 lg:h-14 rounded-full object-cover border-2 transition-all duration-500 ${
                    item.isHighlight 
                      ? "border-primary/20 group-hover:border-primary/50 group-hover:shadow-[0_0_15px_rgba(0,229,229,0.3)]" 
                      : "border-border/50 group-hover:border-primary/40"
                  }`}
                  src={item.avatar}
                />
                <div>
                  <p className="font-bold text-foreground text-xs sm:text-sm lg:text-base group-hover:text-primary transition-colors duration-500">{item.name}</p>
                  <p className="text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground tracking-wider uppercase group-hover:text-muted-foreground/80 transition-colors duration-500">{item.role}</p>
                </div>
              </footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
