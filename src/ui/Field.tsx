import type { ReactNode } from 'react'

interface Props {
  label: ReactNode
  /** Help text between the label and the control. */
  hint?: ReactNode
  /** A label around one control (default), or a fieldset with a legend around a group of controls. */
  as?: 'label' | 'fieldset'
  className?: string
  children: ReactNode
}

/** A labelled control, or a labelled group of controls. */
export function Field({ label, hint, as = 'label', className, children }: Props) {
  const classes = className ? `field ${className}` : 'field'
  const hintText = hint && <p className="muted">{hint}</p>
  if (as === 'fieldset') {
    return (
      <fieldset className={classes}>
        <legend>{label}</legend>
        {hintText}
        {children}
      </fieldset>
    )
  }
  return (
    <label className={classes}>
      <span>{label}</span>
      {hintText}
      {children}
    </label>
  )
}
