# Arquitetura do marketplace

## Organização

| Camada | Responsabilidade |
| --- | --- |
| `src/router.tsx` | Rotas com carregamento por tela, parâmetros de busca e guard de sessão |
| `src/features/` | Descoberta, compra, conta e formulários |
| `src/components/` | Estrutura, primitivas de interface, diálogos Radix, controles e feedback de eventos |
| `src/lib/` | Axios, sessão, opções de consulta e chaves de cache |
| `src/contracts.ts` | DTOs, erros, eventos e cenários compartilhados |
| `src/mocks/` | Handlers MSW, regras, armazenamento transacional e servidor Socket.IO simulado |

## REST

Todos os caminhos estão sob `/api`. Respostas normais são JSON. Operações privadas exigem `Authorization: Bearer <token>`. O visitante pode acessar catálogo e carrinho. Validação, sessão, permissão, recurso inexistente, conflito e indisponibilidade usam 422, 401, 403, 404, 409 e 503 conforme a operação. O envelope de erro é `{ code, message, fields?, details? }`.

| Método e caminho | Entrada e retorno |
| --- | --- |
| GET `/nfts` | `q`, `category`, `availability`, `network`, `minPrice`, `maxPrice`, `featuredOnly`, `sort`, `page` → `CatalogPage` com destaques e contagens de coleção/rede |
| GET `/nfts/:slug` | Obra com galeria, edições, preço, estoque, rede, metadados e versão → `Nft` |
| GET `/session` | Sessão válida ou `null` sem bearer. Token inválido ou expirado retorna 401 |
| POST `/session/login`, `/session/register` | `LoginInput` ou `RegisterInput` → `Session`. Cadastro duplicado retorna 409 |
| POST `/session/logout` | Revoga a sessão |
| GET `/favorites`, PUT e DELETE `/favorites/:id` | Consulta e alteração → lista de IDs |
| GET `/cart`, POST `/cart/items` | Consulta ou adição com `CartItemInput` → `Cart` |
| PUT e DELETE `/cart/items/:id` | `{quantity}` ou remoção → `Cart` |
| PUT `/cart/coupon` | `{code: string \| null}` → `Cart` |
| POST `/quote` | `{network}` → `Quote` com itens, desconto, taxa e total |
| POST `/orders` | `CreateOrderInput` + cabeçalho `Idempotency-Key` → `Order` |
| GET `/orders`, `/orders/:id`, `/orders/attempt/:key` | Lista, pedido por ID ou recuperação da tentativa da conta |
| GET e PATCH `/profile` | Consulta ou `ProfileInput` → `Profile` |
| PUT `/profile/password` | `PasswordInput` |
| GET e POST `/wallets`, PUT `/wallets/:id` | Lista, criação e atualização com `WalletInput` |
| POST e DELETE `/wallets/:id/connect` | Autoriza ou desconecta carteira da sessão. POST recebe `{network}` |
| GET e POST `/__mock/scenario` | Consulta ou `{scenario, reset?}` para configuração e restauração |
| POST `/__mock/action` | `MockAction` para reproduzir falhas ou mudanças de estado |

Ações de controle incluem `expire-session`, `reject-favorite`, `reject-wallet`, `price-change`, `sell-out`, `expire-coupon`, `change-network-fee`, `replay-event`, `disconnect` e `resolve-orders`. Alterações de NFT aceitam `nftId` e `editionId`. `price-change` aceita `price` decimal, `change-network-fee` aceita `network` e `fee`, `disconnect` aceita `duration` em milissegundos, `replay-event` aceita `mode`, e `resolve-orders` aceita `status`. A tabela de cenários e exemplos estão no [README.md](README.md).

## Sessão, carrinho e cache

A simulação mantém base persistente em `localStorage`. Web Locks serializa transações entre abas e a fila local cobre navegadores sem suporte. As credenciais persistem como PBKDF2-SHA256 com sal individual. Tokens aleatórios duram seis horas. O cliente mantém o token em `sessionStorage`, onde sobrevive ao refresh e pertence à aba. A integração é demonstrativa. A base local e os controles de cenários podem ser alterados por quem opera o navegador.

O guard verifica a sessão pela API e encaminha ao login com a rota relativa original. Em 401, a sessão só é encerrada se o token da resposta ainda for o atual. Trocas de sessão cancelam queries privadas, limpam cache e mutations e encerram subscriptions. Rascunhos e tentativas de checkout são separados por conta.

As consultas têm frescor de 20 segundos por padrão e coleta após cinco minutos. A sessão tem 30 segundos de frescor. GETs consomem o sinal de cancelamento do TanStack Query. Os filtros usam a URL e suas chaves guardam todos os parâmetros. Leituras de falha transitória têm uma nova tentativa automática e mutations exigem recuperação explícita. Favoritos são atualizados de modo otimista com snapshot e rollback. Mutações reconciliam os recursos dependentes por invalidação.

O catálogo retorna as contagens de coleções e redes da base corrente e os destaques independentemente da filtragem. As faixas de preço mantêm o valor decimal da URL durante o parsing e a API compara o intervalo com Decimal.js. As redes Ethereum, Polygon e Solana representam metadados do catálogo. O simulador de checkout aceita as redes Ethereum e Polygon, que são selecionadas a partir das carteiras cadastradas.

O carrinho visitante é compartilhado pela base local. No login ou cadastro, o servidor associa itens e cupom à conta, conciliando o limite de estoque. As edições são identificadas por obra e edição. O resumo é sempre calculado pelo mock REST. Pedidos recusados preservam os itens. Confirmação debita as quantidades compradas, preservando os demais itens.

## Precisão e pedidos

