import type { HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLElement> {
  /** The element to render: a section by default, a list item in a list, or a form. */
  as?: 'section' | 'li' | 'form'
}

/** A surface that groups related content. */
export function Card({ as: Tag = 'section', className, ...rest }: Props) {
  return <Tag className={className ? `card ${className}` : 'card'} {...rest} />
}
