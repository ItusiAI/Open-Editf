import { ArrowRight, Image, Video, Play, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';

export function HeroSection() {
  const t = useTranslations("landing");
  const locale = useLocale();

  return (
    <section id="home" className="relative py-12 lg:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      {/* 动画背景元素 */}
      <div className="absolute inset-0 grid-bg pointer-events-none z-0"></div>
      <div className="hero-gradient absolute inset-0 pointer-events-none z-0"></div>
      <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-primary rounded-full blur-[2px] float-particle opacity-0" style={{ animationDelay: '0s' }}></div>
      <div className="absolute top-3/4 left-1/3 w-1.5 h-1.5 bg-primary rounded-full blur-[2px] float-particle opacity-0" style={{ animationDelay: '5s' }}></div>
      <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-primary rounded-full blur-[2px] float-particle opacity-0" style={{ animationDelay: '10s' }}></div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-20 items-center relative z-10">
        {/* 左侧内容 */}
        <div className="lg:col-span-5 space-y-8 lg:space-y-10 text-center lg:text-left">
          {/* 标题和描述 */}
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-tight text-foreground" style={{ letterSpacing: '-0.05em' }}>
              {t("heroTitle1")}<br /><span className="text-primary">{t("heroTitle2")}</span>
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-xl leading-relaxed font-light tracking-wide border-l-2 border-primary/20 pl-6 lg:border-l-2 lg:pl-6">
              {t("heroDesc")}
            </p>
          </div>

          {/* 主按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2 items-center sm:items-start">
            <Link href={`/${locale}/editor`} className="bg-primary text-primary-foreground px-8 py-4 text-lg font-black rounded-full shadow-[0_0_30px_rgba(0,229,229,0.2)] dark:shadow-[0_0_30px_rgba(0,229,229,0.3)] hover:shadow-[0_0_50px_rgba(0,229,229,0.3)] dark:hover:shadow-[0_0_50px_rgba(0,229,229,0.5)] hover:-translate-y-1 transition-all active:scale-95 group relative overflow-hidden flex items-center justify-center no-underline">
              <span className="relative z-10">{t("heroButton")}</span>
              <ArrowRight className="ml-2 relative z-10 transition-transform group-hover:translate-x-1 w-6 h-6" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </Link>
          </div>
        </div>

        {/* 右侧产品展示 */}
        <div className="lg:col-span-7 relative mt-8 lg:mt-0">
          <div className="absolute -inset-10 bg-primary/10 rounded-full blur-[80px] dark:block hidden"></div>
          <div className="relative group">
            <div className="relative bg-card rounded-2xl sm:rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden border border-border aspect-[16/10] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.08)] dark:shadow-[0_0_100px_rgba(0,0,0,0.6)] dark:bg-secondary">
              {/* 产品头部 */}
              <div className="bg-card/80 px-3 sm:px-4 lg:px-6 py-2 lg:py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/30"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500/30"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/30"></div>
                  </div>
                  <div className="h-3 sm:h-4 w-px bg-border hidden sm:block"></div>
                  <div className="hidden sm:flex items-center space-x-2 lg:space-x-4">
                    <div className="flex items-center space-x-1 lg:space-x-2 text-[8px] sm:text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                      <Image className="text-[10px] sm:text-[14px]" />
                      <span className="hidden sm:inline">{t("heroImage")}</span>
                    </div>
                    <div className="flex items-center space-x-1 lg:space-x-2 text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1.5 sm:px-2 py-0.5 sm:py-1">
                      <Video className="text-[10px] sm:text-[14px]" />
                      <span className="hidden sm:inline">{t("heroVideo")}</span>
                    </div>
                  </div>
                </div>
                <div className="text-[8px] sm:text-[10px] font-mono text-muted-foreground hidden sm:block">{t("heroImageLabel")}</div>
              </div>

              {/* 主内容区域 - 图片编辑示例 */}
              <div className="relative flex-grow grid grid-cols-2 gap-px bg-border">
                {/* 左侧 - 编辑前 */}
                <div className="relative overflow-hidden group/canvas">
                  <img
                    alt={t("heroBefore")}
                    className="w-full h-full object-cover grayscale opacity-50"
                    src="https://img.editf.com/home/Input-Image.jpeg"
                  />
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/canvas:opacity-100 transition-opacity"></div>
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-background/80 backdrop-blur-md px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[7px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-widest border border-border">{t("heroInputImage")}</div>
                </div>

                {/* 右侧 - 编辑后 */}
                <div className="relative overflow-hidden">
                  <img
                    alt={t("heroAfter")}
                    className="w-full h-full object-cover scale-105"
                    src="https://img.editf.com/home/AI-Render-Output.jpg"
                  />
                  <div className="scanline"></div>
                  <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-primary/30 backdrop-blur-md px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[7px] sm:text-[9px] font-bold text-primary uppercase tracking-widest border border-primary/50">{t("heroOutputImage")}</div>
                </div>
              </div>

              {/* 浮动聊天和提示词界面 */}
              <div className="absolute inset-0 flex flex-col justify-end p-2 sm:p-3 lg:p-4 pointer-events-none">
                {/* 用户提示词气泡 */}
                <div className="mb-2 sm:mb-3 mx-auto max-w-[90%] bg-secondary/80 dark:bg-secondary/80 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-border shadow-lg pointer-events-auto text-center">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shrink-0">
                      <User className="text-primary w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" />
                    </div>
                    <p className="text-xs sm:text-sm lg:text-base font-medium text-foreground tracking-tight lg:truncate">{t("heroPromptText")}</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
