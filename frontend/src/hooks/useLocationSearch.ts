import { useEffect, useState } from 'react'
import { useDebouncedValue } from './useDebouncedValue'

export type Place = { name: string; address: string }

/** Below this many characters a geocoder query returns noise, so do not ask. */
const MIN_QUERY_LENGTH = 3

const RESULT_LIMIT = 6

// Davao. Photon ranks by distance from this point, so local venues come first.
const BIAS_LAT = 7.07
const BIAS_LON = 125.61

type PhotonResponse = {
  features: {
    properties: {
      name?: string
      housenumber?: string
      street?: string
      district?: string
      city?: string
      state?: string
      country?: string
    }
  }[]
}

/** Photon returns address parts separately; the UI wants one readable line. */
function toPlaces(data: PhotonResponse): Place[] {
  return data.features
    .filter((feature) => feature.properties.name)
    .map((feature) => {
      const props = feature.properties
      const address = [
        [props.housenumber, props.street].filter(Boolean).join(' '),
        props.district,
        props.city,
        props.state,
        props.country,
      ]
        .filter(Boolean)
        .join(', ')

      return { name: props.name as string, address }
    })
}

/**
 * Place suggestions for a free-text query, from Photon - a free public geocoder.
 *
 * The event form and the post form ask the same question of the same service,
 * so the request, the debounce and the out-of-order handling live here once
 * rather than being copied into both pages.
 */
export function useLocationSearch(rawQuery: string, delayMs = 400) {
  // The results, tagged with the query they answer.
  //
  // Tagging is what replaces a separate `searching` flag: results whose tag is
  // not the current query are, by definition, still on their way. It also means
  // this hook never has to clear state on the way into the effect - doing that
  // costs a second render pass before the browser paints, and React's linter
  // flags it for exactly that reason.
  const [results, setResults] = useState<{ query: string; places: Place[] }>({
    query: '',
    places: [],
  })

  // Photon is somebody else's server. Ask once typing stops, not per keystroke.
  const query = useDebouncedValue(rawQuery.trim(), delayMs)
  const canSearch = query.length >= MIN_QUERY_LENGTH
  const answersCurrentQuery = results.query === query

  useEffect(() => {
    if (!canSearch) return

    // Responses can arrive out of order. Aborting the previous request keeps
    // the list showing an answer to the query actually in the box.
    const controller = new AbortController()

    async function search() {
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?limit=${RESULT_LIMIT}&lat=${BIAS_LAT}&lon=${BIAS_LON}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        )
        const data = (await response.json()) as PhotonResponse

        setResults({ query, places: toPlaces(data) })
      } catch {
        // An abort lands here too. Recording an empty answer for a query nobody
        // is waiting on any more would blank a list the next response is about
        // to fill, so only a genuine failure counts as "no locations".
        if (!controller.signal.aborted) setResults({ query, places: [] })
      }
    }

    search()

    return () => controller.abort()
  }, [canSearch, query])

  return {
    /** The query is long enough to be worth asking about. */
    canSearch,
    /** A request for the current query is still outstanding. */
    searching: canSearch && !answersCurrentQuery,
    /** Suggestions for the current query - empty until they answer it. */
    places: canSearch && answersCurrentQuery ? results.places : [],
  }
}
