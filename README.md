# AirViewer — Visualizador e Inspetor 3D de Aeronaves YSFlight (Frota FAB / YSFAB)

**AirViewer** é uma aplicação web interativa de alta fidelidade construída com **React**, **TypeScript**, **Vite** e **Three.js** para interpretar, inspecionar e renderizar em tempo real modelos 3D, animações cinemáticas e parâmetros de engenharia aeronáutica do simulador **YSFlight** (`.dnm`, `.srf`, `.dat`, `.lst`).

O projeto suporta **todas as 21 aeronaves militares brasileiras** (Força Aérea Brasileira, Marinha do Brasil e Esquadrilha da Fumaça) catalogadas na frota YSFAB, além do modelo original de instrução primária **Neiva T-25 Universal**.

---

## 🛩️ Catálogo da Frota Aérea Modelada (21 Aeronaves)

| Aeronave / Modelo | Designação Operacional | Força / Esquadrão | Nós / Peças | Arquitetura de Malhas |
| :--- | :--- | :--- | :--- | :--- |
| **Neiva T-25 Universal (AFA)** | `T-25 Universal AFA` | Força Aérea Brasileira | 25 nós | 46 PCKs embutidos + 1 SRF colisão |
| **F-5E(M) Tiger II** | `[AIR-FORCE]_F-5E(M)_TIGERII` | Caça e Defesa Aérea | 64 nós | 54 PCKs + pós-combustor (CLA 2) |
| **P-95 Bandeirulha (EMB-111)** | `[NAVY]_P-95_BANDEIRULHA` | Marinha / Patrulha | 37 nós | **25 arquivos `.srf` externos** (CLA 1 prop) |
| **T-27 Tucano (EDA)** | `T-27 TUCANO ESQUADRILHA-DA-FUMACA` | Esquadrilha da Fumaça | 28 nós | 39 PCKs embutidos |
| **T-27 Tucano (Treinador)** | `T-27 TUCANO` | Instrução Avançada AFA | 28 nós | 26 PCKs + 5 SRFs externos |
| **AT-27 Tucano (Ataque Leve)** | `AT-27 TUCANO` | Ataque Leve e COIN | 28 nós | 25 PCKs + 6 SRFs externos |
| **A-29 Super Tucano** | `A-29 SUPER TUCANO` | Caça Leve e Vigilância | 36 nós | 33 PCKs + 3 SRFs externos |
| **P-29 Super Tucano** | `P-29 Super Tucano` | Patrulha e Ataque Leve | 37 nós | 21 PCKs + 18 SRFs externos |
| **ALX A-29 Stealth Tucano** | `ALX A-29 STEALTH TUCANO` | Conceito Furtivo / AFA | 36 nós | 32 PCKs + 4 SRFs externos |
| **Neiva P-56C Paulistinha** | `P-56C NEIVA-PAULISTINHA(PP-HOR)` | Instrução Básica Civil/Militar | 11 nós | 10 PCKs + 5 SRFs externos |
| **R-99A AEW&C (E-99)** | `R-99A AEW&C` | Alerta Aéreo Antecipado | 97 nós | 74 PCKs + radar Erieye dorsal |
| **R-99B RS/AGS (R-99)** | `R-99B RS/AGS` | Sensoriamento Remoto | 34 nós | 7 PCKs + **30 SRFs externos** |
| **Sikorsky SH-3B Sea King** | `[NAVY]SH-3B SEA KING` | Aviação Naval / ASW | 5 nós | 2 PCKs + 5 SRFs externos |
| **AH-11A Super Lynx** | `[NAVY]AH-11A SUPER LYNX` | Marinha do Brasil / Fragatas | 8 nós | 7 PCKs + 8 SRFs externos |
| **S-70A Black Hawk** | `S-70A BLACKHAWK` | Operações Especiais FAB | 44 nós | 19 PCKs + 22 SRFs externos |
| **UH-1H Iroquois (FAB Cam)** | `UH-1H IROQUOIS CAM` | Transporte e Resgate | 24 nós | 5 PCKs + 15 SRFs externos |
| **UH-1H Iroquois (Rockets)** | `UH-1H IROQUOIS CAM RKS` | Ataque e Lança-Foguetes | 20 nós | 5 PCKs + 17 SRFs externos |
| **UH-1H Iroquois (Padrão)** | `UH-1H IROQUOIS` | Asas Rotativas FAB | 24 nós | 5 PCKs + 15 SRFs externos |
| **CH-34 Super Puma** | `CH-34 Super Puma` | Transporte Pesado e VIP | 13 nós | 5 PCKs + 6 SRFs externos |
| **UH-12 Esquilo (Laranja)** | `UH-12 ESQUILO LARANJA` | Treinamento Inicial Helo | 26 nós | 5 PCKs + 16 SRFs externos |
| **UH-12 Esquilo (Camuflado)** | `UH-12 Esquilo` | Utilitário e Ligação | 26 nós | 5 PCKs + 16 SRFs externos |

