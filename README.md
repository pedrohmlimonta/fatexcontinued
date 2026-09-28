# FateX Continued

**Continuação comunitária do [FateX](https://github.com/anvil-vtt/FateX)** — o sistema de Fate estendido para o Foundry VTT criado por Patrick Bauer — atualizado para o **Foundry VTT v14** (verificado na build **14.368**).

O FateX Continued permite jogar **qualquer jogo de Fate**: vem com opções prontas para **Fate Core, Fate Acelerado e Fate Condensado**, e pode ser adaptado a todos os seus derivados. Você define seus próprios aspectos, listas de perícias, barras de estresse, consequências, condições, façanhas e extras, e usa o **sistema de modelos de ator** para ter fichas-base diferentes para PJs, PdMs, monstros e o que mais quiser.

> **English:** FateX Continued is a community continuation of FateX, updated for Foundry VTT v14 (verified on 14.368). The system id is `fatexcontinued`. Install it with the manifest URL below. Worlds created with the original `fatex` system can be migrated (see *Vindo do FateX original*).

## Instalação

No Foundry: **Game Systems → Install System**, cole no campo **Manifest URL** e clique em **Install**:

```
https://github.com/pedrohmlimonta/fatexcontinued/releases/latest/download/system.json
```

Requisito: Foundry VTT **v14** (verificado na build 14.368).

## Vindo do FateX original (mundos existentes)

O id do sistema mudou de `fatex` para `fatexcontinued`, então o Foundry não associa sozinho um mundo antigo ao novo sistema:

1. **Faça backup** da pasta do mundo (`Data/worlds/<seu-mundo>`). Mundos abertos no v14 não voltam para o v13.
2. Instale o FateX Continued pelo manifesto acima.
3. Com o Foundry **fechado** (ou o mundo desligado), edite `Data/worlds/<seu-mundo>/world.json` e troque
   **todas** as ocorrências de `"system": "fatex"` por `"system": "fatexcontinued"` — a do mundo e as de cada
   compêndio listado em `"packs"` (compêndios que apontam para outro sistema não são carregados).
4. Abra o mundo com um usuário **mestre**. Na primeira vez o sistema copia automaticamente os dados do FateX
   original (flags de modelos, automações de perícias, cartões de rolagem do chat e as configurações do sistema)
   para o novo namespace. **Nada é apagado.** Enquanto isso não acontece, o sistema já lê os dados antigos.
5. Módulos feitos para o FateX original que declaram `"systems": [{ "id": "fatex" }]` em `relationships`, ou
   compêndios de Ator/Item com `"system": "fatex"`, precisam passar a usar `fatexcontinued`.

Para repetir a migração manualmente (como mestre, no console do navegador — F12):

```js
CONFIG.FateX.migrateWorld({ force: true })
```

## Extras ligados a perícias

Um extra pode ser ligado a uma perícia do personagem e ter um bônus (ou penalidade) próprio na rolagem:

1. Na ficha, aba **Extras**, ligue o **Modo de Edição** (botão no topo da janela) e clique na engrenagem do extra
   (ao criar um extra novo, a configuração já abre sozinha).
2. Em **Perícia ligada**, escolha a perícia. Em **Bônus ou penalidade na rolagem**, escolha de -4 a +4 — os botões
   **−** e **+** nas pontas mudam de 1 em 1 e passam desses limites, sem máximo. Em **Custo em pontos de destino**,
   coloque quantos pontos de destino cada rolagem gasta (0, o padrão, não gasta nada).
3. O extra passa a mostrar, abaixo do nome, a perícia que rola, o nível dela e o bônus. **Clique no nome do extra
   ou nessa linha** para rolar — igual a clicar numa perícia (Shift rola os dados mágicos, o modo 2d6 e o Dice So
   Nice continuam valendo). No modo de edição da ficha, só a linha rola.
4. A carta no chat mostra a perícia e, logo abaixo, o extra e o bônus dele. O bônus já entra no total, e o +2 e o
   rolar de novo continuam funcionando.
5. Se o extra tiver custo, ao rolar o sistema confere se o personagem tem pontos de destino suficientes, gasta e
   então rola (a carta mostra "gastou N pontos de destino"). Sem pontos suficientes, aparece um aviso e nada é
   rolado nem gasto. Na ficha, o custo aparece ao lado da perícia ("custa 2 PD"), em vermelho quando não dá para
   pagar.

A perícia é guardada pelo nome (como nas automações de perícias), então o extra funciona em qualquer personagem que
tenha uma perícia com esse nome. Se o personagem não tiver, a ficha avisa ("não existe nesta ficha") e o clique não
rola.

## O que mudou em relação ao FateX 1.5.4

- Compatível com o Foundry VTT v14.368 (compatibilidade mínima: v14).
- Extras podem ser ligados a uma perícia, com bônus ou penalidade, e rolados direto da ficha (veja acima).
- Novo id `fatexcontinued`: caminhos, flags, configurações e canal de socket foram renomeados.
- `template.json` (depreciado no v14) foi substituído por `documentTypes` no `system.json` + *TypeDataModels*,
  mantendo exatamente a mesma estrutura de dados.
- Rolagens usam os novos modos de mensagem do v14 (`core.messageMode` / `ChatMessage.applyMode`).
- Botões **+2** e **rerolar** do chat funcionam no log, nas notificações e em pop-outs (`renderChatMessageHTML`).
- APIs removidas ou depreciadas substituídas (`Math.clamped`, `ChatMessage#user`, globais como `renderTemplate`,
  `loadTemplates`, `TextEditor`, `Actors/Items.registerSheet`, `FormApplication`, `Dialog`…).
- Correções: ficha limitada (partial inexistente), grupos de atores (referências de token, criação a partir de
  pasta), arrastar diários para a ficha, botão de modelos na aba de configurações e descrições enriquecidas que
  podiam ser salvas por cima do texto original.

A lista completa está no [CHANGELOG](CHANGELOG.md).

## Para desenvolvedores de módulos

| O quê | FateX 1.x | FateX Continued |
| --- | --- | --- |
| Id do sistema | `fatex` | `fatexcontinued` |
| Flags | `flags.fatex.*` | `flags.fatexcontinued.*` (as antigas continuam sendo lidas) |
| Configurações | `fatex.<chave>` | `fatexcontinued.<chave>` |
| Socket | `system.fatex` | `system.fatexcontinued` |
| Caminhos | `systems/fatex/...` | `systems/fatexcontinued/...` |

Continuam iguais: `CONFIG.FateX`, as classes CSS (`fatex-*`), os hooks `fatex.roll`, `fatex.rollMagic`,
`fatex.reroll` e `fatex.increase`, e o escopo das fichas (`FateX.CharacterSheet`, etc.). As fichas continuam em
Application V1 (disponível no Foundry até a v16), com o mesmo HTML — temas e módulos que alteram a ficha seguem
funcionando. Nas rolagens, `roll.options.actor` deu lugar a `roll.options.actorId`/`actorUuid` e ao getter
`roll.actor`.

## Desenvolvimento

```bash
npm ci                    # instala as dependências
npm run build             # build de desenvolvimento em dist/
npm run build:production  # build minificada (a mesma da release)
npm run lint              # ESLint
npm run typecheck         # TypeScript
npm test                  # testes de fumaça do bundle (rode um build antes)
```

Para testar localmente, copie (ou crie um link simbólico) o conteúdo de `dist/` para
`Data/systems/fatexcontinued`. Para publicar uma nova versão, veja [PUBLICACAO.md](PUBLICACAO.md).

## Créditos

- Sistema original: **Patrick Bauer** ([anvil-vtt/FateX](https://github.com/anvil-vtt/FateX)) e todos os seus colaboradores.
- FateX Continued: **Pedro** ([pedrohmlimonta](https://github.com/pedrohmlimonta)).

## Translations

#### German:
* System translation provided by E1Camino#4300, hauke#9245 and [em-squared](https://github.com/em-squared) 
* German Fate translation by Uhrwerk Verlag

> Deutsche Ausgabe Fate Core und Turbo Fate:
> www.uhrwerk-verlag.de • info@uhrwerk-verlag.de   
> © Uhrwerk Verlag 2015 Authorized translation of the English edition

> Deusches SRD:
> https://srd.faterpg.de/ unter CC-BY 3.0 Lizenz
 
 
#### Spanish
* System translation provided by patoarayas#8224 (supported by qarkeed#5885)
* Spanish Fate Core and Accelerated translation by Nosolorol
* Spanish Fate Condensed translation by 1d12monos
  
> Edición en Español de Fate básico y acelerado:
> www.nosolorol.es • atencionalcliente@nosolorol.com 
> Copyright © 2015 Nosolorol, S.L. por la edición en castellano.

> SRD en Español de Fate Condensado:
> https://fate.1d12monos.com/ bajo licencia CC-BY 4.0


#### French
* System translation provided by Cougy#6185 (supported by orome#4359 and [ianw12345](https://github.com/ianw12345))

> Le Fate Core System, Fate System Toolkit et Fate Accelerated Edition (que vous pouvez retrouver sur http://www.faterpg.com), produits de Evil Hat Productions, LLC, développés, écrits et édités par Leonard  Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks et Rob Donoghue sont sous licence d’utilisation Creative Commons Attribution 3.0 Unported. 
> Le SRD français est lui-même sous licence Creative Commons Attribution 3.0 non transposé (http://creativecommons.org/licenses/by/3.0/deed.fr), par Philippe Marichal, Alain Dutech, Jean-Christophe Cubertafon, Geoffrey Sanchez, “Casque Noir”, Maxime Moraine, Thomas Pereira, Mickael Houet, Gabriel Ollier et François Enders. 

> SRD français: 
> https://fate-srd.fr/ sous licence CC-BY 3.0 (https://fate-srd.fr/wikifate/licence)


#### Galician
* System translation provided at the [foundryvtt-gl](http://github.com/xurxodiz/foundryvtt-gl) package
* Fate Core/Accelered/Condensed translation by xurxodiz#5885

#### Italian

* System translation provided by smoothingplane#6772
* Italian Fate translation by [Dreamlord Games](https://www.dreamlord.it/)
> Quest’opera si basa su “Fate Core System” e su “Fate Accelerated Edition”, sviluppati, scritti ed editati da Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks e Robert Donoghue, su “Fate System Toolkit”, sviluppato scritto ed editato da Robert Donoghue, Brian Engard, Brennan Taylor, Mike Olson, Mark Diaz Truman, Fred Hicks e Matthew Gandy, e su “Fate Adversary Toolkit”, sviluppato, scritto ed editato da Brian Engard, Lara Turner, Joshua Yearsley e Anna Meade, prodotti dalla Evil Hat Productions, LLC e potete trovare qui (http://www.faterpg.com/), e sulla loro traduzione italiana, effettuata da Fateitalia.it e pubblicata da Dreamlord Games, e distribuiti sotto la licenza Creative Commons Attribuzione 3.0 (http://creativecommons.org/licenses/by/3.0/).

> SRD italiano: https://www.fateitalia.it/ con licenza CC-BY 3.0 (https://www.fateitalia.it/fatesrdccbyitalicenza/)

#### Chinese
* System translation provided by [Nowpaper](https://github.com/Nowpaper)

### Korean
* System translation provided by [MaronKB](https://github.com/MaronKB)

> 페이트 코어 한국어 공개판은 Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks, Rob Donoghue가 개발, 저술, 편집한 Evil Hat Productions, LLC 제품 Fate Core System을 크리에이티브 커먼즈 저작자표시 3.0 Unported 라이선스에 의거하여 도서출판 초여명의 김성일이 번역한 작품입니다.

> 페이트 코어 한국어 공개판: https://sites.google.com/site/fatecorekr/ 은 크리에이티브 커먼즈 저작자표시 3.0 Unported (CC BY 3.0) 라이센스에 따라 이용할 수 있습니다.

#### Swedish
* System translation provided by [Grottmastaren](https://github.com/Grottmastaren)

#### Portuguese (Brazil)
* Portuguese (Brazil) translation provided by [luizbgomide](https://github.com/luizbgomide)

#### Russian
* Russian translation provided by [awhitefox](https://github.com/awhitefox)

---

A big thank you to all who are contributing translations! You're a great help to the international Fate community! ❤️

Translations are inherited from the original FateX project. If your language isn't represented yet, feel free to open a pull request.

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2020 Patrick Bauer
Copyright (c) 2026 Pedro (pedrohmlimonta) - FateX Continued

---

This work is based on Fate Core System and Fate Accelerated Edition (found at http://www.faterpg.com/), products of Evil Hat Productions, LLC, developed, authored, and edited by Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks, and Rob Donoghue, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).

This work is based on Fate Condensed (found at http://www.faterpg.com/), a product of Evil Hat Productions, LLC, developed, authored, and edited by PK Sullivan, Ed Turner, Leonard Balsera, Fred Hicks, Richard Bellingham, Robert Hanz, Ryan Macklin, and Sophie Lagacé, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).

Fate™ is a trademark of Evil Hat Productions, LLC. The Powered by Fate logo is © Evil Hat Productions, LLC and is used with permission.
The Fate Core font is © Evil Hat Productions, LLC and is used with permission. The Four Actions icons were designed by Jeremy Keller.
