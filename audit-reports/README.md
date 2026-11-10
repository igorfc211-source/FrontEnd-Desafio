# Evidências de validação

O Playwright executou 53 testes no build de produção, incluindo 12 comparações visuais em 390, 768 e 1440 px. A execução final passou sem falhas. [Relatório HTML](playwright.html)

## Lighthouse

Três navegações frias por página e perfil, no cenário padrão. Build Vite de produção com entrada `/assets/index-BSQrF68Y.js`. Lighthouse 12.8.2, Chrome/158.0.8127.18, Playwright 1.65.0 e Node v22.12.0. Perfis, ambiente e medições individuais estão no [resumo JSON](summary.json).

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 86 | 100 | 100 | 100 | 3,219 s | 0,000 | 112,5 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,755 s | 0,000 | 0,0 ms |
| Detalhe | mobile | 86 | 100 | 100 | 100 | 3,276 s | 0,000 | 65,0 ms |
| Detalhe | desktop | 94 | 100 | 100 | 100 | 0,772 s | 0,142 | 0,0 ms |

As duas páginas ficaram abaixo da meta 90 de Performance mobile. A inicialização do JavaScript e do MSW e a leitura do catálogo ou do detalhe atrasam a descoberta da imagem principal. No detalhe mobile, uma amostra atribuiu aproximadamente 1,48 s à espera pela descoberta e 22 ms à transferência da imagem.

No detalhe desktop, o relatório registrou CLS de 0,142. O rodapé mudou de posição quando o conteúdo assíncrono da obra e da coleção entrou no layout.

- Início mobile · [1 HTML](home-mobile-1.html) / [JSON](home-mobile-1.json) · [2 HTML](home-mobile-2.html) / [JSON](home-mobile-2.json) · [3 HTML](home-mobile-3.html) / [JSON](home-mobile-3.json)
- Início desktop · [1 HTML](home-desktop-1.html) / [JSON](home-desktop-1.json) · [2 HTML](home-desktop-2.html) / [JSON](home-desktop-2.json) · [3 HTML](home-desktop-3.html) / [JSON](home-desktop-3.json)
- Detalhe mobile · [1 HTML](detail-mobile-1.html) / [JSON](detail-mobile-1.json) · [2 HTML](detail-mobile-2.html) / [JSON](detail-mobile-2.json) · [3 HTML](detail-mobile-3.html) / [JSON](detail-mobile-3.json)
- Detalhe desktop · [1 HTML](detail-desktop-1.html) / [JSON](detail-desktop-1.json) · [2 HTML](detail-desktop-2.html) / [JSON](detail-desktop-2.json) · [3 HTML](detail-desktop-3.html) / [JSON](detail-desktop-3.json)
