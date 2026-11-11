# Kurio Marketplace — documentação para apresentação

## 1. Visão geral

A Kurio é um marketplace demonstrativo de arte digital e NFTs. O projeto apresenta descoberta de obras, seleção de edições, carrinho, autenticação, carteiras e acompanhamento de compras. O objetivo é demonstrar uma experiência completa de frontend com regras de negócio, persistência local e atualização de estado em tempo real.

Toda compra ocorre em uma simulação no navegador. Não há cobrança, emissão de tokens, integração com blockchain, transferência de direitos autorais ou backend de produção.

## 2. Experiência e identidade visual

A interface adota fundo escuro, detalhes em tons de cobre, tipografia IBM Plex Mono e destaque para as obras. A navegação se adapta a desktop e dispositivos móveis. Formulários possuem rótulos, validação e mensagens de erro; os diálogos utilizam primitivas Radix. Os perfis da página Criadores usam monogramas, sem fotografias.

O material de referência e a origem das imagens estão em [ARTWORK.md](ARTWORK.md). As decisões técnicas detalhadas estão em [ARCHITECTURE.md](ARCHITECTURE.md).

## 3. Mapa de funcionalidades

| Área | Acesso | O que oferece |
| --- | --- | --- |
| Início e Mercado | Público, `/` | Destaques, busca, filtros, ordenação e paginação |
| Obra | Público, `/nft/$slug` | Galeria, detalhes, edições, estoque e adição ao carrinho |
| Criadores | Público, `/creators` | Seis personagens fictícios, especialidades e biografias; sem coleções vinculadas |
| Aprenda | Público, `/learn` | Tutorial em sete passos e explicação da simulação |
| Carrinho | Público, `/cart` | Quantidades, remoção, cupom e totais |
| Entrar e Cadastro | Público | Autenticação fictícia, criação de conta e retorno à página original |
| Checkout | Privado, `/checkout` | Dados do colecionador, rede, conexão simulada de carteira e cotação |
| Pedido | Privado, `/orders/$orderId` | Estado, resumo e referência de transação fictícia |
| Dados do perfil | Privado, `/profile` | Dados pessoais, avatar e alteração de senha |
| Carteiras | Privado, `/wallets` | Cadastro e edição, carteira principal e secundárias |
| Lista de interesse | Privado, `/favorites` | Obras favoritas da conta |
| Atividade | Privado, `/activity` | Pedidos reais da base simulada da conta e acesso aos detalhes |
| Ofertas | Privado, `/offers` | Cupom WELCOME10 e acesso ao carrinho |
| Arquivos baixados | Privado, `/downloads` | Geração de comprovantes JSON para pedidos confirmados |
| Suporte | Privado, `/support` | Perguntas frequentes e link para o tutorial |

As opções do perfil seguem a sequência da referência: Dados do perfil, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte e Sair. As carteiras mantêm o formulário de cadastro e edição em diálogo.

## 4. Execução local

Pré-requisitos: Node.js 22.13 ou superior e npm.

```sh
npm ci
npm run dev
```

Abra a URL informada pelo Vite no terminal. A porta padrão é 5173; quando ocupada, o servidor escolhe outra. O Service Worker exige localhost ou HTTPS.

Comandos disponíveis:

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Desenvolvimento com atualização automática |
| `npm run build` | Verificação de tipos e geração de `dist/` |
| `npm run preview` | Servir o build localmente |
| `npm run typecheck` | Verificação TypeScript |
| `npm run lint` | Análise ESLint |
| `npm run test:e2e` | Testes Playwright existentes |
| `npm run test:visual` | Testes visuais existentes |
| `npm run test:report` | Relatório Playwright |
| `npm run audit` | Auditoria Lighthouse do build |

## 5. Contas e dados de demonstração

| Perfil | E-mail | Senha inicial |
| --- | --- | --- |
| Alex Martins | collector@example.com | Galeria123! |
| Sofia Nunes | curator@example.com | Galeria123! |

As senhas podem ser alteradas durante a demonstração. Restaurar dados iniciais recupera os dados de origem e apaga alterações locais.

Criadores fictícios acrescentados: Lia Vértice (arte generativa), Caio Prisma (arte 3D), Nina Horizonte (fotografia), Tomás Frequência (música), Bia Órbita (arte digital) e Ravi Pixel (colecionáveis). São conteúdo editorial ilustrativo e não representam contas de vendedores ou autoria das obras existentes.

Use WELCOME10 para demonstrar 10% de desconto. EXPIRED10 reproduz cupom expirado. Carteiras aceitam Ethereum e Polygon; o endereço fictício deve ter `0x` e 40 caracteres hexadecimais.

## 6. Roteiro para apresentar o projeto

1. Abra o início e apresente a proposta visual e os destaques.
2. Acesse Mercado, faça uma busca e demonstre um filtro e uma ordenação.
3. Abra uma obra, explique edições e disponibilidade e adicione uma unidade ao carrinho.
4. Entre com Alex e mostre a conciliação do carrinho visitante.
5. Aplique WELCOME10 e explique subtotal, desconto e taxa de rede.
6. Abra Meu perfil e mostre dados pessoais e carteiras.
7. No checkout, selecione uma carteira compatível, conecte-a, preencha os dados e confirme a compra simulada.
8. Abra Atividade e consulte o pedido criado. Se confirmado, baixe o comprovante em Arquivos baixados.
9. Apresente Criadores e o tutorial de Aprenda; no celular, os links estão disponíveis no menu.
10. Mostre Suporte e, se desejado, um cenário de recusa ou pendência pelo rodapé.

Para uma apresentação previsível, use o cenário `default` e estoque disponível. A restauração é opcional e apaga os dados locais.

