# Origem dos assets

O material de referência foi o PNG de 8000 × 7453 px exportado do Figma e enviado pelo usuário em `img/Frontend Challenge/Frontend Challenge.png`. O aplicativo usa os recortes WebP em `public/art/`. Os recortes principais mantêm as dimensões da arte no export e usam transparência nas quinas arredondadas.

| Arquivo | Obra | Região no PNG em pixels (x, y, largura, altura) |
| --- | --- | --- |
| `01.webp` | Emerald Ape #042 | 870, 107, 450, 450 |
| `02.webp` | Sage Nomad #009 | 774, 728, 250, 250 |
| `03.webp` | Neon Vessel #552 | 1066, 727, 250, 250 |
| `04.webp` | Golden Beat #207 | 482, 1573, 250, 250 |

Os arquivos `*-view-*.webp` são enquadramentos das mesmas obras usados na galeria. O recorte de Sage Nomad vem do card do catálogo, onde a arte aparece sem a ornamentação sobreposta na chamada lateral.

Os ícones de busca, carrinho e conta vieram dos SVGs do export mobile, e o de seta veio do export desktop. Eles estão em `public/icons/`. Os demais controles usam Lucide. A interface carrega IBM Plex Mono do pacote local `@fontsource/ibm-plex-mono`.

O PNG de referência e o ZIP completo ficam fora do build. [Frontend Challenge no Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1)
