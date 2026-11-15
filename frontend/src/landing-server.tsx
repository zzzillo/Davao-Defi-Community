import { PassThrough } from 'node:stream'
import { prerenderToNodeStream } from 'react-dom/static'
import { StaticRouter } from 'react-router-dom'
import App from './App'

/** Render the landing route without running browser effects or backend requests. */
export async function renderLandingMarkup(): Promise<string> {
  const { prelude, postponed } = await prerenderToNodeStream(
    <StaticRouter location="/">
      <App />
    </StaticRouter>,
  )
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