## 7. Arquitetura e tecnologias

React e TypeScript compõem as telas. Vite executa o desenvolvimento e gera o build. TanStack Router gerencia rotas, parâmetros, carregamento por página e proteção de acesso. TanStack Query administra cache, consultas, mutações e reconciliação. Axios encapsula REST; Decimal.js mantém precisão monetária; Socket.IO Client recebe eventos simulados. O estilo combina CSS, Tailwind e componentes acessíveis baseados em Radix.

```text
Navegação → Router → Tela React → TanStack Query → Axios → /api
                                                       ↓
                                               MSW no navegador
                                                       ↓
                                          Regras e armazenamento local
                                                       ↓
                               Eventos simulados → atualização do cache
```

| Caminho | Responsabilidade |
| --- | --- |
| `src/main.tsx` | Inicialização dos mocks e montagem da aplicação |
| `src/router.tsx` | Rotas, proteção de sessão e telas de erro |
| `src/components/chrome.tsx` | Cabeçalho, menu e rodapé |
| `src/features/account.tsx` | Login, cadastro, perfil, carteiras e menu da conta |
| `src/features/community.tsx` | Criadores, tutorial, atividade, ofertas, arquivos e suporte |
| `src/features/catalog.tsx` | Descoberta e catálogo |
| `src/features/nft.tsx` | Obra e favoritos |
| `src/features/cart.tsx` | Carrinho |
| `src/features/checkout.tsx` | Checkout e pedidos |
| `src/contracts.ts` | Tipos e contratos compartilhados |
| `src/lib/` | API, cache, sessão e utilitários |
| `src/mocks/` | API simulada, dados, regras e eventos |
| `src/styles.css` e `src/features/commerce.css` | Estilos globais e de comércio |
| `tests/` | Suíte Playwright e referências visuais existentes |

## 8. Dados, sessão e regras de compra

A base simulada persiste em localStorage. O token de sessão fica em sessionStorage e pertence à aba. Trocas de conta limpam os recursos privados em cache. Rotas privadas redirecionam visitantes ao login; pedidos e carteiras são associados à conta.

Os preços trafegam como strings decimais. A cotação agrega itens, desconto, taxa e total e é revisada pelo mock na criação do pedido. Alterações de preço ou estoque exigem nova revisão. Uma chave de idempotência permite recuperar tentativas interrompidas sem gerar uma nova compra para a mesma tentativa.

Pedidos pendentes reservam estoque. Confirmação conclui a compra; recusa libera a reserva. Eventos de obra e pedido invalidam consultas relacionadas. Reconexão recupera dados pela API. Detalhes de precisão, concorrência e proteção contra eventos antigos estão em ARCHITECTURE.md.

## 9. API e configuração

A base padrão de REST é `/api`. Os principais recursos são `/nfts`, `/session`, `/cart`, `/favorites`, `/profile`, `/wallets`, `/quote` e `/orders`. A lista completa de métodos, entradas, saídas e eventos está em ARCHITECTURE.md.

Atividade e Arquivos baixados consultam `GET /orders`; não possuem base fictícia independente. O comprovante é gerado como JSON no navegador a partir do snapshot do pedido confirmado, com identificação de demonstração sem valor fiscal. Contém dados da compra e do colecionador.

| Variável | Comportamento |
| --- | --- |
| `VITE_ENABLE_MOCKS` | Mocks ativos por padrão; `false` exige backend compatível |
| `VITE_API_BASE_URL` | Padrão `/api` |
| `VITE_SOCKET_URL` | Padrão: origem atual |
| `PLAYWRIGHT_BASE_URL` | URL opcional para testes contra servidor existente |
| `LIGHTHOUSE_BASE_URL` | URL opcional para auditoria |

## 10. Cenários, validação e manutenção

O painel no rodapé permite simular catálogo vazio, lentidão, respostas fora de ordem, indisponibilidade, timeout, validação, recusa de carteira, pagamento recusado e pedido pendente. Também permite mudar preço, esgotar edição e resolver pedidos. Os exemplos operacionais estão no README.md.

Para validar alterações, execute build e lint. A suíte Playwright existente cobre os fluxos documentados em ARCHITECTURE.md; execute-a quando necessário para verificar regressões de navegação e compra. As novas páginas precisam ser incluídas na cobertura automatizada futura. Relatórios previamente existentes não comprovam as páginas acrescentadas nesta entrega.

## 11. Publicação e limites

O build estático é gerado em `dist/`. O repositório contém configuração para fallback de rotas SPA e Service Worker. Consulte README.md para publicação e verificação de URLs diretas. Nenhuma publicação faz parte desta atualização local.

Limitações: criadores são editoriais; Ofertas apresenta um cupom, sem negociação; Suporte é FAQ, sem atendimento ou envio de chamados. Arquivos baixados permite baixar comprovantes novamente, sem registrar histórico de downloads e sem distribuir originais das obras. Os dados não são sincronizados entre dispositivos. A autenticação e os controles locais servem à demonstração.

Para produção, será necessário implementar backend e persistência central, autenticação apropriada, autorização, observabilidade, política de dados e integrações de pagamento ou blockchain conforme o escopo definido. Esses serviços não são fornecidos pelo mock.

## 12. Materiais de apoio

- [README.md](README.md): execução, contas, comandos e cenários.
- [ARCHITECTURE.md](ARCHITECTURE.md): contratos, sessão, precisão, eventos e rastreabilidade.
- [ARTWORK.md](ARTWORK.md): origem e tratamento dos recursos visuais.
- Este documento: visão geral, funcionalidades, roteiro de apresentação e limites.
