/**
 * React's view of the partners API.
 *
 * Thin on purpose, and thinner than the other three. Everything hard - the
 * out-of-order request guard, the effect key, the token handling, the
 * in-flight flags - lives once in useApiResource.ts. What remains here is
 * naming: which service function, and what the returned collection is called.
 *
 * The fourth module to be built this way, and the cheapest: no draft filtering
 * to thread through, no by-slug variant, no second response shape.
 */

import { useCallback } from 'react'

import type { ApiError } from '../services/api'
import {
  createPartner,
  deletePartner,
  getPartner,
  listPartners,
  updatePartner,
} from '../services/partnerService'
import type {
  PartnerCreatePayload,
  PartnerListParams,
  PartnerResponse,
  PartnerUpdatePayload,
} from '../types/partner'
import { useApiItem, useApiList, useAuthedAction } from './useApiResource'

export type UsePartnersResult = {
  partners: PartnerResponse[]
  total: number
  page: number
  hasNext: boolean
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** A page of partners, alphabetical, kept in sync with `params`. */
export function usePartners(params: PartnerListParams = {}): UsePartnersResult {
  // listPartners is a module-level import, so its identity is stable and the
  // effect inside useApiList cannot loop on it.
  const { items, ...rest } = useApiList(listPartners, params)

  return { partners: items, ...rest }
}

export type UsePartnerResult = {
  partner: PartnerResponse | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}

/** One partner by id. Pass null or undefined while the id is still unknown. */
export function usePartner(id: string | null | undefined): UsePartnerResult {
  const { item, ...rest } = useApiItem(getPartner, id)

  return { partner: item, ...rest }
}

export type UsePartnerActionsResult = {
  create: (payload: PartnerCreatePayload) => Promise<PartnerResponse>
  update: (id: string, payload: PartnerUpdatePayload) => Promise<PartnerResponse>
  remove: (id: string) => Promise<void>
  saving: boolean
  error: ApiError | null
  clearError: () => void
}

/**
 * The three writes, with the token and the in-flight flag handled once.
 *
 * Each action records the error and rethrows it, so a caller can both show the
 * shared banner and decide whether to navigate away - which matters here for
 * the 409: a name collision should leave the official on the form with their
 * typing intact, so they can change one word rather than start again.
 */
export function usePartnerActions(): UsePartnerActionsResult {
  const { run, saving, error, clearError } = useAuthedAction()

  const create = useCallback(
    (payload: PartnerCreatePayload) => run((token) => createPartner(payload, token)),
    [run],
  )

  const update = useCallback(
    (id: string, payload: PartnerUpdatePayload) =>
      run((token) => updatePartner(id, payload, token)),
    [run],
  )

  const remove = useCallback(
    (id: string) => run((token) => deletePartner(id, token)),
    [run],
  )

  return { create, update, remove, saving, error, clearError }
}
