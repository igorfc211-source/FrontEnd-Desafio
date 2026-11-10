import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { scenarios, type MockAction, type Scenario } from '../contracts'
import { api } from '../lib/api'
import { keys, queryClient } from '../lib/query'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Notice } from './ui'

const controls: Array<{ label: string; action: MockAction }> = [
  { label: 'Alterar preço do destaque', action: { type: 'price-change' } },
  { label: 'Esgotar edição do destaque', action: { type: 'sell-out' } },
  { label: 'Repetir último evento', action: { type: 'replay-event', mode: 'duplicate' } },
  { label: 'Enviar evento antigo', action: { type: 'replay-event', mode: 'old' } },
  { label: 'Interromper conexão', action: { type: 'disconnect' } },
  { label: 'Expirar sessão', action: { type: 'expire-session' } },
  { label: 'Recusar favorito uma vez', action: { type: 'reject-favorite' } },
  { label: 'Confirmar pedidos pendentes', action: { type: 'resolve-orders', status: 'confirmed' } },
  { label: 'Recusar pedidos pendentes', action: { type: 'resolve-orders', status: 'declined' } },
]

function ScenarioControls() {
  const queryKey = ['mock-scenario'] as const
  const scenario = useQuery({ queryKey, queryFn: ({ signal }) => api.get<{ scenario: Scenario }>('/__mock/scenario', signal), retry: false })
  const settings = useMutation({
    mutationFn: (input: { scenario: Scenario; reset?: boolean }) => api.post<{ scenario: Scenario }>('/__mock/scenario', input),
    onSuccess: (result, input) => {
      if (input.reset) { location.reload(); return }
      queryClient.setQueryData(queryKey, result)
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== queryKey[0] })
    },
  })
  const action = useMutation({
    mutationFn: (input: MockAction) => api.post('/__mock/action', input),
    onSuccess: (_result, input) => {
      if (input.type === 'expire-session') void queryClient.invalidateQueries({ queryKey: keys.session })
    },
  })
  return <>
    <div className="field"><label htmlFor="mock-scenario">Cenário de rede e pagamento</label>
      <select id="mock-scenario" value={scenario.data?.scenario ?? 'default'} disabled={!scenario.data || settings.isPending}
        onChange={(event) => settings.mutate({ scenario: event.target.value as Scenario })}>
        {scenarios.map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
    <div className="mock-action-grid">
      {controls.map((control) => <Button key={control.label} variant="secondary" disabled={action.isPending} onClick={() => action.mutate(control.action)}>{control.label}</Button>)}
    </div>
    {action.isSuccess && <Notice>Ação enviada à simulação.</Notice>}
    {(settings.error || action.error || scenario.error) && <Notice kind="error">{(settings.error || action.error || scenario.error)?.message}</Notice>}
    <Button variant="danger" disabled={settings.isPending} onClick={() => settings.mutate({ scenario: 'default', reset: true })}>Restaurar dados iniciais</Button>
  </>
}

export function MockTools() {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="ghost" className="mock-tools-trigger"><FlaskConical size={15} /> Cenários de demonstração</Button></DialogTrigger>
    <DialogContent><DialogTitle>Cenários de demonstração</DialogTitle><DialogDescription>Os controles afetam apenas os dados fictícios deste navegador. Restaurar limpa contas criadas, sessão, carrinho e pedidos.</DialogDescription>{open && <ScenarioControls />}</DialogContent>
  </Dialog>
}
