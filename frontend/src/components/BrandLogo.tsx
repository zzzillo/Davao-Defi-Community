import logoForDarkTheme from '../assets/brand/ddc-logo-horizontal-dark.svg'
import logoForLightTheme from '../assets/brand/ddc-logo-horizontal-light.svg'

export default function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <>
      <img src={logoForLightTheme} alt="" className={`block dark:hidden ${className}`} />
      <img src={logoForDarkTheme} alt="" className={`hidden dark:block ${className}`} />
    </>
  )
}
