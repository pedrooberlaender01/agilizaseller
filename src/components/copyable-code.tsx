'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  code: string
  label?: string | null
  className?: string
  size?: 'xs' | 'sm'
  monoOnly?: boolean
}

export function CopyableCode({ code, label, className, size = 'xs', monoOnly = false }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }

  const codeSize = size === 'xs' ? 'text-[10px]' : 'text-xs'

  if (monoOnly || !label) {
    return (
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copiado!' : `Copiar ${code}`}
        className={cn(
          'group inline-flex items-center gap-1 font-mono text-zinc-500 hover:text-zinc-300 transition-colors',
          codeSize,
          className,
        )}
      >
        <span className="truncate">{code}</span>
        <span
          className={cn(
            'material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity',
            copied && 'opacity-100 text-emerald-400',
          )}
        >
          {copied ? 'check' : 'content_copy'}
        </span>
      </button>
    )
  }

  return (
    <div className={cn('flex flex-col gap-0.5 min-w-0', className)}>
      <span className="text-zinc-50 text-xs truncate">{label}</span>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copiado!' : `Copiar ${code}`}
        className={cn(
          'group inline-flex items-center gap-1 font-mono text-zinc-500 hover:text-zinc-300 transition-colors w-fit max-w-full',
          codeSize,
        )}
      >
        <span className="truncate">{code}</span>
        <span
          className={cn(
            'material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
            copied && 'opacity-100 text-emerald-400',
          )}
        >
          {copied ? 'check' : 'content_copy'}
        </span>
      </button>
    </div>
  )
}
