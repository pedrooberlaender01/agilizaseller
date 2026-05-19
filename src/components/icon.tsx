type IconProps = {
  name: string
  filled?: boolean
  className?: string
  size?: number
}

export function Icon({ name, filled = false, className = '', size }: IconProps) {
  const style: React.CSSProperties = {
    fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
    ...(size ? { fontSize: `${size}px` } : {}),
  }
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  )
}
