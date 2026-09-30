# Próxima CRM — primeira versão

React + Vite, Tailwind CSS, Lucide e Supabase. Interface em português e banco em inglês.

## Executar

Requer Node.js 20.19+ ou 22.12+ e pnpm.

```sh
pnpm install
pnpm dev
```

Na tela de entrada, **Explorar demonstração** abre dados fictícios mantidos apenas na memória. A demonstração não envia mensagens nem grava no Supabase. Só a preferência de tema é salva no navegador.

## Ativar o Supabase

1. No projeto `licishnowcussmirivuf`, abra **SQL Editor** e execute uma única vez `supabase/migrations/202609290001_initial.sql`.
2. Copie `.env.example` para `.env.local` e preencha a chave **publishable**. Nunca use chave secret/service_role em variáveis `VITE_*`.
3. Reinicie o Vite. Ative o provedor Email no Supabase Auth e configure a URL do aplicativo e os redirecionamentos permitidos. Para desenvolvimento, use `http://127.0.0.1:5173`; para produção, a URL do domínio publicado.
4. Em Authentication → Sign In / Providers, desative **Allow new users to sign up**. Confirme que **Allow anonymous sign-ins** também está desativado. Esta configuração no servidor é obrigatória: remover o formulário não bloqueia a API.
5. Em Authentication → URL Configuration, use `https://proxima-crm.vercel.app` como Site URL e permita `https://proxima-crm.vercel.app/**` nos redirecionamentos.
6. A conta administradora convida profissionais pela tela Convites da Próxima. O convidado abre o e-mail, define sua própria senha e preenche o perfil. Não divulgue a chave secret nem compartilhe o painel administrativo.

**Situação da entrega:** a migração está no projeto e é testada localmente. As duas migrações foram aplicadas ao Supabase remoto em 29/09/2026 pelo SQL Editor. As antigas tabelas `clientes` e `atendimentos` não são alteradas nem importadas automaticamente. Antes de usar em produção, revise as permissões das tabelas antigas: as políticas desta migração protegem apenas as novas tabelas.

Chaves administrativas devem existir somente nas variáveis privadas do servidor, nunca no código versionado.

## Funcionalidades

- Login com Supabase Auth, entrada por convite administrativo, definição obrigatória da senha pessoal e perfil com um WhatsApp único por profissional.
- Cadastro de cliente com nome/WhatsApp obrigatório, anamnese recolhida e primeiro atendimento.
- Telefones normalizados em formato internacional; duplicidade bloqueada dentro da mesma conta.
- Atendimento com data real, intervalos de 7/15/30/90/180 dias ou valor personalizado (1–3650).
- Próximo contato às 9h em America/Sao_Paulo, calculado a partir da data do atendimento.
- Um novo atendimento cancela o contato pendente anterior dentro da mesma transação. Um índice único e um bloqueio por cliente também protegem contra concorrência.
- Mensagens pendentes/atrasadas, programadas e histórico, busca, edição, reagendamento e cancelamento.
- Link para WhatsApp e confirmação manual de envio. Abrir o link não marca como enviado. Na demonstração, o link não é aberto.
- Ficha e histórico por cliente; edição da anamnese sem novo atendimento.
- Temas claro/escuro, layout responsivo e atualização dos dados a cada 30 segundos e ao voltar à janela.

O número cadastrado identifica o profissional; o usuário precisa manter a sessão correta no WhatsApp. Esta fase não conecta nem verifica a titularidade do número via API. Não existe envio em segundo plano, webhook ou confirmação automática de entrega. A tabela não usa status `failed`, porque o link manual não permite detectar falha de envio.

## Segurança e modelo

`professionals`, `clients`, `client_anamneses`, `appointments`, `messages` usam RLS. IDs compostos impedem relações entre contas diferentes. Usuários autenticados não têm permissão de escrita direta no histórico ou na fila; funções RPC verificam a identidade e executam as operações atômicas. Não há exclusão de clientes pelo aplicativo. `archived_at` prepara o modelo para um fluxo de arquivamento futuro.

A primeira versão usa um texto padrão editável por mensagem. Biblioteca de modelos personalizados e integração API do WhatsApp ficam para uma próxima versão.

## Verificação

```sh
pnpm test
pnpm build
```