---

## ⚙️ Arquitetura Técnica e Descobertas do YSFlight

### 1. Sistema Híbrido de Malhas: Blocos `PCK` vs. Arquivos `.srf` Externos
No motor oficial do YSFlight C++ (`ysshelldnmtemplate.h`), ao ler a diretiva `FIL <nome_arquivo.srf>`, o simulador primeiramente consulta o dicionário de malhas embutidas carregadas via diretivas `PCK`. Caso não encontre a malha nos `PCKs`, ele abre dinamicamente o arquivo `.srf` avulso presente na pasta da aeronave.
- 15 dos 20 modelos da frota YSFAB utilizam arquivos `.srf` externos.
- O **P-95 Bandeirulha (EMB-111)** possui **zero `PCKs`** embutidos em seu `.dnm`, compondo 100% de sua fuselagem, asas e hélices através de 25 arquivos `.srf` independentes.
- O **T-27 Tucano AFA** embute 26 partes via `PCK`, mas carrega a sua fuselagem principal externamente a partir de `fuselage.srf`.
- O AirViewer implementa **resolução insensível a maiúsculas/minúsculas** (*case-insensitive matching*), compatibilizando referências com diferenças de caixa alta/baixa comuns entre Windows e sistemas Unix (ex: `Fuselage.srf` vs. `fuselage.srf`).

### 2. Tratamento de Nomes de Nós Duplicados (`uid`)
Alguns modelos complexos (como o `R-99B` com 13 nós chamados `"0000"`, e o `S-70 Blackhawk` com nós duplicados `"0010a"`) utilizam o mesmo rótulo para múltiplas partes independentes. O AirViewer atribui um **UID único determinístico (`uid: "node_0".."node_N"`)** a cada componente, preservando todas as peças no grafo Three.js e eliminando colisões de estado e seleção.

### 3. Cinemática e Canais de Animação Suportados (`CLA`)

