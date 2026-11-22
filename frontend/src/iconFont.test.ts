/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Material Symbols stylesheet in index.html and landing.html requests only
 * the icons this app renders (`icon_names=`), which cuts the font from ~3.9 MB
 * to ~10 KB. An icon missing from that list renders as its name in plain text,
 * so this test fails when source code uses an icon the font does not include.
 *
 * When it fails: add the icon to `icon_names` in BOTH HTML files, keeping the
 * list in alphabetical order (Google Fonts requires it).
 */

const FRONTEND = join(__dirname, '..')
const SRC = __dirname

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function fontIconNames(htmlFile: string): string[] {
  const html = readFileSync(join(FRONTEND, htmlFile), 'utf8')
  const match = html.match(/Material\+Symbols\+Outlined[^"]*[?&]icon_names=([a-z0-9_,]+)/)
  if (!match) throw new Error(`${htmlFile} does not request a Material Symbols subset`)
  return match[1].split(',')
}

/** Icon names as the code declares them: <Icon name=...>, `icon: '...'` items, and the activity map. */
export function iconNamesInSource(): Set<string> {
  const names = new Set<string>()
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const tag of source.matchAll(/<Icon\b[\s\S]*?\/>/g)) {
      const attribute = tag[0].match(/name=(?:"([^"]+)"|\{([\s\S]*?)\}\s*(?:className|\/>))/)
      if (attribute?.[1]) names.add(attribute[1])
      // Literals compared against (`status === 'active' ? ...`) are not icon names.
      for (const literal of attribute?.[2]?.matchAll(/(?<![=!]==\s*)'([a-z0-9_]+)'/g) ?? []) names.add(literal[1])
    }
    for (const item of source.matchAll(/\bicon:\s*'([a-z0-9_]+)'/g)) names.add(item[1])
  }
  const activity = readFileSync(join(SRC, 'utils/activityLog.ts'), 'utf8')
  const resourceIcons = activity.match(/const RESOURCE_ICONS[^{]*\{([\s\S]*?)\}/)?.[1] ?? ''
  for (const value of resourceIcons.matchAll(/:\s*'([a-z0-9_]+)'/g)) names.add(value[1])
  for (const fallback of activity.matchAll(/RESOURCE_ICONS\[[^\]]+\]\s*\?\?\s*'([a-z0-9_]+)'/g)) names.add(fallback[1])
  return names
}

describe('Material Symbols subset', () => {
  const landing = fontIconNames('landing.html')
  const app = fontIconNames('index.html')

  it('requests the same sorted icon list in both HTML shells', () => {
    expect(app).toEqual(landing)
    expect(app).toEqual([...app].sort())
  })

  it('includes every icon the source code renders', () => {
    const missing = [...iconNamesInSource()].filter((name) => !app.includes(name)).sort()
    expect(missing).toEqual([])
  })
})
