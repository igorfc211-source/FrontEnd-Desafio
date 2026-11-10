import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import type { Eth, Totals } from '../contracts'
import { Notice, Skeleton } from '../components/ui'
import './commerce.css'

export function FeatureTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <header className="commerce-heading">
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {children}
  </header>
}

export function CommerceBreadcrumb({ current }: { current: string }) {
  return <nav className="commerce-breadcrumb" aria-label="Localização">
    <Link to="/">Início</Link><span aria-hidden>/</span>
    <Link to="/" hash="catalogo">Mercado</Link><span aria-hidden>/</span>
    <span aria-current="page">{current}</span>
  </nav>
}

export function Field({ label, error, hint, hideLabel, trailing, id: customId, ...props }: ComponentProps<'input'> & {
  label: string
  error?: string
  hint?: string
  hideLabel?: boolean
  trailing?: ReactNode
}) {
  const fieldId = useId()
  const id = customId ?? fieldId
  return <div className="commerce-field">
    <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
    <div className={trailing ? 'commerce-field-trailing' : undefined}>
      <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />
      {trailing}
    </div>
    {error ? <span id={`${id}-error`} className="commerce-field-error">{error}</span>
      : hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}

export function PasswordField(props: ComponentProps<typeof Field>) {
  const [visible, setVisible] = useState(false)
  return <Field {...props} type={visible ? 'text' : 'password'} trailing={
    <button type="button" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${props.label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>
      {visible ? <Eye size={17} aria-hidden /> : <EyeOff size={17} aria-hidden />}
    </button>
  } />
}

export function SelectField({ label, children, hint, error, ...props }: ComponentProps<'select'> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return <div className="commerce-field">
    <label htmlFor={id}>{label}</label>
    <select {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>{children}</select>
    {error ? <span id={`${id}-error`} className="commerce-field-error">{error}</span> : hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>
}

export function eth(value: Eth) {
  return `${value.replace('.', ',')} ETH`
}

export function OrderSummary({ totals, children, title = 'Resumo do pedido', label = title, leading }: { totals?: Totals; children?: ReactNode; title?: string; label?: string; leading?: ReactNode }) {
  return <section className="commerce-card commerce-summary" aria-label={label} aria-busy={!totals}>
    <h2>{title}</h2>
    {leading}
    {totals ? <dl className="commerce-total-list">
      <div><dt>Subtotal</dt><dd>{eth(totals.subtotal)}</dd></div>
      <div><dt>Desconto</dt><dd>{totals.discount === '0' ? eth('0') : `−${eth(totals.discount)}`}</dd></div>
      <div><dt>Taxa de rede</dt><dd>{eth(totals.networkFee)}</dd></div>
      <div className="commerce-total"><dt>Total</dt><dd>{eth(totals.total)}</dd></div>
    </dl> : <div className="commerce-summary-loading" role="status" aria-label="Carregando resumo do pedido">
      <Skeleton className="commerce-summary-line" /><Skeleton className="commerce-summary-line" />
      <Skeleton className="commerce-summary-line" /><Skeleton className="commerce-summary-line" />
    </div>}
    {children}
  </section>
}

export function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return <div>
    <Notice kind="error">{message}</Notice>
    {retry && <button className="commerce-text-button" type="button" onClick={retry}>Tentar novamente</button>}
  </div>
}

export function Feedback({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <Notice kind={success ? 'success' : 'info'}>{children}</Notice>
}

export function LoadingPanel({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="commerce-card commerce-stack">
    <Skeleton className="commerce-load-title" />
    <Skeleton className="commerce-load-field" />
    <Skeleton className="commerce-load-field" />
  </div>
}
