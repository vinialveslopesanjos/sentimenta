# Guia de Integração com Redes Sociais

## Resumo Executivo

| Rede Social | Método Recomendado | Dificuldade | Limitações | Status no Sentimenta |
|-------------|-------------------|-------------|------------|---------------------|
| **YouTube** | Scraping (yt-dlp) | ⭐ Fácil | Só perfis públicos | ✅ **Implementado** |
| **Instagram** | Scraping (instaloader) | ⭐⭐ Médio | Só perfis públicos, rate limit | ✅ **Implementado** |
| **TikTok** | Scraping (yt-dlp) | ⭐⭐ Médio | Só públicos, captcha | 🟡 Planejado |
| **Twitter/X** | API Oficial (paga) | ⭐⭐⭐⭐ Difícil | Caro ($100-$5k/mês) | 🟡 Planejado |
| **Facebook** | Graph API | ⭐⭐⭐⭐⭐ Muito difícil | Quase impossível | ❌ Não vale a pena |

---

## 1. YouTube ✅

### ✅ Método atual: Scraping com yt-dlp

**Vantagens:**
- ✅ Funciona **imediatamente**
- ✅ Sem API key, sem OAuth, sem burocracia
- ✅ Acessa vídeos públicos e todos os comentários
- ✅ Gratuito, ilimitado
- ✅ Estável (yt-dlp é mantido ativamente)

**Limitações:**
- ❌ Só vídeos públicos
- ❌ Não acessa analytics privados (views, demographic data)
- ⚠️ Pode quebrar se YouTube mudar a estrutura HTML

**Alternativa (futura):**
- YouTube Data API v3 (grátis até 10k requests/dia)
- Requer API key do Google Cloud
- Acesso a analytics privados (se o usuário autorizar)

**Recomendação:** Manter scraping para MVP. Adicionar API oficial depois.

---

## 2. Instagram ✅

### ✅ Método atual: Scraping com instaloader

**Vantagens:**
- ✅ Funciona hoje, sem OAuth
- ✅ Perfis públicos: posts, comentários, likes
- ✅ Gratuito

**Limitações:**
- ❌ Só perfis **públicos** (95% dos influencers são públicos)
- ❌ Não acessa: DMs, Stories (expiram), insights privados
- ⚠️ Rate limit agressivo (precisa delays entre requests)
- ⚠️ Instagram bloqueia IPs se fizer scraping em massa

**Alternativa (futuro):**
- Instagram Graph API (OAuth)
- **Problema:** Requer App Review do Meta (demora semanas)
- **Problema:** Só funciona com contas Business/Creator + Facebook Page
- **Problema:** 99% dos usuários vão desistir no setup

**Recomendação:** Manter scraping. OAuth só vale se o negócio validar.

**Mitigação de Rate Limit:**
- Usar delays de 2-5s entre requests
- Proxy rotation (serviços como ScraperAPI, BrightData)
- Limitar a 10 posts por sync

---

## 3. TikTok 🟡

### 🟡 Método recomendado: Scraping com yt-dlp

**Vantagens:**
- ✅ yt-dlp suporta TikTok
- ✅ Acessa vídeos públicos e comentários
- ✅ Sem API key

**Limitações:**
- ❌ Rate limit ainda mais agressivo que Instagram
- ❌ TikTok usa captcha com frequência
- ❌ Estrutura muda constantemente
- ⚠️ Pode exigir proxy/VPN

**Alternativa:**
- TikTok API oficial: **MUITO RESTRITA**
  - Só para apps aprovados (tipo agências grandes)
  - Processo de aprovação leva meses
  - Não vale a pena para SaaS B2C

**Implementação:**
```python
# yt-dlp funciona com TikTok
ydl_opts = {'quiet': True}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info('https://www.tiktok.com/@user/video/123', download=False)
    comments = info.get('comments', [])
```

**Recomendação:** Implementar após validar demanda. TikTok é mais nichado (público mais jovem).

---

## 4. Twitter / X 🟡

### ⚠️ Método recomendado: API Oficial (paga)

**Situação atual (2026):**
- Twitter API v2 agora é **PAGA**
- Free tier: **REMOVIDO** (antes dava 500k tweets/mês)
- Planos atuais:
  - **Basic:** $100/mês — 10k tweets/mês (ridículo)
  - **Pro:** $5,000/mês — 1M tweets/mês
  - **Enterprise:** Custom pricing

**Alternativa 1: Scraping**
- ❌ Twitter/X **bloqueia agressivamente** scrapers
- ❌ Requer login (cookies)
- ❌ Captcha constante
- ❌ Estrutura HTML ofuscada
- ⚠️ Bibliotecas como `ntscraper`, `snscrape` quebram toda hora

