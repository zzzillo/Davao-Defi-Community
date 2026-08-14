const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

type TimePickerProps = {
  value: number
  onChange: (minutes: number) => void
}

export default function TimePicker({ value, onChange }: TimePickerProps) {
  const hour24 = Math.floor(value / 60)
  const minute = value % 60
  const isPM = hour24 >= 12
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  function setHour(h12: number) {
    onChange(((h12 % 12) + (isPM ? 12 : 0)) * 60 + minute)
  }

  function setMinute(m: number) {
    onChange(hour24 * 60 + m)
  }

  function setPeriod(pm: boolean) {
    onChange(((hour24 % 12) + (pm ? 12 : 0)) * 60 + minute)
  }

  const item = (selected: boolean) =>
    `mx-auto flex h-9 w-11 shrink-0 items-center justify-center rounded-md text-sm transition-colors ${
      selected
        ? 'bg-surface-highest font-bold text-on-surface'
        : 'text-on-surface-variant hover:bg-surface-low'
    }`

  return (
    <div className="flex">
      <div className="scrollbar-hide flex max-h-60 flex-1 flex-col gap-1 overflow-y-auto p-1">
        {HOURS.map((h) => (
          <button key={h} type="button" onClick={() => setHour(h)} className={item(h === hour12)}>
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>
      <div className="scrollbar-hide flex max-h-60 flex-1 flex-col gap-1 overflow-y-auto border-l border-outline p-1">
        {MINUTES.map((m) => (
          <button key={m} type="button" onClick={() => setMinute(m)} className={item(m === minute)}>
            {String(m).padStart(2, '0')}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1 border-l border-outline p-1">
        <button type="button" onClick={() => setPeriod(false)} className={item(!isPM)}>
          AM
        </button>
        <button type="button" onClick={() => setPeriod(true)} className={item(isPM)}>
          PM
        </button>
      </div>
    </div>
  )
}
