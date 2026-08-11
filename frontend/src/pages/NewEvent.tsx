import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'

type Theme = {
  name: string
  pattern: React.CSSProperties
}

const themes: Theme[] = [
  {
    name: 'Minimal',
    pattern: { backgroundColor: '#ededed' },
  },
  {
    name: 'Quantum',
    pattern: {
      backgroundColor: '#e6e6e6',
      backgroundImage: 'radial-gradient(circle, #a8a8a8 1.5px, transparent 1.5px)',
      backgroundSize: '18px 18px',
    },
  },
  {
    name: 'Warp',
    pattern: {
      backgroundColor: '#e9e9e9',
      backgroundImage:
        'repeating-linear-gradient(45deg, #c4c4c4 0px, #c4c4c4 2px, transparent 2px, transparent 14px)',
    },
  },
  {
    name: 'Emoji',
    pattern: {
      backgroundColor: '#ececec',
      backgroundImage:
        'linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%), linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%)',
      backgroundSize: '24px 24px',
      backgroundPosition: '0 0, 12px 12px',
    },
  },
  {
    name: 'Confetti',
    pattern: {
      backgroundColor: '#e8e8e8',
      backgroundImage:
        'radial-gradient(circle, #9e9e9e 1px, transparent 1px), radial-gradient(circle, #c0c0c0 1.5px, transparent 1.5px), radial-gradient(circle, #b0b0b0 1px, transparent 1px)',
      backgroundSize: '28px 28px, 36px 36px, 22px 22px',
      backgroundPosition: '0 0, 14px 10px, 8px 20px',
    },
  },
  {
    name: 'Pattern',
    pattern: {
      backgroundColor: '#eaeaea',
      backgroundImage:
        'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 10px, #c8c8c8 10px, #c8c8c8 12px)',
      backgroundSize: '48px 48px',
    },
  },
  {
    name: 'Seasonal',
    pattern: {
      backgroundColor: '#e7e7e7',
      backgroundImage:
        'repeating-linear-gradient(90deg, #cccccc 0px, #cccccc 6px, transparent 6px, transparent 20px)',
    },
  },
]

const optionRowClass = 'flex items-center gap-2.5 rounded-lg bg-surface-low px-3 py-2'
const optionSelectClass =
  'ml-auto max-w-[45%] cursor-pointer bg-transparent text-right text-sm font-medium text-on-surface-variant focus:outline-none'

