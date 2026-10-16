# AirViewer — Visualizador e Inspetor 3D de Aeronaves YSFlight (Neiva T-25 Universal)

**AirViewer** é uma aplicação web interativa construída com **React**, **TypeScript**, **Vite** e **Three.js** para interpretar, inspecionar e renderizar em tempo real modelos 3D e parâmetros de engenharia de aeronaves do simulador **YSFlight** (`.dnm`, `.srf`, `.dat`, `.lst`).

O projeto foi concebido a partir da engenharia reversa do código-fonte C++ oficial do [YSFlight (`captainys/YSFLIGHT`)](https://github.com/captainys/YSFLIGHT) e aplicado ao modelo **Neiva T-25 Universal ("Tangará" / AFA)** presente no diretório `t-25/`.

---

## Contexto Técnico e Arquitetura dos Arquivos YSFlight

No YSFlight, uma aeronave é definida por um conjunto de 4 arquivos em texto puro (ASCII), sem dependência de texturas externas de imagem — toda a pintura, insígnias da FAB, transparências do canopy e instrumentos são modelados diretamente como polígonos vetoriais coloridos:

| Arquivo | Função no Simulador | Conteúdo no T-25 Universal |
| :--- | :--- | :--- |
| **`t25universal.lst`** | Manifesto de descoberta | Lista o arquivo de propriedades (`.dat`), modelo visual (`.dnm`) e malha de colisão (`_coll.srf`). |
| **`t25universal.dat`** | Física, performance e pontos 3D | 98 linhas de parâmetros: motor de `750 hp`, pesos, velocidades críticas/manobra, limites de AOA e coordenadas exatas do piloto (`COCKPITP`), trens de pouso (`LEFTGEAR`, `RIGHGEAR`, `WHELGEAR`), metralhadora (`MACHNGUN`) e gerador de fumaça (`SMOKEGEN`). |
| **`t25universal_coll.srf`** | Caixa envolvente de colisão | Malha estática simplificada (19 vértices e 12 faces) usada pelo motor físico para detecção rápida de impacto. |
| **`t25universal.dnm`** | Modelo 3D Dinâmico (*DynaModel*) | 58.829 linhas contendo **46 pacotes de malha `PCK`** (`.srf` embutidos) e um **grafo de cena hierárquico com 25 nós `SRF`** articulados por canais `CLA` e estados `STA`. |

### Como Funcionam as Partes Móveis (`CLA` & `STA`)

Cada nó `SRF` dentro do arquivo `.dnm` possui:
- **`POS`**: Posição $(x, y, z)$ e atitude base $(h, p, b)$ relativas ao nó pai.
- **`CNT`**: Ponto de pivô local (*Local Rotation Center*) em torno do qual a peça rotaciona.
- **`CLA`**: Identificador da classe/canal de animação no YSFlight.
- **`NST` e `STA`**: Quantidade e lista de estados de transformação $(\Delta x, \Delta y, \Delta z, \Delta h, \Delta p, \Delta b, \text{visibilidade})$ que são interpolados conforme o comando do piloto:
  - **`CLA 6` (Profundor / Elevator — `SRF "7"`)**: 3 estados (`STA 0` neutro, `STA 1` cabrar $+24^\circ$, `STA 2` picar $-24^\circ$).
  - **`CLA 7` (Ailerons Esquerdo e Direito — `SRF "8"` e `SRF "9"`)**: 3 estados com deflexão diferencial assimétrica ($\pm 24^\circ$).
  - **`CLA 8` (Leme Direcional / Rudder — `SRF "6"`)**: 3 estados de guinada ($\pm 24^\circ$).
  - **`CLA 0` com `NST 2` (Trem de Pouso Retrátil e Portas — `SRF "10"` a `SRF "21"`)**: Interpola continuamente entre `STA 0` (recolhido dentro das asas/fuselagem, com portas ocultadas via flag `visible = 0`) e `STA 1` (baixado e travado).
  - **`CLA 3` $\to$ `CLA 18` e `CLA 20` (Conjunto da Hélice — `SRF "25"` $\to$ `CLD "2"` e `"3"`)**: O nó pai invisível `SRF "25"` (`null.srf`) gira no eixo de *bank* conforme o RPM, carregando os filhos `SRF "2"` (`helice.srf`, pás visíveis em baixo RPM) e `SRF "3"` (`helice_2.srf`, disco translúcido em alto RPM).

### Conversão Matemática Fiel ao C++ (`ysTransform.ts`)

1. **Unidades Angulares de 16 bits**: Todos os ângulos $(h, p, b)$ no `.dnm` usam inteiros onde $65536 = 360^\circ$ ($2\pi\text{ rad}$).
2. **Ordem de Multiplicação de Matrizes**: Reproduz exatamente `YsShellDnmContainer::DnmState::CacheTransformation` (`ysshelldnmtemplate.h`):
   $$\text{Translate}(\text{POS}) \cdot \text{RotateXZ}(h) \cdot \text{RotateZY}(p) \cdot \text{RotateXY}(b) \cdot \text{Translate}(\text{STA}) \cdot \text{RotateXZ}(\Delta h) \cdot \text{RotateZY}(\Delta p) \cdot \text{RotateXY}(\Delta b) \cdot \text{Translate}(-\text{CNT})$$
3. **Sistema de Coordenadas Left-Handed $\to$ Right-Handed**: O YSFlight utiliza um sistema *Left-Handed* ($+X$ asa direita, $+Y$ cima, $+Z$ nariz). A aplicação converte vértices e matrizes por conjugação $M_{\text{three}} = S \cdot M_{\text{ys}} \cdot S$ com $S = \text{diag}(-1, 1, 1)$ e inversão da ordem dos triângulos, preservando a leitura correta dos textos na fuselagem (`FAB`, `T-25`, `1975`).

---

## Funcionalidades Principais

- **Controle em Tempo Real das Partes Móveis**:
  - **Manche 2D Interativo (XY Pad)** e sliders nativos para Ailerons, Profundor e Leme Direcional.
  - **Painel de Trem de Pouso** com alavanca UP/DOWN, animação hidráulica suave, controle manual de curso (0% a 100%) e luzes indicadoras **"3 Greens"** (Nariz, Esquerdo e Direito).
  - **Controle de Propulsão e RPM** com ignição, manete de potência (*Throttle*), medidor `<meter>` nativo e transição gradual entre pás (`CLA 18`) e disco de alta rotação (`CLA 20`).
  - **Modo Auto-Demo**: Executa automaticamente um ciclo de cheque pré-voo em todas as superfícies e no trem de pouso.
- **Inspetor de Engenharia e Grafo de Cena**:
  - Árvore interativa dos **25 nós `SRF` ativos** com busca, filtro por categoria, seleção por clique direto no modelo 3D (*Raycasting*), ocultação individual e modo **Solo**.
  - **Explorador de Malhas `PCK` Órfãs**: Permite inspecionar individualmente as **21 malhas `.srf` embutidas no arquivo `t25universal.dnm`** que não foram referenciadas por nenhum nó `SRF` na montagem final.
  - **Modos Visuais**: Sobreposição da malha de colisão (`t25universal_coll.srf`), Wireframe, Raio-X estrutural, Flat Shading vs. Smooth Shading (flag `R`), esfera `HTRADIUS` e marcadores 3D projetados do `.dat`.
  - **Câmeras Predefinidas**: Hangar 3/4, Visão Real do Piloto no Cockpit (`COCKPITP`), Frontal, Lateral, Superior e Cauda.
  - **Importação Customizada**: Suporte para carregar qualquer outro arquivo `.dnm`, `.srf` ou `.dat` do YSFlight diretamente pelo navegador.

---

## Estrutura do Projeto

```text
AirViewer/
├── public/
│   └── models/
│       └── t-25/                     # Arquivos originais do Neiva T-25 Universal servidos estaticamente
│           ├── t25universal.lst
│           ├── t25universal.dat
│           ├── t25universal.dnm
│           └── t25universal_coll.srf
├── src/
│   ├── types/
│   │   └── ysflight.ts               # Tipagens TypeScript (SRF, DNM, DAT, Controles e Câmera)
│   ├── parsers/
│   │   ├── srfParser.ts              # Parser de malhas poligonais .srf (V, F, C, N, ZA, ZL, B)
│   │   ├── dnmParser.ts              # Parser de pacotes PCK e grafo hierárquico SRF/CLA/STA
│   │   └── datParser.ts              # Parser de telemetria física e coordenadas 3D .dat
│   ├── math/
│   │   └── ysTransform.ts            # Matrizes YSFlight, ear-clipping 2D e interpolação STA
│   ├── components/
│   │   ├── viewport/
│   │   │   └── AircraftViewport.tsx  # Cena Three.js, iluminação, raycasting e projeção de marcadores
│   │   └── ui/
│   │       ├── TopBar.tsx            # Cabeçalho, presets de câmera e upload de arquivos
│   │       ├── FlightControlsPanel.tsx # Painel esquerdo de comando de voo, trem e motor
│   │       └── InspectorPanel.tsx    # Painel direito de inspeção, árvore SRF, PCKs órfãos e modal <dialog>
│   ├── App.tsx                       # Orquestração de estado e carregamento dos modelos
│   ├── main.tsx                      # Ponto de entrada React
│   └── index.css                     # Estilização moderna de componentes HTML5 nativos
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── vite.config.ts
```

---

## Pré-requisitos e Como Executar

Certifique-se de ter o **Node.js** (v18+) e o gerenciador de pacotes **`pnpm`** instalados.

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Iniciar o servidor de desenvolvimento

```bash
pnpm run dev
```

Acesse a aplicação no navegador em: **`http://localhost:5173`**

### 3. Gerar build de produção

```bash
pnpm run build
```

Para testar localmente o pacote compilado na pasta `dist/`:

```bash
pnpm run preview
```
