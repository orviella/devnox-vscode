# Aula 02 — CRUD e entrega do DevNox

O DevNox organiza contatos e campanhas. Para esta atividade, o CRUD completo está na tela **Contatos**. O envio pelo Telegram é uma funcionalidade adicional e não é necessário para demonstrar o CRUD.

## 1. Abrir e experimentar

Abra a pasta no VS Code e execute `npm start` no terminal (requer Node.js). Acesse `http://127.0.0.1:5173/contatos.html?demo=1`.

O modo demonstração salva os dados somente neste navegador. Ele ajuda a conhecer a interface, mas não comprova a integração com o banco.

Para usar o banco real, confira `config.js`, instale o banco seguindo o passo 2 de `COMECE-AQUI.md`, habilite o login por e-mail no Supabase e configure as URLs de autenticação conforme o passo 3. Abra `http://127.0.0.1:5173/` sem `?demo=1`, crie sua conta, confirme o e-mail e entre. A autorização SQL para envio pelo bot e os passos de Telegram são opcionais para o CRUD.

## 2. Entender o código

| Operação | O que a pessoa faz | Onde acontece |
| --- | --- | --- |
| CREATE — criar | Adicionar contato → Salvar contato | `saveContact` em `src/data.js`, usando `insert` |
| READ — consultar | Abre Contatos, pesquisa ou clica Atualizar | `load` em `src/data.js`, usando `select`; `contacts` em `src/main.js` desenha a tabela |
| UPDATE — editar | Editar → altera os campos → Salvar contato | `saveContact`, usando `update` e o ID do contato |
| DELETE — excluir | Excluir → confirma no diálogo | `deleteContact`, usando `delete` e o ID do contato |

O caminho dos dados é: formulário em `contatos.html` → evento em `src/main.js` → validação em `src/domain.js` → banco em `src/data.js` → atualização da tabela.

Cada tela tem seu próprio HTML: `index.html` (login/cadastro), `contatos.html`, `nova-campanha.html`, `campanhas.html`, `canais.html`, `configuracoes.html` e `perfil.html`. O menu usa links para esses arquivos. CSS e JavaScript são compartilhados para evitar repetir as regras de validação e de acesso ao banco. Consulte o mapa de arquivos no README.

O ID identifica o registro. O `user_id` identifica o dono. As políticas RLS do banco impedem uma conta de acessar registros de outra conta. A edição não cria outro registro se o contato tiver sido excluído em outra aba.

## 3. Roteiro de testes manuais

Execute esta sequência com uma conta real e repita no site publicado:

- [ ] Cadastrar um contato chamado “Teste da aula”; conferir a mensagem de sucesso e a nova linha.
- [ ] Recarregar a página; o contato deve continuar na lista.
- [ ] Buscar pelo nome e pela empresa; conferir também uma busca sem resultados.
- [ ] Editar nome e empresa; salvar e recarregar para conferir a persistência.
- [ ] Tentar salvar nome vazio, telefone inválido, chat ID com letras e link inválido; corrigir os campos e salvar.
- [ ] Clicar Excluir e depois Cancelar; o contato deve permanecer.
- [ ] Excluir e confirmar; recarregar e conferir que o contato desapareceu.
- [ ] Desconectar a internet e clicar Atualizar; conferir a mensagem de erro. Reconectar e tentar novamente.
- [ ] Abrir com outra conta; os contatos da primeira conta não devem aparecer.
- [ ] Testar no celular: navegação, formulário, diálogo de exclusão e rolagem da tabela.

Testes automáticos: `npm ci` e `npm test`. Eles verificam regras, CRUD de demonstração e banco local, incluindo isolamento entre usuários. Não substituem os testes no Supabase hospedado e no navegador.

## 4. Publicar e entregar

1. Envie os arquivos do projeto para o repositório, com todos os sete arquivos HTML na raiz, incluindo `index.html`. Inclua `src`, `vendor`, `supabase` e `.nojekyll`. Não envie `node_modules`, arquivos `.env`, senhas, tokens privados ou chaves administrativas.
2. No GitHub, abra **Settings → Pages → Deploy from a branch**. Escolha a branch que recebeu os arquivos e a pasta **/(root)**. Clique **Save**.
3. Aguarde o GitHub informar o endereço publicado. No Supabase, ajuste **Site URL** e **Redirect URLs** para esse endereço completo.
4. Abra o site sem `?demo=1` e execute o roteiro acima. A chave pública de `config.js` pode ficar no site; a proteção dos dados depende das políticas RLS instaladas.
5. Envie ao AVA o link do repositório, o link do site verificado e `entrega/devnox-web.zip`. Se alterar o código depois, atualize o ZIP antes de entregar.

Os endereços previstos estão no README. A existência desses endereços no guia não significa que a publicação já foi concluída.

Referências: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) e [UPDATE no Supabase](https://supabase.com/docs/reference/javascript/update).
