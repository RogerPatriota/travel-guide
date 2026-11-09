# Supabase

Projeto `bkztexprtuozfqmnlluz`. Schema em `migrations/`, aplicado pelo MCP (`apply_migration`).

## Arquivos
- `migrations/20261106023811_initial_schema.sql`: tabelas, RLS, hook de cadastro, profiles.
- `seed.sql`: as 4 datas fixas (voos, check-in, check-out). Sem dados pessoais.
- `tests/rls_smoke.sql`: teste do RLS e dos grants. Cola no SQL Editor; termina sempre com erro
  `OK (n checagens)` ou `FALHOU ...` e não grava nada.

## Quem tem acesso
Os emails **não ficam no repo**. Num banco novo, rodar no SQL Editor:

```sql
insert into private.allowed_emails (email) values ('email1@...'), ('email2@...');
```

Quando um email da lista faz o primeiro login, um trigger cria a linha em `public.profiles`.
`profiles` é a lista de membros: o RLS de todas as tabelas checa `auth.uid()` lá.

## Configuração no painel (uma vez)
1. **Authentication → Hooks → Before User Created**: Postgres function
   `public.hook_before_user_created`. Sem isso, qualquer email consegue criar usuário
   (não vê nada, mas cria).
2. **Authentication → Sign In / Providers**: Email ligado, "Confirm email" ligado.
   Anonymous sign-ins desligado.
3. **Authentication → URL Configuration**:
   - Site URL: a URL da Vercel (até lá, `http://localhost:3000`).
   - Redirect URLs: `http://localhost:3000/auth/confirm` e `https://<app>.vercel.app/auth/confirm`.
4. **Envio de email**: o SMTP padrão só entrega para membros do time da organização,
   ~2 emails/hora, e **não deixa editar os templates**. Configurar SMTP próprio (ex.: Resend)
   em Authentication → Emails → Set up SMTP.
5. **Templates** (só depois do SMTP próprio): Authentication → Emails → **Confirm sign up**
   (primeiro login de cada um) e **Magic link** (logins seguintes), trocar o link por
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`.
   Sem isso o link usa PKCE (`?code=`) e só funciona aberto no mesmo navegador que pediu;
   `/auth/confirm` aceita os dois formatos.
6. Depois que os dois tiverem entrado uma vez, dá pra desligar "Allow new users to sign up".
