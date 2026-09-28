# Ativar o DevNox · Telegram + Supabase

Projeto: **wxvyyjkrmkfvvswxzhua**. Esta versão envia **somente Telegram**.

A URL e a chave pública fornecidas já estão em `config.js`. A chave pública permite usar Auth e acessar dados conforme as políticas RLS; não instala tabelas nem publica funções. Não é necessário compartilhar senha do banco, service role ou token do bot na conversa.

## 1. Abrir no navegador

Leia README.md. Use Live Server no VS Code ou npm start. Configure a URL e a chave pública em config.js. Não há BAT nem compilação. Para demonstração, acrescente ?demo=1 ao endereço.

## 2. SQL: instalar ou atualizar

Abra o [SQL Editor do seu projeto](https://supabase.com/dashboard/project/wxvyyjkrmkfvvswxzhua/sql/new). Copie e execute o conteúdo completo de **`supabase/sql-editor/00-VERIFICAR-INSTALACAO.sql`**. É apenas uma consulta.

Execute **somente um** dos arquivos abaixo:

| Situação                                                                           | Arquivo                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Nenhuma versão do banco DevNox instalada; as cinco tabelas consultadas não existem | `supabase/sql-editor/01-INSTALAR-BANCO-NOVO.sql`       |
| O banco da primeira entrega DevNox já foi instalado                                | `supabase/sql-editor/01-ATUALIZAR-BANCO-EXISTENTE.sql` |

Se existirem apenas algumas tabelas, ou elas pertencerem a outro sistema, confira a instalação antes de continuar. Os scripts usam uma transação. A atualização preserva dados, cancela pendências do canal antigo e deixa apenas Telegram elegível na fila. Campos e histórico antigos permanecem para evitar perda de dados.

O arquivo para banco novo já inclui as duas migrações, inclusive a atualização Telegram. Não execute os dois arquivos de instalação/atualização.

## 3. Criar e autorizar sua conta

No Supabase Authentication, habilite e-mail e configure **Site URL** e a URL de redirecionamento como `http://127.0.0.1:5173`. Use seu domínio real quando publicar. Configure SMTP e os limites adequados antes de abrir cadastros ao público.

Crie sua conta pelo site, confirme o e-mail e entre. Em **Authentication → Users**, copie o UUID desse usuário. Abra **`supabase/sql-editor/02-AUTORIZAR-USUARIO.sql`**, substitua o placeholder e execute:

```sql
insert into public.dispatch_account(singleton,user_id)
values (true,'COLE_AQUI_O_UUID_DO_SEU_USUARIO'::uuid)
on conflict(singleton) do update set user_id=excluded.user_id;
```

Essa é a conta autorizada a enviar por seu bot. Não troque o dono com campanhas pendentes. O mesmo UUID será usado no próximo passo.

## 4. Criar bot e configurar secrets

No Telegram, fale com **@BotFather**, envie `/newbot` e siga os passos. No Supabase, abra **Edge Functions → Secrets** e cadastre:

| Nome                   | Valor                                         |
| ---------------------- | --------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`   | Token gerado pelo BotFather                   |
| `INTEGRATION_OWNER_ID` | UUID autorizado no passo anterior             |
| `WORKER_SECRET`        | Segredo aleatório de pelo menos 32 caracteres |
| `APP_ORIGIN`           | `http://127.0.0.1:5173`                       |

Gere o segredo no terminal e guarde o resultado para o Vault:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não use a chave pública como segredo do worker. Não coloque tokens privados em arquivos públicos. O ambiente das funções hospedadas fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; não coloque a service role no navegador.

Configure esses segredos no painel do Supabase. Não inclua valores privados nos arquivos do projeto.

## 5. Terminal: publicar as funções

Execute dentro da pasta do projeto no terminal:

```powershell
npx supabase login
npx supabase functions deploy channel-status --project-ref wxvyyjkrmkfvvswxzhua
npx supabase functions deploy dispatch-worker --project-ref wxvyyjkrmkfvvswxzhua
```

O `config.toml` contém a configuração de autenticação: `channel-status` valida a sessão e a conta; o worker exige o segredo privado. O token Telegram permanece no servidor.

Se chegou a publicar a função WhatsApp anterior, remova-a pelo painel ou execute:

```powershell
npx supabase functions delete whatsapp-webhook --project-ref wxvyyjkrmkfvvswxzhua
```

Não precisa executar esse último comando se a função antiga não existir. Remova secrets Meta antigas apenas se não forem usadas em outro sistema.

## 6. Vault + SQL: ativar a fila

No **Vault** do Supabase, crie estes dois segredos (se já existirem, atualize os valores):

| Nome                   | Valor                                      |
| ---------------------- | ------------------------------------------ |
| `devnox_project_url`   | `https://wxvyyjkrmkfvvswxzhua.supabase.co` |
| `devnox_worker_secret` | Mesmo valor de `WORKER_SECRET`             |

Execute **`supabase/sql-editor/03-ATIVAR-FILA.sql`** no SQL Editor. Ele habilita Cron/pg_net, verifica os segredos e agenda o worker a cada minuto. Executá-lo novamente atualiza o job de mesmo nome. O computador e o navegador podem ficar desligados durante o envio.

## 7. Seu primeiro envio

1. Abra seu bot e envie `/start` usando a conta que receberá o teste.
2. Descubra o `chat.id` numérico dessa conversa. `@username` e telefone não substituem o chat ID.
3. Cadastre seu contato no DevNox com esse número e a autorização.
4. Use **Canais → Verificar bot**: o site deve informar o username correto.
5. Envie primeiro para seu próprio contato, aguarde o Cron e confira no Telegram. Use **Atualizar** em Campanhas para consultar o resultado.

Para descobrir o chat ID, execute localmente no PowerShell:

```powershell
$telegramSecureToken = Read-Host 'Token do bot' -AsSecureString
$telegramCredential = New-Object System.Net.NetworkCredential('', $telegramSecureToken)
$telegramToken = $telegramCredential.Password
$telegramUpdates = Invoke-RestMethod -Uri ('https://api.telegram.org/bot' + $telegramToken + '/getUpdates')
$telegramUpdates.result.message.chat | Select-Object id, first_name, type
Remove-Variable telegramToken, telegramCredential, telegramSecureToken
```

Escolha o ID associado à pessoa correta, não apenas o primeiro resultado. Não publique dados pessoais dessa saída. `getUpdates` só funciona sem webhook de recebimento configurado; esta versão não instala webhook Telegram. O bot precisa ter acesso ao chat e a pessoa deve iniciar a conversa privada antes de receber mensagens.

## 8. Nomes diferentes na mesma campanha

```text
Olá, {nome}! Temos novidades para a {{empresa}}.
```

Selecione Ana e Bruno. Alterne **Prévia para** ou use as setas. **Conferir todas as mensagens** abre as duas versões. A confirmação final também mostra cada mensagem personalizada.

A prévia não altera o texto salvo: os marcadores permanecem no rascunho. O worker resolve os dados separadamente para cada chat. Ao entrar na fila, nome/empresa/link são copiados por destinatário; alterações posteriores de nome não mudam campanhas já enfileiradas. Autorizações revogadas e destinos alterados são rechecados antes do envio. Chats duplicados recebem uma mensagem por campanha.

## 9. Limites e diagnóstico

Um bot e uma conta de envio por instalação. Até 500 contatos por campanha, texto de até 4096 caracteres ou legenda de até 1024 após personalização. Um arquivo JPG/PNG/MP4/PDF de até 5 MB por campanha.

O Cron processa pequenos lotes; o intervalo é mínimo e o agendamento não garante segundos exatos. Cancelamento afeta pendentes; uma mensagem já em processamento pode concluir. Timeouts ficam como **Verificar envio**, sem repetição automática. Confira no Telegram antes de reenviar. **Processada** pode incluir falhas. **Aceita pela API** não significa lida; bots não recebem confirmação de leitura.

| Sintoma            | Conferir                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Erro de tabelas    | Instalação SQL do passo 2                                                                   |
| Bot não autorizado | UUID no SQL e `INTEGRATION_OWNER_ID` iguais                                                 |
| Erro CORS          | `APP_ORIGIN` igual à origem exata do navegador, incluindo porta                             |
| Fila parada        | Cron ativo, valores do Vault, funções publicadas, logs do worker e respostas HTTP do pg_net |
| API 400/403        | Chat ID, `/start`, bot bloqueado ou sem acesso ao chat                                      |
| API 429            | Limite do Telegram; reduza volume/aumente intervalo e confira antes de reenviar             |

Anexos removidos da composição ainda ficam no Storage; a limpeza é administrativa. Não apague arquivos usados em campanhas. Não há caixa de entrada nem cadastro automático de contatos nesta versão.

## 10. Publicar no GitHub Pages

Siga README.md: publique os arquivos estáticos na raiz da branch main e ative Settings → Pages. Configure as URLs de autenticação e APP_ORIGIN para a hospedagem.


