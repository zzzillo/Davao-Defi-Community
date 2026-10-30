import { useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'

/**
 * Dark mode, remembered.
 *
 * Tailwind's dark variant keys off a class on <html>, which is a single global
 * - so this reads and writes that one element rather than holding a value any
 * particular component owns.
 *
 * Extracted from the admin Topbar because the public site needs the same
 * preference. Two copies would mean two writers of one localStorage key, and
 * they would drift the first time either changed.
 */
export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE_KEY) === 'dark')

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')

    if (root.classList.contains('theme-switching')) {
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
    }
  }, [dark])

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-switching')
    setDark((value) => !value)
  }

  return { dark, toggleTheme }
}
