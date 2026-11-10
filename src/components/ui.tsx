import type { ComponentProps, ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import * as Primitive from '@radix-ui/react-dialog'
import { cva } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva('button inline-flex items-center justify-center gap-2', {
  variants: { variant: { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost', danger: 'button-danger' } },
  defaultVariants: { variant: 'primary' },
})

export function Button({ asChild, variant, className, type = 'button', ...props }: ComponentProps<'button'> & {
  asChild?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const Component = asChild ? Slot : 'button'
  return <Component {...(!asChild && { type })} className={twMerge(buttonVariants({ variant }), className)} {...props} />
}

export const Dialog = Primitive.Root
export const DialogTrigger = Primitive.Trigger
export const DialogClose = Primitive.Close
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description

export function DialogContent({ children, className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal>
    <Primitive.Overlay className="dialog-overlay" />
    <Primitive.Content className={twMerge('dialog-content', className)} {...props}>
      {children}
      <Primitive.Close asChild><Button className="dialog-close icon-button" variant="ghost" aria-label="Fechar"><X size={20} /></Button></Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={twMerge('skeleton', className)} aria-hidden="true" {...props} />
}

export function Notice({ kind = 'info', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const Icon = kind === 'error' ? CircleAlert : kind === 'success' ? CircleCheck : Info
  return <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}><Icon size={18} aria-hidden /><div>{children}</div></div>
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <section className="empty-state"><h2>{title}</h2>{description && <p>{description}</p>}{children}</section>
}

export function LoadingError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <div className="loading-error"><Notice kind="error">{error instanceof Error ? error.message : 'Não foi possível carregar os dados.'}</Notice>
    {onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
  </div>
}
