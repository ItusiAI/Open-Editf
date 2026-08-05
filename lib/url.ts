const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
const locales = ['en', 'zh']

export function getFullUrl(path: string, locale?: string) {
  const localePrefix = locale ? `/${locale}` : ''
  return `${baseUrl}${localePrefix}${path}`
}

export function getAlternateLinks(path: string) {
  return locales.reduce((acc, locale) => {
    acc[locale] = getFullUrl(path, locale)
    return acc
  }, {} as Record<string, string>)
}
