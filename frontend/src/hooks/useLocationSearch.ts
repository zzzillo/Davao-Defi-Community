import { useEffect, useState } from 'react'
import { useDebouncedValue } from './useDebouncedValue'

export type Place = { name: string; address: string }

/** Below this many characters a geocoder query returns noise, so do not ask. */
const MIN_QUERY_LENGTH = 3

const RESULT_LIMIT = 6
const PHOTON_TIMEOUT_MS = 2_500
const REQUEST_TIMEOUT_MS = 10_000

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

type OpenMeteoResponse = {
  results?: {
    name: string
    country?: string
    admin1?: string
    admin2?: string
    admin3?: string
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

function toOpenMeteoPlaces(data: OpenMeteoResponse): Place[] {
  return (data.results ?? []).map((result) => {
    const address = [...new Set([
      result.admin3,
      result.admin2,
      result.admin1,
      result.country,
    ].filter((part): part is string => Boolean(part?.trim())))].join(', ')

    return { name: result.name, address }
  })
}

async function searchPhoton(query: string, signal: AbortSignal): Promise<Place[]> {
  const controller = new AbortController()
  const abortWithParent = () => controller.abort()
  signal.addEventListener('abort', abortWithParent)
  const timeout = window.setTimeout(() => controller.abort(), PHOTON_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?limit=${RESULT_LIMIT}&lat=${BIAS_LAT}&lon=${BIAS_LON}&q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
    if (!response.ok) throw new Error(`Photon returned ${response.status}`)
    const data = (await response.json()) as PhotonResponse
    return toPlaces(data)
  } finally {
    window.clearTimeout(timeout)
    signal.removeEventListener('abort', abortWithParent)
  }
}

async function searchOpenMeteo(query: string, signal: AbortSignal): Promise<Place[]> {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=${RESULT_LIMIT}&language=en&format=json&name=${encodeURIComponent(query)}`,
    { signal },
  )
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`)
  const data = (await response.json()) as OpenMeteoResponse
  return toOpenMeteoPlaces(data)
}

/**
 * Venue suggestions from Photon, with Open-Meteo/GeoNames as a fallback for
 * place names when Photon is unavailable or has no matching results.
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
  const [results, setResults] = useState<{
    query: string
    places: Place[]
    error: boolean
    source: 'photon' | 'open-meteo' | null
  }>({
    query: '',
    places: [],
    error: false,
    source: null,
  })

  // These are third-party services. Ask once typing stops, not per keystroke.
  const query = useDebouncedValue(rawQuery.trim(), delayMs)
  const canSearch = query.length >= MIN_QUERY_LENGTH
  const answersCurrentQuery = results.query === query

  useEffect(() => {
    if (!canSearch) return

    // Responses can arrive out of order. Aborting the previous request keeps
    // the list showing an answer to the query actually in the box.
    const controller = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      setResults({ query, places: [], error: true, source: null })
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    async function search() {
      try {
        let places: Place[] = []
        let source: 'photon' | 'open-meteo' = 'photon'

        try {
          places = await searchPhoton(query, controller.signal)
        } catch {
          if (controller.signal.aborted) throw new Error('Location search aborted')
        }

        // Photon contains venue-level points of interest. If it is unavailable
        // or has no matches, use the place-name geocoder so the control still
        // returns useful cities and administrative areas.
        if (places.length === 0) {
          places = await searchOpenMeteo(query, controller.signal)
          source = 'open-meteo'
        }

        setResults({ query, places, error: false, source })
      } catch {
        // An abort lands here too. Recording an empty answer for a query nobody
        // is waiting on any more would blank a list the next response is about
        // to fill. A timeout is the exception: it belongs to this current
        // query and must stop the UI from remaining in the searching state.
        if (!controller.signal.aborted || timedOut) {
          setResults({ query, places: [], error: true, source: null })
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    search()

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [canSearch, query])

  return {
    /** The query is long enough to be worth asking about. */
    canSearch,
    /** A request for the current query is still outstanding. */
    searching: canSearch && !answersCurrentQuery,
    /** Suggestions for the current query - empty until they answer it. */
    places: canSearch && answersCurrentQuery ? results.places : [],
    /** A current query failed or timed out. */
    error: canSearch && answersCurrentQuery && results.error,
    /** Open-Meteo/GeoNames names need their data attribution shown. */
    usedFallback: canSearch && answersCurrentQuery && results.source === 'open-meteo',
  }
}
