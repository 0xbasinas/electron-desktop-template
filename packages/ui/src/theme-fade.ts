const FADE_MS = 250

/**
 * Run `change` (which switches the theme) while colours fade instead of jumping. The `theme-fade` class
 * (see theme.css) only lives for the length of the fade, so ordinary hover effects are not slowed down.
 * People who ask for less motion get the instant switch.
 */
export function fadeThemeChange(change: () => void): void {
  const root = document.documentElement
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  if (reduce) {
    change()
    return
  }
  root.classList.add('theme-fade')
  change()
  window.setTimeout(() => root.classList.remove('theme-fade'), FADE_MS + 50)
}
