# Amara NZero — Dashboard de Pedidos

Dashboard de gestão de pedidos solar para o CD FSA da Amara NZero.

## 🚀 Deploy Rápido (Vercel + Supabase)

### 1. Supabase (banco de dados)
1. Crie conta em [supabase.com](https://supabase.com) → New Project
2. Vá em **SQL Editor** → **New Query**
3. Cole o conteúdo de `supabase_schema.sql` e clique **Run**
4. Em **Settings → API** copie:
   - `Project URL` → será o `VITE_SUPABASE_URL`
   - `anon public` key → será o `VITE_SUPABASE_ANON_KEY`

### 2. GitHub
```bash
git init
git add .
git commit -m "feat: amara nzero dashboard"
git remote add origin https://github.com/SEU_USUARIO/amara-dashboard.git
git push -u origin main
```

### 3. Vercel
1. Acesse [vercel.com](https://vercel.com) → **New Project** → importe seu repo
2. Em **Environment Variables** adicione:
   - `VITE_SUPABASE_URL` = sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = sua anon key
3. Clique **Deploy** ✅

---

## 💻 Desenvolvimento Local

```bash
# 1. Clone e instale
git clone https://github.com/SEU_USUARIO/amara-dashboard.git
cd amara-dashboard
npm install

# 2. Configure o .env
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase

# 3. Rode
npm run dev
```

## 📦 Armazenamento Supabase (Plano Gratuito: 500MB)

| Tabela     | ~MB por 1.000 pedidos | 500MB comporta |
|------------|----------------------|----------------|
| `pedidos`  | 0,15 MB             | ~3.3 milhões   |
| `produtos` | 0,10 MB por 1k SKUs | ~5 milhões     |

**Estratégia de compressão:**
- `valor` salvo em **centavos** (INTEGER) em vez de DECIMAL
- `kwp` salvo ×10 como INTEGER (1 decimal preservado)
- Strings truncadas ao necessário
- Cache no localStorage por 5 min (reduz requisições)

## 🏗️ Estrutura

```
src/
├── components/
│   └── Dashboard.jsx      # Componente principal (tudo em 1 arquivo)
├── lib/
│   ├── supabase.js         # Cliente + queries
│   └── theme.js            # Temas dark/light
├── hooks/
│   └── useOrders.js        # Hook de dados com sync
├── utils/
│   └── constants.js        # Constantes e formatadores
└── main.jsx                # Entry point
```

## 🌗 Funcionalidades

- ☀️/🌙 **Modo claro/escuro** com transição suave
- 📊 **Dashboard** com KPIs, gráficos e tabela de pedidos
- 🔄 **Merge inteligente** ao importar novos relatórios (.xlsx/.zip)
- ☁️ **Sync automático** com Supabase
- 📦 **Cache local** (5 min) para carregamento instantâneo
- 🤖 **Amar Elo** — assistente IA de inteligência solar
- 🏆 **Ranking de vendedores** reativo
