import type { LandingSnapshot } from '../services/landingSnapshot'
import bitskwela from '../assets/landing-partners/3e03ef6c-9fec-44a7-a944-ec92afaa6512.webp?no-inline'
import certik from '../assets/landing-partners/4190996e-8a68-4178-8a29-97f380734ee3.webp?no-inline'
import base from '../assets/landing-partners/7bbf99a2-7777-4a1d-940f-b782d4b34f38.webp?no-inline'
import ethereumFoundation from '../assets/landing-partners/6cac625e-69eb-4e82-94a1-88b237cb6d7b.webp?no-inline'
import geodeLabs from '../assets/landing-partners/0ca9d315-15c8-4ef1-95f5-ec87ec237db4.webp?no-inline'
import hackatsuon from '../assets/landing-partners/182f0844-f0c8-464e-a4b8-e24054d2b155.webp?no-inline'
import ideas from '../assets/landing-partners/c5455ff9-8640-4100-b08e-69a36155f1f4.webp?no-inline'
import daer from '../assets/landing-partners/b9a2286a-3436-4596-9dc4-bc14e9ea555a.webp?no-inline'
import lisk from '../assets/landing-partners/2e2d92d5-f3f6-4bb4-b3b1-1c251b93cb6f.webp?no-inline'
import openai from '../assets/landing-partners/1f59af78-6b62-48ff-a521-ddc3256eb2e7.webp?no-inline'
import protocolCamp from '../assets/landing-partners/c8f7fa42-d0d5-4b29-aadb-4a153a02c857.webp?no-inline'
import solana from '../assets/landing-partners/26fafea0-58b1-4391-ac7d-71ed328cce33.webp?no-inline'
import sonic from '../assets/landing-partners/dde84bbc-d3fd-4d8b-9371-4d600454caec.webp?no-inline'
import stellar from '../assets/landing-partners/0abf7dcc-6e26-437e-a899-5f29faacae36.webp?no-inline'
import stripe from '../assets/landing-partners/b31f7804-6071-4750-a432-5cecbf3d450c.webp?no-inline'

const localLogos: Readonly<Record<string, string>> = {
  '3e03ef6c-9fec-44a7-a944-ec92afaa6512': bitskwela,
  '4190996e-8a68-4178-8a29-97f380734ee3': certik,
  '7bbf99a2-7777-4a1d-940f-b782d4b34f38': base,
  '6cac625e-69eb-4e82-94a1-88b237cb6d7b': ethereumFoundation,
  '0ca9d315-15c8-4ef1-95f5-ec87ec237db4': geodeLabs,
  '182f0844-f0c8-464e-a4b8-e24054d2b155': hackatsuon,
  'c5455ff9-8640-4100-b08e-69a36155f1f4': ideas,
  'b9a2286a-3436-4596-9dc4-bc14e9ea555a': daer,
  '2e2d92d5-f3f6-4bb4-b3b1-1c251b93cb6f': lisk,
  '1f59af78-6b62-48ff-a521-ddc3256eb2e7': openai,
  'c8f7fa42-d0d5-4b29-aadb-4a153a02c857': protocolCamp,
  '26fafea0-58b1-4391-ac7d-71ed328cce33': solana,
  'dde84bbc-d3fd-4d8b-9371-4d600454caec': sonic,
  '0abf7dcc-6e26-437e-a899-5f29faacae36': stellar,
  'b31f7804-6071-4750-a432-5cecbf3d450c': stripe,
}

function localPartner(id: string, name: string): LandingSnapshot['partners'][number] {
  return { id, name, image: { src: localLogos[id], variants: [] } }
}

export const LANDING_PARTNER_FALLBACKS: LandingSnapshot['partners'] = [
  localPartner('3e03ef6c-9fec-44a7-a944-ec92afaa6512', 'Bitskwela'),
  localPartner('4190996e-8a68-4178-8a29-97f380734ee3', 'CertiK'),
  localPartner('7bbf99a2-7777-4a1d-940f-b782d4b34f38', 'Base'),
  localPartner('6cac625e-69eb-4e82-94a1-88b237cb6d7b', 'Ethereum Foundation'),
  localPartner('0ca9d315-15c8-4ef1-95f5-ec87ec237db4', 'Geode Labs'),
  localPartner('182f0844-f0c8-464e-a4b8-e24054d2b155', 'Hackatsuon'),
  localPartner('c5455ff9-8640-4100-b08e-69a36155f1f4', 'IDEAS'),
  localPartner('b9a2286a-3436-4596-9dc4-bc14e9ea555a', 'DAER'),
  localPartner('2e2d92d5-f3f6-4bb4-b3b1-1c251b93cb6f', 'Lisk'),
  localPartner('1f59af78-6b62-48ff-a521-ddc3256eb2e7', 'OpenAI'),
  localPartner('c8f7fa42-d0d5-4b29-aadb-4a153a02c857', 'Protocol Camp'),
  localPartner('26fafea0-58b1-4391-ac7d-71ed328cce33', 'Solana'),
  localPartner('dde84bbc-d3fd-4d8b-9371-4d600454caec', 'Sonic'),
  localPartner('0abf7dcc-6e26-437e-a899-5f29faacae36', 'Stellar (Light Logo)'),
  localPartner('b31f7804-6071-4750-a432-5cecbf3d450c', 'Stripe'),
]

export function useLocalPartnerLogos(snapshot: LandingSnapshot): LandingSnapshot {
  return {
    ...snapshot,
    partners: snapshot.partners
      .filter((partner) => Boolean(localLogos[partner.id]))
      .slice(0, 15)
      .map((partner) => ({
        ...partner,
        image: { src: localLogos[partner.id], variants: [] },
      })),
  }
}
