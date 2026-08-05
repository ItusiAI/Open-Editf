import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			// 赛博朋克风格配色
  			'cyber': {
  				50: '#E6FFFE',
  				100: '#CCFFFD',
  				200: '#99FFFB',
  				300: '#66FFF9',
  				400: '#33FFF7',
  				500: '#00F0FF', // 主色 - 电光蓝
  				600: '#00D9E6',
  				700: '#00C2CC',
  				800: '#00ABB3',
  				900: '#009499',
  			},
  			'dark': {
  				50: '#F5F5F5',
  				100: '#EAEAEA', // 标题文字
  				200: '#D4D4D4',
  				300: '#A0AEC0', // 正文/描述文字
  				400: '#718096',
  				500: '#4A5568',
  				600: '#2D3748', // UI元素/容器背景
  				700: '#2A2A2A',
  				800: '#1F1F1F',
  				900: '#1A1A1A', // 主背景
  			},
  			// 保留原有配色作为备用
  			'coral': {
  				50: '#FFF5F3',
  				100: '#FFE8E3',
  				200: '#FFD5CC',
  				300: '#FFB8A5',
  				400: '#FF9470',
  				500: '#FF7F50',
  				600: '#E6663A',
  				700: '#CC4D24',
  				800: '#B3330E',
  				900: '#991A00',
  			},
  			'almond': {
  				50: '#FEFCFA',
  				100: '#FAEBD7',
  				200: '#F5E6D3',
  				300: '#F0E1CF',
  				400: '#EBDCCB',
  				500: '#E6D7C7',
  				600: '#D1C2B3',
  				700: '#BCAD9F',
  				800: '#A7988B',
  				900: '#928377',
  			},
  			'charcoal': {
  				50: '#F5F5F5',
  				100: '#E8E8E8',
  				200: '#DBDBDB',
  				300: '#CECECE',
  				400: '#A8A8A8',
  				500: '#828282',
  				600: '#5C5C5C',
  				700: '#3C3C3C',
  				800: '#2A2A2A',
  				900: '#1A1A1A',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