**Alternativa 2: ScraperAPI + Proxies**
- ✅ Serviços como ScraperAPI, Apify têm scrapers prontos
- 💰 Custa ~$50-200/mês
- ⚠️ Não é 100% confiável

**Recomendação:**

**Para MVP:**
- **NÃO adicionar Twitter** inicialmente
- Foco em YouTube + Instagram (mais fáceis)

**Para produção (se validar o negócio):**
- Avaliar demanda: quantos clientes pedem Twitter?
- Se < 20% → ignorar
- Se > 50% → pagar API ($100/mês) e cobrar premium (plano Enterprise)

---

## 5. Facebook ❌

### ❌ NÃO VALE A PENA

**Por que Facebook é inviável:**

1. **Graph API extremamente restritiva**
   - Só acessa posts de **Pages** (não perfis pessoais)
   - Comentários privados (não retorna comentários de terceiros)
   - App Review demora meses

2. **Scraping é impossível**
   - Facebook bloqueia scrapers agressivamente
   - Requer login, detecção de bot avançada
   - Estrutura HTML dinâmica e ofuscada

3. **Público não usa Facebook para engagement**
   - Maioria dos influencers/políticos usa:
     - YouTube, Instagram, TikTok, Twitter
   - Facebook é mais para Pages corporativas (não precisa análise de sentimento)

**Recomendação:** **Ignorar completamente**. Foco em plataformas que importam.

---

## 🎯 Estratégia Recomendada para o Sentimenta

### **FASE 1: MVP (Agora)**
✅ YouTube (scraping - implementado)
✅ Instagram (scraping - implementado)
❌ Twitter (caro, ignorar no MVP)
❌ TikTok (nichado, ignorar no MVP)
❌ Facebook (inviável)

### **FASE 2: Validação (3-6 meses)**
- Medir quais plataformas os clientes **realmente usam**
- Se 80%+ usam YouTube + Instagram → sucesso, não precisa mais nada
- Se clientes pedem Twitter → avaliar pagar API ($100/mês) e cobrar plano Premium

### **FASE 3: Escala (1 ano+)**
- TikTok (se houver demanda de criadores jovens)
- Twitter API paga (se validar que clientes pagam mais por isso)
- Considerar APIs oficiais do Instagram/YouTube (para analytics privados)

---

## 💡 Como Evitar Rate Limits e Bloqueios

### **1. Delays entre requests**
```python
import time
time.sleep(random.uniform(2, 5))  # Random delay 2-5s
```

### **2. User-Agent rotation**
```python
headers = {
    'User-Agent': random.choice([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
        # etc
    ])
}
```

### **3. Proxy rotation (produção)**
- ScraperAPI: $50/mês (5k requests)
- BrightData: $500/mês (premium proxies)
- Oxylabs: Enterprise ($$$)

### **4. Cache agressivo**
- Não buscar posts que já foram analisados
- Sync apenas 1x por dia (ou sob demanda)

### **5. Limitar scope**
- Máx 10 posts por perfil
- Máx 100 comentários por post
- Usuário pode pagar Premium para aumentar limites

---

## 📊 Comparação: API Oficial vs Scraping

| Aspecto | API Oficial | Scraping |
|---------|------------|----------|
| **Setup** | ❌ Complexo (OAuth, App Review) | ✅ Simples (código pronto) |
| **Custo** | 💰 Grátis até limite, depois caro | ✅ Grátis (ou $50/mês com proxies) |
| **Confiabilidade** | ✅ 99.9% uptime | ⚠️ ~95% (pode quebrar) |
| **Rate Limits** | ⚠️ Limites claros | ⚠️ Bloqueio se abusar |
| **Dados** | ✅ Analytics privados | ❌ Só dados públicos |
| **Manutenção** | ✅ Estável | ⚠️ Requer atualizações |

**Para um MVP/SaaS B2C:** Scraping é **sempre** a melhor escolha.

**Para Enterprise (B2B):** API oficial pode valer a pena (se cliente pagar por isso).

---

## ✅ Decisão Final

**Para o Sentimenta:**

1. **YouTube**: ✅ Scraping (mantém como está)
2. **Instagram**: ✅ Scraping (implementado agora)
3. **TikTok**: 🟡 Implementar depois (se demanda)
4. **Twitter**: 🟡 Adicionar na v2 (API paga, plano Premium)
5. **Facebook**: ❌ Nunca implementar

**Resultado:** Com YouTube + Instagram você cobre **90%** do mercado-alvo (influencers, políticos, profissionais liberais).

---

**Última atualização:** Fevereiro 2026
