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
  const [dark, setDark] = useState(false)
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    let savedDark = false
    try {
      savedDark = localStorage.getItem(STORAGE_KEY) === 'dark'
    } catch {
      // Theme preference is optional when browser storage is unavailable.
    }
    setDark(savedDark)
    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!themeReady) return
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
    } catch {
      // The in-memory theme still works when browser storage is unavailable.
    }

    if (root.classList.contains('theme-switching')) {
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
    }
  }, [dark, themeReady])

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-switching')
    setDark((value) => !value)
  }

  return { dark, toggleTheme }
}
