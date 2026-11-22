import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'

// Article dates are instants, so the day shown depends on the time zone.
// Prerender in the community's own zone, so crawlers and most visitors see the
// same date the browser renders; elsewhere React re-renders that card on load.
process.env.TZ = process.env.LANDING_PRERENDER_TZ?.trim() || 'Asia/Manila'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const outputDirectory = process.argv[2]

if (!outputDirectory || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/prerender-landing.mjs <vite-output-directory>')
}

/**
 * The published landing snapshot is rendered into the HTML so crawlers and the
 * first paint see real events, articles and partners. It is the same public
 * file the browser fetches. Set LANDING_PRERENDER_SNAPSHOT_URL to override it,
 * or to "off" to prerender placeholders only. A failed or invalid fetch never
 * fails the build: the page is prerendered with placeholders, as before.
 */
const SNAPSHOT_URL = process.env.LANDING_PRERENDER_SNAPSHOT_URL?.trim()
  || 'https://api.davaodeficommunity.com/landing/v1/snapshot.json'

async function fetchPublishedSnapshot(parseLandingSnapshot) {
  if (SNAPSHOT_URL === 'off') return undefined
  try {
    const response = await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const snapshot = parseLandingSnapshot(await response.json())
    if (!snapshot) throw new Error('invalid snapshot format')
    return snapshot
  } catch (error) {
    process.stderr.write(`Landing snapshot not prerendered (${SNAPSHOT_URL}): ${error.message}\n`)
    return undefined
  }
}

const outputPath = path.resolve(process.cwd(), outputDirectory, 'landing.html')
const manifestPath = path.resolve(process.cwd(), outputDirectory, '.vite/manifest.json')
const server = await createServer({
  root: projectRoot,
  configFile: path.join(projectRoot, 'vite.config.ts'),
  server: { middlewareMode: true, watch: { ignored: ['**'] } },
  appType: 'custom',
})

try {
  const { renderLandingMarkup, parseLandingSnapshot, embeddedSnapshotScript } = await server.ssrLoadModule('/src/landing-server.tsx')
  const snapshot = await fetchPublishedSnapshot(parseLandingSnapshot)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const assetUrls = new Map(
    Object.entries(manifest)
      .filter(([source, entry]) => source.startsWith('src/assets/') && entry.file)
      .map(([source, entry]) => [`/${source}`, `/${entry.file}`]),
  )
  const streamedMarkup = await renderLandingMarkup(snapshot)
  const markup = streamedMarkup.replace(/\/src\/assets\/[^\s"'<>]+/g, (source) => {
    const normalized = source.replace(/\?.*$/, '')
    const assetUrl = assetUrls.get(normalized)
    if (!assetUrl) throw new Error(`No production asset found for ${source}`)
    return assetUrl
  })
  const html = await readFile(outputPath, 'utf8')
  const mountPoint = '<div id="root"></div>'
  const count = html.split(mountPoint).length - 1

  if (count !== 1) {
    throw new Error(`Expected one empty #root mount point in ${outputPath}; found ${count}`)
  }

  let document = html.replace(mountPoint, () => `<div id="root">${markup}</div>`)
  if (snapshot) {
    if (document.split('</head>').length !== 2) throw new Error(`Expected one </head> in ${outputPath}`)
    document = document.replace('</head>', () => `${embeddedSnapshotScript(snapshot)}</head>`)
  }
  await writeFile(outputPath, document)
  process.stdout.write(`Pre-rendered landing HTML${snapshot ? ' with the published snapshot' : ''}: ${outputPath}\n`)
} finally {
  await server.close()
}