export default function NewEvent() {
  const navigate = useNavigate()
  const [themeIndex, setThemeIndex] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [color, setColor] = useState('Default')
  const [style, setStyle] = useState('—')
  const [font, setFont] = useState('Default')
  const [display, setDisplay] = useState('Auto')

  const theme = themes[themeIndex]

  function shuffleTheme() {
    setThemeIndex((current) => {
      const next = Math.floor(Math.random() * (themes.length - 1))
      return next >= current ? next + 1 : next
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Back to Events
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-xl border border-outline"
            style={theme.pattern}
          >
            <button
              type="button"
              aria-label="Upload event image"
              className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-float transition-colors hover:bg-surface-low"
            >
              <Icon name="image" className="text-[20px]" />
            </button>
          </div>

          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen((open) => !open)}
              className="flex flex-1 items-center gap-3 rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-left transition-colors hover:bg-surface-low"
            >
              <span
                className="h-9 w-12 shrink-0 rounded border border-outline"
                style={theme.pattern}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] font-medium text-muted">Theme</span>
                <span className="truncate text-sm font-semibold text-on-surface">{theme.name}</span>
              </span>
              <Icon name="unfold_more" className="ml-auto text-[18px] text-muted" />
            </button>
            <button
              type="button"
              aria-label="Shuffle theme"
              onClick={shuffleTheme}
              className="flex w-[52px] items-center justify-center rounded-lg border border-outline bg-surface-lowest text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              <Icon name="shuffle" className="text-[20px]" />
            </button>
          </div>

          {drawerOpen && (
            <div className="flex flex-col gap-4 rounded-xl border border-outline bg-surface-lowest p-4 shadow-float">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {themes.map((option, index) => (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setThemeIndex(index)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={`h-12 w-16 rounded-lg border border-outline ${
                        index === themeIndex ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-lowest' : ''
                      }`}
                      style={option.pattern}
                    />
                    <span
                      className={`text-xs ${
                        index === themeIndex
                          ? 'font-bold text-on-surface'
                          : 'font-medium text-on-surface-variant'
                      }`}
                    >
                      {option.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className={optionRowClass}>
                  <span className="h-4 w-4 shrink-0 rounded-full border border-outline-strong bg-surface-highest" />
                  <span className="text-sm font-medium text-on-surface">Color</span>
                  <select
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>Default</option>
                    <option>Gray</option>
                    <option>Contrast</option>
                  </select>
                </label>
                <label className={optionRowClass}>
                  <Icon name="texture" className="shrink-0 text-[18px] text-on-surface-variant" />
                  <span className="text-sm font-medium text-on-surface">Style</span>
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>{'—'}</option>
                    <option>Soft</option>
                    <option>Sharp</option>
                  </select>
                </label>
                <label className={optionRowClass}>
                  <span className="shrink-0 text-sm font-semibold text-on-surface-variant">Ag</span>
                  <span className="text-sm font-medium text-on-surface">Font</span>
                  <select
                    value={font}
                    onChange={(event) => setFont(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>Default</option>
                    <option>Serif</option>
                    <option>Mono</option>
                  </select>
                </label>
                <label className={optionRowClass}>
                  <Icon name="contrast" className="shrink-0 text-[18px] text-on-surface-variant" />
                  <span className="text-sm font-medium text-on-surface">Display</span>
                  <select
                    value={display}
                    onChange={(event) => setDisplay(event.target.value)}
                    className={optionSelectClass}
                  >
                    <option>Auto</option>
                    <option>Light</option>
                    <option>Dark</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Event Name"
            className="w-full bg-transparent text-4xl font-bold tracking-tight text-on-surface placeholder:text-surface-dim focus:outline-none"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1 rounded-xl border border-outline bg-surface-lowest px-4 py-2">
              <span className="absolute bottom-[26px] left-[21px] top-[26px] w-px bg-outline-strong" />
              <div className="flex items-center gap-3 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-on-surface-variant" />
                <span className="text-sm font-medium text-on-surface">Start</span>
                <div className="ml-auto flex items-center gap-1">
                  <input
                    type="date"
                    defaultValue="2026-08-11"
                    className="rounded-md bg-surface-low px-2 py-1 text-sm text-on-surface focus:outline-none"
                  />
                  <input
                    type="time"
                    defaultValue="17:30"
                    className="rounded-md bg-surface-low px-2 py-1 text-sm text-on-surface focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full border border-outline-strong bg-surface-lowest" />
                <span className="text-sm font-medium text-on-surface">End</span>
                <div className="ml-auto flex items-center gap-1">
                  <input
                    type="date"
                    defaultValue="2026-08-11"
                    className="rounded-md bg-surface-low px-2 py-1 text-sm text-on-surface focus:outline-none"
                  />
                  <input
                    type="time"
                    defaultValue="18:30"
                    className="rounded-md bg-surface-low px-2 py-1 text-sm text-on-surface focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col justify-center gap-1 rounded-xl border border-outline bg-surface-lowest px-4 py-3 sm:w-36">
              <Icon name="globe" className="text-[18px] text-on-surface-variant" />
              <span className="text-sm font-medium text-on-surface">GMT+08:00</span>
              <span className="text-xs text-muted">Manila</span>
            </div>
          </div>

          <label className="flex cursor-text items-start gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 transition-colors focus-within:border-outline-strong">
            <Icon name="location_on" className="mt-0.5 text-[20px] text-on-surface-variant" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-on-surface">Add Event Location</span>
              <input
                type="text"
                placeholder="Offline location or virtual link"
                className="w-full bg-transparent text-sm text-on-surface placeholder:text-muted focus:outline-none"
              />
            </span>
          </label>

          <label className="flex cursor-text items-start gap-3 rounded-xl border border-outline bg-surface-lowest px-4 py-3 transition-colors focus-within:border-outline-strong">
            <Icon name="notes" className="mt-0.5 text-[20px] text-on-surface-variant" />
            <textarea
              rows={3}
              placeholder="Add Description"
              className="w-full resize-none bg-transparent text-sm text-on-surface placeholder:text-muted focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => navigate('/events')}
            className="w-full rounded-lg bg-transparent hover:bg-btn py-3 text-base font-semibold text-on-surface transition-colors"
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  )
}
