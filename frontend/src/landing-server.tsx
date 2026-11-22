import { PassThrough } from 'node:stream'
import { prerenderToNodeStream } from 'react-dom/static'
import { StaticRouter } from 'react-router-dom'
import App from './App'
import { setPrerenderSnapshot, type LandingSnapshot } from './services/landingSnapshot'

export { embeddedSnapshotScript, parseLandingSnapshot } from './services/landingSnapshot'

/** Render the landing route without running browser effects or backend requests. */
export async function renderLandingMarkup(snapshot?: LandingSnapshot): Promise<string> {
  setPrerenderSnapshot(snapshot)
  let rendered
  try {
    rendered = await prerenderToNodeStream(
      <StaticRouter location="/">
        <App />
      </StaticRouter>,
      {
        // React moves any finished Suspense boundary over this many bytes
        // (default 12,800) out of place - a placeholder plus a hidden copy
        // swapped in by inline scripts - so a streamed shell can paint early.
        // A static file gains nothing from that, and it hides the content from
        // crawlers that do not run scripts, so keep every section inline.
        progressiveChunkSize: Number.POSITIVE_INFINITY,
      },
    )
  } finally {
    setPrerenderSnapshot(undefined)
  }
  const { prelude, postponed } = rendered
  if (postponed) throw new Error('Landing prerender unexpectedly postponed content')

  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    const chunks: string[] = []

    output.setEncoding('utf8')
    output.on('data', (chunk: string) => chunks.push(chunk))
    output.once('error', reject)
    output.once('end', () => resolve(chunks.join('')))
    prelude.pipe(output)
  })
}
