# Agiliza Seller Painel — Deploy

Painel Next.js 16 + Supabase. Funciona 100% identico ao codigo principal.

## Por que Vercel e nao GitHub Pages

GitHub Pages serve so estaticos. Este app usa:

- **Server Actions** (`'use server'`) — login, salvar custos, CSV, admin de usuarios.
- **Supabase SSR** com cookies HttpOnly — sessao segura, nao acessivel via JS.
- **Middleware `proxy.ts`** — guard de rotas antes do render.
- **Service role admin** — criar/deletar usuarios (NUNCA pode rodar no browser).

Static export quebra tudo isso. Vercel roda Next.js completo, free tier, deploy em 5 min.

## Stack

- Next.js 16.2 (App Router, Turbopack)
- React 19
- Supabase (auth + Postgres + RLS)
- Tailwind v4
- Recharts
- TypeScript

## Setup — passo a passo

### 1. Criar repositorio GitHub

```bash
# Na pasta deploy-vercel/, inicializar git
git init
git add .
git commit -m "Inicial"

# Criar repo vazio em github.com/new (ex: agiliza-painel)
git remote add origin https://github.com/SEU_USUARIO/agiliza-painel.git
git branch -M main
git push -u origin main
```

> Alternativa: arrastar conteudo desta pasta no GitHub via interface web.

### 2. Conectar Vercel

1. Acessar [vercel.com/new](https://vercel.com/new)
2. Login com GitHub
3. **Import** o repo `agiliza-painel`
4. Framework: **Next.js** (auto-detectado)
5. **NAO deployar ainda** — falta env vars

### 3. Configurar variaveis de ambiente

No painel Vercel → Settings → Environment Variables. Copiar do `.env.example`:

| Nome | Valor | Onde achar |
|------|-------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (longo) | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (longo, sensivel) | Supabase → Settings → API → service_role |

> `service_role` so precisa se for usar `/admin/usuarios`. Sem ela, admin quebra mas resto funciona.

Marcar todos pros 3 ambientes: **Production**, **Preview**, **Development**.

### 4. Deploy

Clicar **Deploy**. Aguardar ~2 min. URL fica tipo `agiliza-painel.vercel.app`.

### 5. Configurar dominio do Supabase

Supabase → Authentication → URL Configuration:
- **Site URL**: `https://agiliza-painel.vercel.app`
- **Redirect URLs**: adicionar `https://agiliza-painel.vercel.app/**`

Senao login redireciona pra localhost.

### 6. Criar usuario admin inicial

Supabase → Authentication → Users → Add user → Create new user.

Pegar `user_id`, rodar no SQL Editor:

```sql
update profiles set role = 'admin' where id = 'USER_ID_AQUI';
```

Depois login no painel com esse e-mail.

## Rodar local

```bash
npm install
cp .env.example .env.local
# editar .env.local com chaves reais
npm run dev
```

Abrir [localhost:3000](http://localhost:3000).

## Estrutura

```
src/
  app/
    (auth)/login/         # tela login
    (dashboard)/          # rotas autenticadas
      dashboard/          # home
      shopee/             # pedidos, anuncios, envios, saude, metricas
      mercado-livre/      # idem (mockado)
      magazord/           # estoque, fiscal, metricas, pedidos, produtos
      shein/              # estoque, financeiro, metricas, pedidos, produtos
      admin/usuarios/     # gestao usuarios (admin only)
      configuracoes/      # conexoes marketplace
      alertas/
    actions/              # server actions (auth, shopee, connections)
  lib/supabase/           # clients (server, client, admin)
  components/             # sidebar, top-bar, charts, icons
  proxy.ts                # middleware (route guard)
```

## Custos

Vercel Hobby (free):
- 100 GB bandwidth/mes
- Builds ilimitados
- Dominio `.vercel.app` gratis
- Custom dominio gratis (so DNS)

Supera free → upgrade Pro $20/mes. Pra este painel, free sobra.

## Troubleshooting

**Build falha por env vars faltando**
Conferir Vercel → Settings → Environment Variables. As 2 `NEXT_PUBLIC_*` sao obrigatorias.

**Login funciona mas redireciona pra localhost**
Configurar Supabase Site URL e Redirect URLs (passo 5).

**`/admin/usuarios` da erro 500**
Falta `SUPABASE_SERVICE_ROLE_KEY` no Vercel. Adicionar e redeployar.

**Pagina branca apos login**
Conferir RLS na tabela `profiles`. User precisa ter linha em `profiles` com `role`.
