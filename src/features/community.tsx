import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Order } from '../contracts'
import { Button, EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { keys } from '../lib/query'
import { useSession } from '../lib/session'
import { AccountSidebar } from './account'
import { Failure, FeatureTitle, LoadingPanel, eth } from './commerce-ui'

const creators = [
  { name: 'Lia Vértice', handle: '@liavertice', initials: 'LV', area: 'Arte generativa', bio: 'Geometria, repetição e encontros inesperados entre cor e código.' },
  { name: 'Caio Prisma', handle: '@caioprisma', initials: 'CP', area: 'Arte 3D', bio: 'Esculturas digitais que exploram luz, matéria e mundos imaginários.' },
  { name: 'Nina Horizonte', handle: '@ninahorizonte', initials: 'NH', area: 'Fotografia', bio: 'Paisagens urbanas e pequenos detalhes que passam despercebidos.' },
  { name: 'Tomás Frequência', handle: '@tomasfrequencia', initials: 'TF', area: 'Música', bio: 'Experimentos sonoros e composições para ouvir com os olhos fechados.' },
  { name: 'Bia Órbita', handle: '@biaorbita', initials: 'BO', area: 'Arte digital', bio: 'Ilustrações de futuros possíveis, natureza e viagens pelo espaço.' },
  { name: 'Ravi Pixel', handle: '@ravipixel', initials: 'RP', area: 'Colecionáveis', bio: 'Personagens e pequenas histórias inspiradas na cultura dos jogos.' },
]

export function CreatorsPage() {
  return <div className="container commerce-page community-page"><FeatureTitle title="Criadores" subtitle="Conheça personagens fictícios do universo Kurio. Perfis ilustrativos, sem fotografias ou coleções vinculadas." />
    <div className="community-grid">{creators.map((creator) => <article className="commerce-card commerce-stack" key={creator.handle}>
      <span className="creator-monogram" aria-hidden>{creator.initials}</span><h2>{creator.name}</h2><p className="commerce-muted">{creator.handle} · {creator.area}</p><p>{creator.bio}</p>
    </article>)}</div><Button asChild><Link to="/" hash="catalogo">Explorar obras do mercado</Link></Button>
  </div>
}

const steps = [
  ['Explore o mercado', 'Use a busca, as categorias, a rede e os filtros de preço para encontrar uma obra. Abra o detalhe e confira criador, descrição, edições e disponibilidade.'],
  ['Escolha uma edição', 'Selecione a edição e a quantidade disponíveis e adicione ao carrinho. A lista de interesse guarda favoritos quando você está conectado.'],
  ['Revise o carrinho', 'Confira quantidades e valores. Experimente o cupom WELCOME10 para um desconto de 10%. O resumo mostra subtotal, desconto e taxa de rede.'],
  ['Entre ou crie sua conta', 'Use collector@example.com com a senha Galeria123! para testar, ou cadastre um perfil fictício. Os itens do carrinho visitante são conciliados com os da conta.'],
  ['Cadastre e conecte uma carteira', 'Em Meu perfil → Carteiras, adicione um endereço fictício: 0x seguido de 40 caracteres hexadecimais. Escolha Ethereum ou Polygon. No checkout, selecione a rede compatível e conecte a carteira simulada.'],
  ['Revise e confirme', 'Preencha os dados do colecionador e revise a cotação antes de enviar. Se preço ou estoque mudar, revise os novos valores. Todo o pagamento é simulado, sem transação ou cobrança real.'],
  ['Acompanhe sua compra', 'O pedido pode ficar pendente, confirmado ou recusado. Consulte Atividade para reabrir o detalhe. Compras confirmadas disponibilizam um comprovante JSON em Arquivos baixados.'],
]
export function LearnPage() {
  return <div className="container commerce-page community-page"><FeatureTitle title="Aprenda" subtitle="Da descoberta da obra ao acompanhamento do pedido: seu primeiro passeio pela Kurio." />
    <ol className="tutorial-steps">{steps.map(([title, text], index) => <li className="commerce-card" key={title}><span className="commerce-pill">Passo {index + 1}</span><h2>{title}</h2><p>{text}</p></li>)}</ol>
    <section className="commerce-card commerce-stack"><h2>Experimente outros resultados</h2><p>No rodapé, abra Cenários de demonstração para simular lentidão, recusa do pagamento ou pedido pendente. Restaurar dados iniciais apaga as alterações locais e reinicia a demonstração.</p><p>O NFT representa um registro digital. Esta demonstração não emite tokens, transfere direitos autorais ou movimenta criptomoedas.</p><Button asChild><Link to="/" hash="catalogo">Começar pelo mercado</Link></Button></section>
  </div>
}

function AccountPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="container commerce-page commerce-account-layout"><AccountSidebar /><section className="commerce-stack"><FeatureTitle title={title} subtitle={subtitle} />{children}</section></div>
}
const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Recusado' }
function Orders({ downloads = false }: { downloads?: boolean }) {
  const session = useSession()
  const query = useQuery({ queryKey: keys.orders(session?.user.id ?? 'anonymous'), queryFn: ({ signal }) => api.get<Order[]>('/orders', signal), enabled: Boolean(session) })
  const orders = query.data?.filter((order) => !downloads || order.status === 'confirmed')
  return <>{query.isPending && <LoadingPanel label="Carregando pedidos" />}{query.isError && <Failure message={query.error.message} retry={() => void query.refetch()} />}
    {orders?.length === 0 && <EmptyState title={downloads ? 'Nenhum comprovante disponível' : 'Nenhuma atividade ainda'} description={downloads ? 'Seus comprovantes aparecem aqui após a confirmação de uma compra.' : 'Suas compras aparecerão aqui. Explore o mercado para começar.'}><Button asChild><Link to="/" hash="catalogo">Explorar mercado</Link></Button></EmptyState>}
    {orders?.map((order) => <article className="commerce-card commerce-stack" key={order.id}><h2>Pedido {order.id}</h2><p>{new Date(order.createdAt).toLocaleString('pt-BR')} · {statusLabels[order.status]}</p><p>{order.quote.items.map((item) => `${item.quantity} × ${item.title}`).join(', ')}</p><p>Total: {eth(order.quote.total)}</p><div className="commerce-actions"><Button asChild variant="secondary"><Link to="/orders/$orderId" params={{ orderId: order.id }}>Ver pedido</Link></Button>{downloads && <Button onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ ambiente: 'Demonstração Kurio — sem valor fiscal', pedido: order }, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `kurio-pedido-${order.id.replace(/[^a-zA-Z0-9_-]/g, '')}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>Baixar comprovante</Button>}</div></article>)}</>
}
export function ActivityPage() { return <AccountPage title="Atividade" subtitle="Histórico de compras da sua conta e andamento dos pedidos."><Orders /></AccountPage> }
export function DownloadsPage() { return <AccountPage title="Arquivos baixados" subtitle="Baixe novamente os comprovantes de compras confirmadas. Os arquivos são gerados sob demanda; não há histórico de downloads nem arquivos originais das obras."><Orders downloads /></AccountPage> }
export function OffersPage() { return <AccountPage title="Ofertas" subtitle="Benefícios disponíveis nesta demonstração."><article className="commerce-card commerce-stack"><span className="commerce-pill">Cupom de demonstração</span><h2>10% de desconto com WELCOME10</h2><p>Aplique o código no carrinho para conferir o desconto no resumo da compra. A taxa de rede é apresentada separadamente.</p><Button asChild><Link to="/cart">Usar no carrinho</Link></Button></article><p className="commerce-muted">Negociação de propostas entre colecionadores e criadores não está disponível nesta versão.</p></AccountPage> }
export function SupportPage() { return <AccountPage title="Suporte" subtitle="Encontre orientações para continuar sua demonstração."><div className="commerce-card commerce-stack">
  <details><summary>Não consigo entrar</summary><p>Use collector@example.com ou curator@example.com com a senha Galeria123!. Se você alterou a senha, use a nova senha ou restaure os dados iniciais pelo rodapé.</p></details>
  <details><summary>Minha carteira não conecta</summary><p>Confira se a rede selecionada no checkout corresponde à carteira e se o cenário wallet-refused está desativado. Use um endereço fictício válido.</p></details>
  <details><summary>O pagamento ficou pendente</summary><p>Abra o pedido em Atividade. No cenário order-pending, use os controles do rodapé para resolver o pedido e aguarde a atualização.</p></details>
  <details><summary>O preço mudou</summary><p>Revise a nova cotação no checkout antes de confirmar. Uma alteração de estoque pode exigir reduzir a quantidade ou remover um item.</p></details>
  <details><summary>Como reiniciar?</summary><p>Use Restaurar dados iniciais no rodapé. Essa ação remove compras, cadastros e alterações locais da demonstração.</p></details>
  <p>Este suporte é um guia local. Não há envio de chamados nesta versão.</p><Button asChild><Link to="/learn">Ver tutorial completo</Link></Button>
</div></AccountPage> }
