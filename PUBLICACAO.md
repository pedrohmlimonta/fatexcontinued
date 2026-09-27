# Como publicar o FateX Continued e instalar via manifesto

## Visão geral

A instalação por manifesto usa **GitHub Releases**. Cada release expõe dois arquivos:

- `system.json` — o manifesto que o Foundry lê;
- `fatexcontinued.zip` — o sistema compilado (com o `system.json` na raiz do zip).

Você **não precisa compilar nada na sua máquina**: a GitHub Action `.github/workflows/release.yml` instala as
dependências, compila o TypeScript/SCSS, roda os testes, monta o zip e anexa os dois arquivos à release. Ela também
ajusta a versão do `system.json` conforme a tag e as URLs conforme o repositório.

## 1. Criar o repositório no GitHub (uma vez)

1. Acesse <https://github.com/new>.
2. Nome do repositório: **`fatexcontinued`**.
3. Deixe o repositório **Public** — o Foundry baixa o manifesto e o zip sem login; em repositório privado o link
   dá 404.
4. **Não** marque "Add a README", ".gitignore" nem "license" (o repositório precisa nascer vazio).
5. Clique em **Create repository**.

## 2. Subir o código (uma vez)

Descompacte o `fatexcontinued-repo.zip` e, dentro da pasta `fatexcontinued`:

```bash
git init
git add .
git commit -m "FateX Continued 2.0.0 - Foundry v14"
git branch -M main
git remote add origin https://github.com/pedrohmlimonta/fatexcontinued.git
git push -u origin main
```

> Se o `git push` for recusado mencionando `workflow`, o token usado não tem permissão para enviar arquivos de
> `.github/workflows`. Gere um token com o escopo **workflow** (GitHub → Settings → Developer settings → Personal
> access tokens) ou envie pelo GitHub Desktop.

Depois do push, a aba **Actions** mostra o workflow **CI** rodando (lint, tipos, build e testes). Ele precisa
ficar verde, mas não publica nada.

## 3. Publicar uma versão

1. No repositório: **Releases → Draft a new release**.
2. Em **Choose a tag**, digite **`v2.0.0`** (com o "v") e clique em **Create new tag: v2.0.0 on publish**
   (target: `main`).
3. Título: `2.0.0` (as notas podem ser copiadas do `CHANGELOG.md`).
4. Clique em **Publish release** (não marque "pre-release": o link `latest` ignora pre-releases).
5. Aba **Actions** → espere o run **Release** ficar com ✅ (uns 2 minutos).
6. Volte na release e confira em **Assets**: devem aparecer `system.json` e `fatexcontinued.zip`.
7. Teste no navegador — deve baixar o JSON:
   ```
   https://github.com/pedrohmlimonta/fatexcontinued/releases/latest/download/system.json
   ```

> A tag **precisa** estar no formato `vX.Y.Z`. Para as próximas: `v2.0.1`, `v2.1.0`, `v3.0.0`…

## 4. Instalar no Foundry

1. Foundry (tela de configuração) → **Game Systems → Install System**.
2. No campo **Manifest URL**, cole:
   ```
   https://github.com/pedrohmlimonta/fatexcontinued/releases/latest/download/system.json
   ```
3. **Install**. Depois é só criar um mundo com o sistema **FateX Continued**.

Quando você publicar uma versão nova, o Foundry mostra a atualização em **Game Systems → Update**.

## 5. Mundos que usavam o FateX original

Veja a seção **"Vindo do FateX original"** do `README.md`: é preciso trocar `"system": "fatex"` por
`"system": "fatexcontinued"` no `world.json` do mundo (inclusive nos compêndios listados em `"packs"`). Na primeira
abertura como mestre, o sistema migra as flags e as configurações sozinho, sem apagar nada.

## 6. Próximas atualizações do código

1. Edite o código em `src/` e os templates em `system/templates/`.
2. Opcional, para testar local: `npm ci` e `npm run build`, depois copie `dist/` para
   `Data/systems/fatexcontinued`.
3. Atualize o `CHANGELOG.md` (e, se quiser, o `"version"` de `system/system.json` — a Action sobrescreve com a tag).
4. `git add . && git commit -m "..." && git push`.
5. Publique uma nova release com a tag seguinte (passo 3).

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| O link do manifesto dá 404 | A release ainda não terminou, foi salva como rascunho/pre-release, ou o repositório está privado. |
| Run **Release** falhou em "Atualizar versão" | A tag não está no formato `vX.Y.Z`. Apague a release e a tag e crie de novo. |
| Run **Release** falhou em "Anexar artefatos" (`Resource not accessible by integration`) | Em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions**. |
| O Foundry instala, mas o mundo antigo não aparece com o sistema | Falta trocar `"system": "fatex"` no `world.json` (passo 5). |
