import { siDiscord, siGithub, siInstagram, siTelegram, siX } from 'simple-icons'
import mikaPortrait from '../assets/contributors/mika.jpg'
import paoloPortrait from '../assets/contributors/paolo.jpg'
import ariellePortrait from '../assets/contributors/arielle.jpg'
import julesPortrait from '../assets/contributors/jules.jpg'
import samPortrait from '../assets/contributors/sam.jpg'
import kaiPortrait from '../assets/contributors/kai.jpg'
import beaPortrait from '../assets/contributors/bea.jpg'
import noelPortrait from '../assets/contributors/noel.jpg'

export const socialIcons = {
  discord: siDiscord.path,
  github: siGithub.path,
  instagram: siInstagram.path,
  telegram: siTelegram.path,
  x: siX.path,
}

export type SocialNetwork = keyof typeof socialIcons
export type SocialLink = { network: SocialNetwork; url: string }

export type Contributor = {
  slug: string
  name: string
  alias: string
  position: string
  bio: string
  contributions: string[]
  socials: SocialLink[]
  photo: string
  blogCreatorId?: string
}

export const contributors: Contributor[] = [
  { slug: 'mika-reyes', name: 'Mika Reyes', alias: '@mika.reyes', position: 'Community Organizer', bio: 'Brings local builders together and turns good conversations into community projects.', contributions: ['Organized monthly builder meetups.', 'Welcomed new members and connected them with project teams.'], socials: [{ network: 'x', url: 'https://x.com/mika_reyes' }, { network: 'instagram', url: 'https://instagram.com/mika.reyes' }], photo: mikaPortrait, blogCreatorId: 'demo-mika' },
  { slug: 'paolo-santos', name: 'Paolo Santos', alias: '@paolobuilds', position: 'Protocol Builder', bio: 'Explores onchain tools and shares practical lessons with developers getting started.', contributions: ['Built sample smart contracts for workshops.', 'Helped review beginner community projects.'], socials: [{ network: 'github', url: 'https://github.com/paolobuilds' }, { network: 'x', url: 'https://x.com/paolobuilds' }], photo: paoloPortrait, blogCreatorId: 'demo-paolo' },
  { slug: 'arielle-cruz', name: 'Arielle Cruz', alias: '@ariellecreates', position: 'Content Creator', bio: 'Makes Web3 ideas easier to understand through community stories and event recaps.', contributions: ['Created event recap posts and community stories.', 'Made onboarding guides easier to follow.'], socials: [{ network: 'instagram', url: 'https://instagram.com/ariellecreates' }, { network: 'x', url: 'https://x.com/ariellecreates' }], photo: ariellePortrait, blogCreatorId: 'demo-arielle' },
  { slug: 'jules-navarro', name: 'Jules Navarro', alias: '@jules.codes', position: 'Developer Advocate', bio: 'Supports local developers through workshops, project reviews, and technical guidance.', contributions: ['Led hands-on developer workshops.', 'Mentored teams during project reviews.'], socials: [{ network: 'github', url: 'https://github.com/julescodes' }, { network: 'discord', url: 'https://discord.com' }], photo: julesPortrait },
  { slug: 'sam-dela-pena', name: 'Sam Dela Peña', alias: '@sam.events', position: 'Event Volunteer', bio: 'Helps make community gatherings welcoming and easy for first-time attendees to join.', contributions: ['Supported event setup and registration.', 'Helped first-time attendees feel welcome.'], socials: [{ network: 'instagram', url: 'https://instagram.com/sam.events' }, { network: 'telegram', url: 'https://t.me/samevents' }], photo: samPortrait },
  { slug: 'kai-mendoza', name: 'Kai Mendoza', alias: '@kai.onchain', position: 'Research Contributor', bio: 'Looks into emerging protocols and brings thoughtful research to community discussions.', contributions: ['Shared research notes on emerging protocols.', 'Presented ecosystem updates at community sessions.'], socials: [{ network: 'x', url: 'https://x.com/kaionchain' }, { network: 'telegram', url: 'https://t.me/kaionchain' }], photo: kaiPortrait },
  { slug: 'bea-villanueva', name: 'Bea Villanueva', alias: '@beav.design', position: 'Designer', bio: 'Creates clear, friendly visuals for announcements, events, and community initiatives.', contributions: ['Designed event announcements and social graphics.', 'Created reusable visuals for community initiatives.'], socials: [{ network: 'instagram', url: 'https://instagram.com/beav.design' }, { network: 'x', url: 'https://x.com/beavdesign' }], photo: beaPortrait },
  { slug: 'noel-garcia', name: 'Noel Garcia', alias: '@noelbuilds', position: 'Community Builder', bio: 'Connects students and new builders with people, learning resources, and ways to contribute.', contributions: ['Connected student groups with local builders.', 'Shared learning resources for new contributors.'], socials: [{ network: 'github', url: 'https://github.com/noelbuilds' }, { network: 'discord', url: 'https://discord.com' }], photo: noelPortrait },
]