Os testes executam a migração em PostgreSQL local via PGlite com uma simulação mínima do `auth.uid()`/papéis do Supabase. Verificam RLS, vínculos entre contas, telefones duplicados, transações, datas e ciclo de mensagens. Não substituem um teste de integração no projeto Supabase real.

## Publicação

Compatível com Vercel ou Netlify: comando `pnpm build`, pasta de saída `dist`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no provedor antes do build. A navegação ocorre no cliente sem URLs adicionais. Publicado na Vercel em https://proxima-crm.vercel.app. Apresentação: https://proxima-crm.vercel.app/?view=portfolio. Demonstração: https://proxima-crm.vercel.app/?demo=1. As variáveis públicas do Supabase foram configuradas no ambiente de produção. As duas migrações SQL estão aplicadas no banco remoto.

## Apresentação comercial

Abra `http://127.0.0.1:5173/?view=portfolio` para apresentar os benefícios e o fluxo do produto a possíveis clientes. Os botões abrem `?demo=1`, que inicia diretamente a demonstração sem login. Os números e nomes da apresentação são ilustrativos. A marca Próxima é uma proposta criativa; disponibilidade de registro e domínio ainda não foi validada.

## Cadastro restrito

O aplicativo não chama `signUp` nem oferece cadastro público. A demonstração continua pública e usa apenas dados fictícios. A restrição efetiva à criação de usuários exige desabilitar inscrições no Supabase Auth; a configuração não é aplicada pelo deploy da Vercel. Contas já existentes não são removidas nem automaticamente consideradas autorizadas: revise-as no painel antes de liberar dados reais. O campo `password_configured` em user_metadata é apenas uma preferência de apresentação do formulário de senha, nunca uma autorização de acesso.


## Administração e primeiro acesso

- A tela de login não oferece recuperação pública de senha. O responsável administra o suporte de acesso.
- As senhas são armazenadas pelo Supabase Auth como hash; nenhuma tabela do CRM armazena senhas.
- Aplique, em ordem, as migrações `202609290001_initial.sql` e `202609290002_account_access.sql`. A segunda exige troca inicial também para contas existentes sem o indicador confiável.
- Configure na Vercel as variáveis privadas `SUPABASE_SECRET_KEY` e `INVITE_TEMP_PASSWORD` (valor definido pelo responsável). Nunca use prefixo `VITE_` nessas variáveis. A URL pública existente é reutilizada pelo servidor.
- Crie a conta inicial com o e-mail do responsável no Supabase Auth. Conceda `app_metadata.role = admin` apenas a essa conta, mantendo `must_change_password = true` até definir a senha pessoal pelo aplicativo. Não use `user_metadata` para conceder permissões.
- O administrador acessa **Convites**. O endpoint verifica a sessão no Supabase e o papel atual em `app_metadata`; profissionais comuns recebem 403 mesmo chamando a API diretamente.
- Convites usam o e-mail do Supabase, confirmam o endereço e exigem uma senha pessoal de 10 a 128 caracteres antes de acessar dados. A senha temporária não confirma o e-mail por conta própria.
- `account_invitations.email` é único: cliques concorrentes e repetições não reenviam convites. Falhas ficam registradas para revisão manual no Supabase; não apague registros para tentar novamente sem conferir se o e-mail já foi enviado.
- A troca inicial é validada pelo servidor e libera o acesso por `app_metadata`. RLS e RPCs conferem o registro atual do Auth, sem confiar em dados editáveis pelo usuário nem em um JWT antigo.
- A administração não permite visualizar senhas pessoais. Configure Site URL e redirects para `https://proxima-crm.vercel.app/` antes de enviar convites reais.
- Execute `pnpm test` e `pnpm build`. Os endpoints Vercel exigem implantação ou `vercel dev`; o Vite sozinho não executa `/api`.

Estado em 29/09/2026: deploy publicado com os endpoints de administração; conta do responsável criada como admin, com troca inicial obrigatória pendente. Verificados em produção: login temporário, bloqueio de convites antes da troca (403), rejeição de senha temporária como senha definitiva (400), account_ready=false. Não foi enviado convite real a terceiros durante a validação.

Para entregar convites a pessoas fora da equipe do projeto Supabase, configure um provedor SMTP próprio em Authentication → Emails. O serviço de e-mail padrão do Supabase restringe destinatários. A entrega externa ainda precisa ser validada após essa configuração.