Os DTOs trafegam strings decimais de ETH. Aritmética Decimal.js mantém a precisão de até 18 casas e as quantidades são inteiras. A cotação é identificada por hash SHA-256 de itens, versões, disponibilidade, cupom efetivo, rede, taxas e totais. Na criação, a operação refaz a cotação sob a mesma transação da reserva. Se algo mudou, devolve 409 e a interface exige revisão. Uma conexão de carteira válida na sessão é exigida na mesma operação.

O cliente salva a tentativa antes de enviar. Clique repetido é bloqueado e timeout preserva a chave e o corpo da tentativa. A mesma conta e chave retornam o pedido existente quando o conteúdo é idêntico e retornam 409 quando difere. Um pedido pendente reserva estoque. A recusa libera a reserva. A confirmação gera referência de transação fictícia, cujo explorador é exibido em um diálogo. Pedido e recibo leem o snapshot de compra com as taxas, o desconto, os itens e a carteira originais.

## Tempo real

O navegador inicia MSW antes de carregar a aplicação. REST usa Service Worker. Para o canal em tempo real, o interceptor WebSocket do MSW usa `toSocketIo` de `@mswjs/socket.io-binding@0.2.0`. O cliente força transporte `websocket` no namespace padrão. A simulação usa frames textuais de Engine.IO/Socket.IO e heartbeat. Long polling, namespaces adicionais, binários e acknowledgements ficam fora do transporte da demonstração. O handler MSW 2.15 usa a origem como seletor, pois remove o caminho de transporte durante o matching, e verifica `/socket.io/` ao receber a conexão.

| Evento | Envelope e efeito |
| --- | --- |
| `nft.updated` | `{eventId,nftId,version}` → invalida listagem, detalhe, carrinho e cotação e avisa sobre item afetado |
| `order.updated` | `{eventId,orderId,userId,version,status}` → invalida pedidos, carrinho e cotação para a sessão autorizada |
| `session.subscribe` | Cliente informa bearer ou `null` para vincular a conexão à sessão no servidor simulado |

Versões no cache REST e maior versão por recurso descartam eventos antigos ou repetidos. Estados terminais de pedido não regridem. Em reconexão, os recursos ativos são reconciliados por REST. O pedido pendente também pode ser recuperado pelo ID, pela chave de tentativa ou pelo checkout e tem consulta periódica como recuperação. `BroadcastChannel` sincroniza sinais entre abas da mesma origem. O simulador não sincroniza instalações em dispositivos distintos.

## Interface e referência

O export PNG oficial guiou a estrutura desktop e mobile, a marca Kurio, a paleta marrom e cobre, o texto de apresentação e as artes recorrentes. Como o arquivo exportado contém os pixels das telas, os valores de tipografia e espaçamento foram estimados visualmente. IBM Plex Mono é distribuída localmente como aproximação da fonte monoespaçada da referência.

As artes de `public/art/` são recortes do export, codificados em WebP. A galeria oferece enquadramentos da mesma arte. O catálogo inclui registros fictícios adicionais para exercitar filtros e paginação, reutilizando a coleção visual. Os nomes de criadores ausentes no export são dados demonstrativos. A autenticação, as conexões de carteira e os estados de erro seguem os fluxos do desafio com controles e feedback próprios. Os elementos editoriais, de suporte e de autenticação social do export estão fora do escopo funcional. [Origem dos assets](ARTWORK.md)

No checkout mobile, o formulário do colecionador aparece antes das carteiras para permitir a conferência dos dados antes da revisão. O seletor de ordenação do catálogo fica disponível abaixo das abas, e a galeria mantém miniaturas operáveis no mobile.

Os alvos de toque têm 44 px nos controles principais. Há foco visível, link de salto, associação de erros a campos, alternativas textuais, status acessível e gerenciamento de foco por Radix. Skeletons reservam espaço para a mídia e respeitam redução de movimento. A interface é em português.

## Rastreabilidade

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Busca, filtros, ordenação, paginação e histórico | `catalog.tsx`, `lib/catalog.ts`, Router | `catalog.spec.ts` |
| Acesso direto, galeria, estoque e inexistência | `nft.tsx`, handlers de NFT | `catalog.spec.ts` |
| Favorito privado e rollback | `nft.tsx`, cache por conta | `catalog.spec.ts` |
| Cadastro, sessão, expiração, logout e troca de conta | `account.tsx`, `session.ts`, guard e handlers | `account.spec.ts`, `catalog.spec.ts` |
| Perfil, avatar, senha e carteiras | `account.tsx`, handlers de conta | `account.spec.ts` |
| Carrinho, quantidade, cupons e persistência | `cart.tsx`, `mocks/` | `commerce.spec.ts` |
| Carteira e rede, revisão, confirmação e recibo | `checkout.tsx`, regras de pedido | `commerce.spec.ts` |
| Recusa, clique repetido, timeout e recuperação | `checkout.tsx`, pedidos e chave por conta | `commerce.spec.ts` |
| Cotações obsoletas e atualizações Socket.IO | `realtime.tsx`, `mocks/socket.ts`, handlers | `commerce.spec.ts` |
| Eventos antigos, duplicados e desconexão | Versão por recurso, WebSocket e reconciliação REST | `commerce.spec.ts` |
| Teclado, foco, shimmer, falhas e recuperação | Primitivas shadcn/ui, CSS, cache e cenários | `layout.spec.ts`, `catalog.spec.ts`, `account.spec.ts` |
| 390, 768 e 1440 px, quatro telas de referência | CSS responsivo e baselines | `layout.spec.ts`, `tests/baselines/` |
| Auditorias de início e detalhe no build | `scripts/lighthouse.mjs` | `audit-reports/` |
