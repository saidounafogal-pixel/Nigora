import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cx } from '../lib/utils'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass rounded-[28px] p-4', className)}>{children}</div>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md' | 'lg' }
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3.5 text-base',
        variant === 'primary' && 'bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand-dark',
        variant === 'secondary' && 'bg-white/10 text-white ring-1 ring-white/10 backdrop-blur hover:bg-white/15',
        variant === 'ghost' && 'text-white/70 hover:bg-white/10',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        variant === 'success' && 'bg-white text-black hover:bg-white/90',
        className,
      )}
    />
  )
}

export function ButtonLink({ to, children, variant = 'primary', className }: { to: string; children: ReactNode; variant?: BtnProps['variant']; className?: string }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[.98]',
        variant === 'primary' && 'bg-brand text-white',
        variant === 'secondary' && 'bg-white/10 text-white ring-1 ring-white/10',
        variant === 'success' && 'bg-white text-black',
        variant === 'ghost' && 'text-white/70',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder-white/30 outline-none [color-scheme:dark] focus:border-brand focus:ring-2 focus:ring-brand/25'
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={2} {...p} className={cx(inputCls, p.className)} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 py-2 text-left">
      <span className={cx('mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition', checked ? 'bg-brand' : 'bg-white/15')}>
        <span className={cx('h-5 w-5 rounded-full bg-white shadow transition', checked && 'translate-x-5')} />
      </span>
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="block text-xs text-white/40">{hint}</span>}
      </span>
    </button>
  )
}

export function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'green' | 'orange' | 'red' | 'blue' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        tone === 'stone' && 'bg-white/10 text-white/70',
        tone === 'green' && 'bg-emerald-400/15 text-emerald-300',
        tone === 'orange' && 'bg-brand text-white',
        tone === 'red' && 'bg-red-500/20 text-red-300',
        tone === 'blue' && 'bg-sky-400/15 text-sky-300',
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {back && (
        <Link to={back} className="glass mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" aria-label="Retour">
          <ChevronLeft size={20} />
        </Link>
      )}
      <div className="flex-1">
        <h1 className="text-[28px] font-bold leading-[1.05] tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center glass rounded-[28px] px-6 py-10 text-center">
      <div className="mb-3 text-brand">{icon}</div>
      <p className="text-lg font-bold text-white">{title}</p>
      {text && <p className="mt-1 text-sm text-white/50">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
