import type { HTMLAttributes, ReactNode } from 'react'
import { Button } from './Button'

export interface SegmentedOption<T> {
  value: T
  label: ReactNode
}

interface Props<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SegmentedOption<T>[]
  /** The pressed option, if any. */
  value: T | undefined
  onChange: (value: T) => void
}

/**
 * A row of toggle buttons, one pressed at a time. The pressed style comes from `aria-pressed`.
 * `className` sets the layout (default `segmented`); other attributes, such as a `role` and
 * `aria-label` when there's no fieldset around it, go on the wrapper.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className = 'segmented',
  ...rest
}: Props<T>) {
  return (
    <div className={className} {...rest}>
      {options.map((option) => (
        <Button
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