| Canal | Descrição Funcional | Lógica de Interpolação YSFlight |
| :---: | :--- | :--- |
| **`CLA 0`** | Trem de Pouso Principal / Portas Retráteis | Interpolação STA 0 (recolhido) $\leftrightarrow$ STA 1 (baixado) na faixa `0.2` a `0.8`. |
| **`CLA 1`** | Asa de Geometria Variável (VGW) / Transição de Hélice | No EMB-111, comuta dinamicamente entre disco transparente (STA 0) e pás sólidas (STA 1). Em caças, comuta o enflechamento alar. |
| **`CLA 2`** | Pós-Combustor (*Afterburner / Reheat*) | Ativado em plena aceleração ou comando manual; acende labaredas de pós-combustão. |
| **`CLA 3`** | Eixo Rotativo da Hélice / Rotor Principal | Rotação contínua proporcional ao RPM do motor em torno do pivô `CNT`. |
| **`CLA 4`** | Freios Aerodinâmicos / *Spoilers* | Interpolação de abertura proporcional ao arrasto. |
| **`CLA 5`** | *Flaps* de Sustentação | Deflexão angular para pouso e decolagem. |
| **`CLA 6`** | Profundor (*Elevator* — Arfagem / Pitch) | Deflexão angular bivalente (STA 1 cabrar, STA 2 picar). |
| **`CLA 7`** | Ailerons (Rolamento / Roll) | Deflexão diferencial assimétrica esquerda/direita. |
| **`CLA 8`** | Leme de Direção (*Rudder* — Guinada / Yaw) | Deflexão angular de guinada $\pm 24^\circ$. |
| **`CLA 9`** | Baia de Armas / Portas de Carga / Rampa | Abertura do compartimento interno de bombas e portas da cabine. |
| **`CLA 10`** | Portas Deslizantes / Faróis / Vetorização | Portas dos helicópteros (S-70, UH-1H, Lynx) e faróis escamoteáveis. |
| **`CLA 11`** | Paraquedas de Frenagem (*Drag Chute*) | Acionamento de paraquedas de cauda em pistas curtas (Mirage, F-5). |
| **`CLA 14`** | Portas Internas do Trem de Pouso | **Ciclo temporário**: abre em `0..0.2`, permanece aberta em `0.2..0.8`, e fecha de volta em `0.8..1.0`. |
| **`CLA 15`** | Compartimento Secundário do Trem (*Gear Bay*) | Abertura progressiva entre `0` e `0.6` de curso do trem. |
| **`CLA 16`** | Gancho de Parada (*Tailhook* Naval) | Gancho para pousos enganchados em porta-aviões (AF-1 Falcão / Marinha). |
| **`CLA 17`** | Portas Rápidas do Trem | Abertura rápida de `0` a `0.2`, permanecendo abertas enquanto o trem estiver baixado. |
| **`CLA 18`** | Pás de Hélice Sólidas (Baixa Rotação) | Visíveis com motor desligado ou em marcha lenta ($\le 60\%$). |
| **`CLA 20`** | Disco Translúcido de Hélice (Alta Rotação) | Visível em regime de voo e alta potência ($> 30\%$). |
| **`CLA 31`** | Bequilha Direcional (*Nosewheel Steering*) | Articulação do trem dianteiro sincronizada com os pedais do leme. |

### 4. Fórmula Exata de Cores 15-Bit YSFlight
A conversão de cores RGB 15 bits do YSFlight segue rigorosamente a fórmula matemática de `YsColor::Set15BitRGB` em `ysgeometry.h`:
$$R_{255} = \text{round}\left(\frac{R_{31} \times 255}{31}\right), \quad G_{255} = \text{round}\left(\frac{G_{31} \times 255}{31}\right), \quad B_{255} = \text{round}\left(\frac{B_{31} \times 255}{31}\right)$$
Isso garante precisão cromática nas tonalidades históricas da FAB (camuflagem verde-oliva, cinza de superioridade aérea e amarelo/azul da Esquadrilha da Fumaça).

---

## 🚀 Como Executar o Projeto

Certifique-se de ter o **Node.js** (v18+) e o **`pnpm`** instalados.

### 1. Instalar dependências
```bash
pnpm install
```

### 2. Iniciar o servidor de desenvolvimento
```bash
pnpm run dev
```
Acesse a aplicação no navegador em `http://localhost:5173/`.

### 3. Compilar para produção
```bash
pnpm run build
```
O build produz pacotes minificados e otimizados na pasta `dist/`.

---

## 🛠️ Tecnologias Utilizadas

- **React 18** com componentes HTML5 nativos (`<select>`, `<input type="range">`, `<details>`, `<summary>`, `<meter>`, `<dialog>`).
- **TypeScript 5** com tipagem estrita de matrizes, geometrias e especificações de voo.
- **Three.js** com renderização ACES Filmic Tone Mapping, sombras PCF Soft, dupla face de renderização e shaders com cores por vértice.
- **Vite 6** para compilação instantânea e chunking inteligente de bibliotecas.
- **Lucide React** para iconografia técnica aeronáutica.
