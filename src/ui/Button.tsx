import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  /** Full width and taller: a screen's main action. */
  block?: boolean
}

/** A button. Defaults to `type="button"`, so only an explicit `type="submit"` submits a form. */
export function Button({ variant = 'secondary', block = false, type = 'button', className, ...rest }: Props) {
  const classes = [variant !== 'secondary' && variant, block && 'block', className].filter(Boolean).join(' ')
  return <button type={type} className={classes || undefined} {...rest} />
}
