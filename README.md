# DevNox Web · HTML, CSS, JavaScript e Supabase

**Para a atividade da Aula 02, comece pelo [GUIA-DA-AULA.md](GUIA-DA-AULA.md):** explicação do CRUD, roteiro de testes e passos para entregar no AVA.

Aplicação estática para navegador e GitHub Pages, sem BAT, Vite ou etapa de compilação.

## Abrir
No VS Code, abra esta pasta e use **Open with Live Server** no `index.html`. Alternativa com Node.js: `npm start` e http://127.0.0.1:5173.
Acrescente `?demo=1` para explorar com dados locais e sem envios. Sem esse parâmetro, o site usa o Supabase de `config.js`.

## Arquivos
- `index.html`: entrada do site.
- `login.html`: página de login.
- `cadastro.html`: página de cadastro.
- `contatos.html`: tela de contatos, tabela e formulário do CRUD.
- `nova-campanha.html`: página para criar uma campanha ou continuar um rascunho.
- `campanhas.html`: página de histórico e resultados das campanhas.
- `canais.html`: página de conexão com o Telegram.
- `configuracoes.html`: página de aparência e ambiente.
- `perfil.html`: página dos dados da conta.
- `src/style.css`: estilos e responsividade.
- `src/main.js`: interações e conteúdo dinâmico das demais telas.
- `src/navigation.js`: caminhos das páginas e navegação, preservando o modo demonstração.
- `src/data.js`: acesso ao banco e modo de demonstração.
- `src/domain.js`: validações.
- `config.js`: URL e chave pública do Supabase.
- `vendor/`: bibliotecas locais Supabase JS 2.57.4 e Lucide 0.468.0, com licenças.
- `supabase/`: SQL, políticas RLS e funções Telegram.
- `tests/`: testes de regras, CRUD, isolamento e fila.

JavaScript e as tags script são necessários para os botões, autenticação e CRUD. O HTML define a estrutura, CSS a aparência e Supabase armazena os dados em PostgreSQL.

Cada HTML declara sua tela em `data-page` e contém a estrutura do painel e seu título. O JavaScript compartilhado carrega os dados e monta as partes dinâmicas, como linhas da tabela, campanhas e perfil. Login e formulário de contatos ficam nos respectivos HTMLs. Ao clicar no menu, o navegador abre outro arquivo HTML; não é mais navegação por `#contacts`. A sessão do Supabase permanece entre as páginas. Salve o rascunho antes de sair da página de composição.

## CRUD da atividade
Em **Contatos**: Adicionar contato (CREATE), tabela/pesquisa/Atualizar (READ), Editar (UPDATE) e Excluir com confirmação ou cancelamento (DELETE).
Validações recusam nome vazio, telefone/chat ID inválido e links sem HTTP/HTTPS. Mensagens de sucesso e erro aparecem na tela. Cada usuário acessa seus próprios contatos por RLS.
A exclusão preserva o histórico de entregas. Envios pendentes para o contato excluído não passarão pela verificação de autorização do worker.

## GitHub Pages
Repositório escolhido: https://github.com/willymanke/joaoeiuri

1. Envie **todos os arquivos `.html`**, `config.js`, `.nojekyll`, `src/`, `vendor/`, `supabase/`, documentação e testes para a raiz da branch main.
2. Não envie node_modules, .env, senhas, service_role ou token Telegram.
3. Em Settings → Pages, selecione Deploy from a branch → main → /(root) → Save.
4. Aguarde a publicação e confirme o endereço informado pelo GitHub. Endereço esperado: https://willymanke.github.io/joaoeiuri/ (ainda precisa ser publicado e verificado).
5. No Supabase Authentication, ajuste Site URL e Redirect URLs para o endereço do site.
6. Para Telegram, configure APP_ORIGIN=https://willymanke.github.io nas secrets. A origem não inclui o caminho /joaoeiuri/.

Os caminhos são relativos. O arquivo .nojekyll preserva a pasta _shared necessária à personalização.
A chave pública em config.js pode estar no navegador; tokens privados ficam apenas nas secrets do Supabase. O CRUD funciona independentemente da configuração do bot. Leia COMECE-AQUI.md para instalar banco e funções.

## Testes e entrega
Com Node.js 22.18+, execute `npm ci` e `npm test`. As dependências são para testes; GitHub Pages não precisa instalar nada.
Teste também com uma conta real: cadastrar, recarregar, editar, cancelar uma exclusão e depois excluir. Confirme isolamento entre duas contas. Testes locais não confirmam o funcionamento do Supabase hospedado.
Entregue o link do repositório, o link do site verificado e o ZIP no AVA. O professor pode criar uma conta para testar os próprios contatos após confirmar o e-mail.

Referências: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site e https://supabase.com/docs/reference/javascript/installing
