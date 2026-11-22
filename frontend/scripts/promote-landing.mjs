/**
 * Make the prerendered landing page the file Vercel serves for "/".
 *
 * Vercel serves a matching static file before it applies vercel.json rewrites,
 * and "/" always matches index.html. So a "/" -> "/landing.html" rewrite never
 * runs: the site root got the empty app shell, and the prerendered landing page
 * (content, home metadata, structured data) never reached a visitor or crawler.
 *
 * After the build this renames:
 *   index.html   -> app.html     (the app shell; vercel.json's catch-all rewrites to it)
 *   landing.html -> index.html   (served for "/" as a plain file)
 *
 * Usage: node scripts/promote-landing.mjs <vite-output-directory>
 */
import { access, readFile, rename } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = process.argv[2]
if (!outputDirectory || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/promote-landing.mjs <vite-output-directory>')
}

const dist = path.resolve(process.cwd(), outputDirectory)
const shell = path.join(dist, 'index.html')
const landing = path.join(dist, 'landing.html')
const app = path.join(dist, 'app.html')

await access(shell)
await access(landing)

// Refuse to ship a landing page the prerender did not fill: "/" would then be
// an empty shell that hydrates as the wrong entry.
const landingHtml = await readFile(landing, 'utf8')
if (landingHtml.includes('<div id="root"></div>')) {
  throw new Error(`${landing} was not prerendered; run scripts/prerender-landing.mjs first`)
}

await rename(shell, app)
await rename(landing, shell)
process.stdout.write(`Landing page promoted: ${shell} (app shell: ${app})\n`)
