import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const outputDirectory = process.argv[2]

if (!outputDirectory || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/prerender-landing.mjs <vite-output-directory>')
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
  const { renderLandingMarkup } = await server.ssrLoadModule('/src/landing-server.tsx')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const assetUrls = new Map(
    Object.entries(manifest)
      .filter(([source, entry]) => source.startsWith('src/assets/') && entry.file)
      .map(([source, entry]) => [`/${source}`, `/${entry.file}`]),
  )
  const streamedMarkup = await renderLandingMarkup()
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

  await writeFile(outputPath, html.replace(mountPoint, `<div id="root">${markup}</div>`))
  process.stdout.write(`Pre-rendered landing HTML: ${outputPath}\n`)
} finally {
  await server.close()
}
