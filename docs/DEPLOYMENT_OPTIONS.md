# Deployment Options & Free Tier Guide

This document outlines the best free-tier hosting and database options for personal web applications (React/Next.js stack), categorized by complexity and resource generosity.

## 🏆 The "Unlimited" Holy Grail (Compute & Bandwidth)

If optimizing for maximum raw resources for $0 is the goal, these providers offer the highest caps.

| Provider | Type | The "Generous" Part | Best For |
|----------|------|---------------------|----------|
| **Oracle Cloud** | VPS / Backend | **"Always Free" Tier**: 4 ARM vCPUs, 24 GB RAM, and 200 GB Storage. Massive compute power compared to AWS/Google (approx 24x more RAM). | Hosting everything (Docker, DBs, Backends) if you know Linux. |
| **Cloudflare Pages** | Frontend / Static | **Unlimited Bandwidth** and requests. Unlike Vercel/Netlify (capped ~100GB), Cloudflare doesn't charge for traffic. | Static sites, SPAs (React/Vue), and Next.js (Edge runtime). |

---

## 📦 Backend-as-a-Service (Auth + Database + API)

Alternatives to Supabase for "all-in-one" backends.

| Provider | Type | Free Tier Limits | Notes |
|----------|------|------------------|-------|
| **Supabase** | Postgres | 500MB DB, 5GB bandwidth, 50k MAUs. | **Recommended**. Great DX, SQL power, good limits. |
| **Appwrite** | Open Source | 2GB storage, 750k executions, 75k users. | Similar to Firebase/Supabase but fully open source. |
| **PocketBase** | Go Binary | *Self-host only* (No cloud free tier). | Perfect pair for Oracle Cloud VPS. Single file backend. |
| **Firebase** | NoSQL | "Spark Plan": 1GB storage, 10GB transfer. | Industry standard, but scaling costs can spike. |
| **Convex** | Realtime | 1M function calls/mo, 1GB storage. | "Backend that replaces your backend". React-native focus. |

---

## 🗄️ Database Only Options

If you just need a raw SQL/NoSQL database to connect to.

| Provider | Database | Free Tier Limits | Notes |
|----------|----------|------------------|-------|
| **Neon** | Postgres | 0.5 GB storage. | Serverless, scales to zero. Great for low-usage apps. |
| **MongoDB Atlas**| NoSQL | 512 MB storage (M0 Sandbox). | The standard for document stores (JSON-like data). |
| **Turso** | SQLite | 9 GB storage, 1B reads/mo. | **Very Generous**. Edge-based SQLite, extremely fast reads. |
| **TiDB** | MySQL | 5 GB storage, 50M units. | Serverless MySQL alternative. |

---

## 🌐 Web Hosting (Frontend)

Where to put your Next.js/React code.

| Provider | Free Tier Limits | Notes |
|----------|------------------|-------|
| **Vercel** | 100GB Bandwidth | **Recommended for Next.js**. Best DX, zero config. strict commercial limits. |
| **Netlify** | 100GB Bandwidth | Great for general purpose static sites. 300 build mins/mo. |
| **Render** | Web Services | Free backend spins down (sleeps) after 15m inactivity. Slow starts. |
| **Fly.io** | 3 small VMs | *Trial only*. eventually requires crediting. Good tech, less "free". |

---

## 🚀 Recommended Stacks for MindSync

### Option A: The "Developer Experience" (Recommended)
*Fastest setup, standard tools, reliable.*
- **Frontend**: **Vercel** (Zero-config Next.js hosting)
- **Database**: **Supabase** (Postgres + Auth)
- **Pros**: Setup takes <5 mins, industry standard tools.
- **Cons**: Bandwidth caps (though 100GB is plenty for personal apps).

### Option B: The "Zero Cost" Powerhouse
*Maximum resources, higher maintenance.*
- **Host**: **Oracle Cloud Always Free** VPS (24GB RAM)
- **Orchestration**: **Coolify** (Open source Heroku-alternative installed on the VPS)
- **Database**: Self-hosted Postgres (via Coolify)
- **Pros**: $0 forever, massive power, "own your data".
- **Cons**: Requires Linux knowledge, managing updates/backups yourself.

### Option C: The "Unlimited Frontend"
*Best for high-traffic public sites.*
- **Frontend**: **Cloudflare Pages** (Unlimited bandwidth)
- **Database**: **Turso** (9GB SQLite) or **Supabase**
- **Pros**: Never hit a bandwidth cap.
- **Cons**: Cloudflare Workers/Pages have slight differences from standard Node.js runtime.
