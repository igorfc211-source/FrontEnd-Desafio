# Kurio Marketplace

Marketplace demonstrativo de arte digital. A aplicação reúne descoberta, detalhe, favoritos, carrinho, checkout com carteira simulada, pedido, login, cadastro, perfil e gestão de carteiras.

## Executar

Use Node.js 22.13 ou superior e npm. A simulação usa Service Worker e funciona em HTTPS ou em localhost.

```sh
npm ci
npm run dev
```

| Comando | Uso |
| --- | --- |
| `npm run dev` | Aplicação local com HMR |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run build` | Tipos e build de produção em `dist/` |
| `npm run preview` | Preview do build |
| `npx playwright install chromium` | Instalação do navegador de testes |
| `npm run test:e2e` | Fluxos, responsividade e regressão visual |
| `npm run test:visual` | Somente regressão visual |
| `npm run test:report` | Relatório HTML da última execução local |
| `npm run audit` | Lighthouse no build de produção |

O frontend usa React, TypeScript, TanStack Router, TanStack Query, Axios, Socket.IO Client, Tailwind CSS e primitivas shadcn/ui adaptadas. MSW serve REST e intercepta WebSocket. Playwright e Lighthouse produzem as evidências de validação.

### Configuração

- `VITE_ENABLE_MOCKS` vem ativo por padrão. Defina como `false` para apontar para uma implementação compatível de REST e Socket.IO.
- `VITE_API_BASE_URL` tem valor padrão `/api`. Com mocks ativos, use esse caminho na mesma origem.
- `VITE_SOCKET_URL` tem valor padrão igual à origem atual. Mantenha esse padrão no modo de demonstração.
- `PLAYWRIGHT_BASE_URL` e `LIGHTHOUSE_BASE_URL` são opcionais para validar um servidor existente.
- `PLAYWRIGHT_BROWSERS_PATH` pode apontar para uma instalação compartilhada de Chromium. `CHROME_PATH` seleciona o executável usado na auditoria.

### Contas e cupons fictícios

| Conta | E-mail | Senha |
| --- | --- | --- |
| Alex Martins | `collector@example.com` | `Galeria123!` |
| Sofia Nunes | `curator@example.com` | `Galeria123!` |

A conta de Alex tem carteiras em Ethereum e Polygon. O cupom `WELCOME10` concede 10% e `EXPIRED10` reproduz expiração. Qualquer outro código desconhecido retorna erro de cupom inválido.

## Demonstração de falhas

Use **Cenários de demonstração** no rodapé. A troca de cenário preserva o estado. **Restaurar dados iniciais** limpa a base simulada, sessão e rascunhos de checkout. Os testes partem de contextos Chromium isolados.

| Cenário | Efeito |
| --- | --- |
| `default` | Catálogo e confirmação de pagamento |
| `empty` | Listagem vazia |
| `slow`, `out-of-order` | Skeletons e latência fora de ordem |
| `offline`, `timeout`, `server-error` | Falha de rede, timeout e HTTP 503 |
| `validation-error`, `wallet-refused` | Falha de validação e conexão de carteira recusada |
| `payment-declined` | Pedido recusado com carrinho preservado |
| `order-timeout` | Pedido criado e resposta interrompida |
| `order-pending` | Pedido aguarda resolução explícita |

Para simular cotação desatualizada, adicione a edição **1/50** de **Emerald Ape #042**, entre no checkout, conecte a carteira e revise. No rodapé, selecione **Alterar preço do destaque** ou **Esgotar edição do destaque**. Observe o catálogo, o carrinho e o resumo da compra com os dados atualizados.

Para observar recuperação, selecione `order-pending`, envie a compra e use **Interromper conexão**. Resolva o pedido e aguarde reconexão ou recarregue a página. Para verificar isolamento, teste com as duas contas e compare os favoritos.

Para verificar outros erros, tente cadastrar `collector@example.com`, aplique `EXPIRED10` no carrinho ou use **Expirar sessão** com o checkout aberto. Em `order-timeout`, a compra é registrada antes da interrupção da resposta e a interface recupera o pedido da mesma tentativa.

O painel e o Playwright chamam os mesmos endpoints de controle. Para automatizar cenários adicionais, consulte [ARCHITECTURE.md](ARCHITECTURE.md).

## Evidências

- `tests/baselines/` reúne as referências de início, detalhe, carrinho e pagamento em desktop, tablet e mobile. A atualização deliberada das referências usa `npm run test:visual -- --update-snapshots`.
- [Relatório Playwright da entrega](audit-reports/playwright.html). Novas execuções geram `playwright-report/index.html` e guardam traces de falhas em `test-results/`.
- Execute `npm run build` antes de `npm run audit`. A configuração está em `scripts/lighthouse.mjs` e os relatórios individuais HTML e JSON e as medianas ficam em `audit-reports/`.
- A [matriz de rastreabilidade](ARCHITECTURE.md#rastreabilidade) relaciona requisitos, código e testes.

## Publicação

O Sites usa um repositório gerenciado com autenticação. O deploy oferece em `/kurio-source.zip` um snapshot do mesmo commit, incluindo o lockfile, os testes e os relatórios.

O projeto inclui rewrite de SPA para Vercel e `public/_redirects` para Netlify e Cloudflare Pages. Em um projeto Vercel, importe o repositório, escolha Vite, use `npm run build` e publique `dist/` na raiz do domínio. Mantenha `VITE_ENABLE_MOCKS=true` para avaliação. Verifique a abertura e o refresh de `/nft/chromatic-echoes` e `/checkout`, o escopo de `/mockServiceWorker.js` e o cenário de compra pendente.

## Referência visual

O export oficial fornecido pelo usuário orientou a reconstrução das telas desktop e mobile da Kurio. As quatro obras recorrentes e os ícones disponíveis foram extraídos do material exportado. A documentação registra as adaptações para os fluxos simulados e o uso de IBM Plex Mono como aproximação tipográfica. [Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1) · [Origem dos assets](ARTWORK.md) · [Decisões de interface](ARCHITECTURE.md#interface-e-referência)
