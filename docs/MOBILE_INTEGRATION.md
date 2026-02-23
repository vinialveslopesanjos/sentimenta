# 📱 Guia: Integrando o App Mobile ao Monorepo

> Siga este guia para trazer o repo `vinialveslopesanjos/Sentimentaapp`
> para dentro do monorepo sentimenta, na branch `sentimenta_turbo`.

---

## Pré-requisitos

- Branch `sentimenta_turbo` ativa neste repo
- Node.js 20+ instalado
- Expo CLI instalado (`npm install -g expo-cli`)

---

## Step 1: Clonar o repo do app

```powershell
# Na raiz do monorepo
cd d:\vscode\Projetos\social_media_sentiment

# Clonar o repo do app em uma pasta temporária
git clone https://github.com/vinialveslopesanjos/Sentimentaapp.git _temp_app
```

## Step 2: Copiar para apps/mobile

```powershell
# Criar pasta apps
mkdir apps

# Copiar conteúdo (exceto .git)
Copy-Item -Path "_temp_app\*" -Destination "apps\mobile\" -Recurse -Force

# Remover temp
Remove-Item -Path "_temp_app" -Recurse -Force
```

## Step 3: Atualizar package.json raiz para incluir o mobile

```json
// package.json (raiz)
{
  "name": "sentimenta",
  "workspaces": [
    "packages/*",
    "frontend",
    "apps/mobile"
  ]
}
```

## Step 4: Atualizar o package.json do mobile

```json
// apps/mobile/package.json
{
  "name": "@sentimenta/mobile",
  "dependencies": {
    "@sentimenta/types": "*",
    "@sentimenta/api-client": "*"
  }
}
```

## Step 5: Configurar o API client no mobile

Criar `apps/mobile/src/lib/api.ts` (ou onde seu app guarda configs):

```typescript
import { createApiClient } from "@sentimenta/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.sentimenta.com.br/api/v1",
  
  // Lê o token do AsyncStorage (React Native)
  getToken: async () => {
    try {
      return await AsyncStorage.getItem("sentimenta_access_token");
    } catch {
      return null;
    }
  },
  
  // Auto-logout quando token expirar
  onUnauthorized: () => {
    AsyncStorage.removeItem("sentimenta_access_token");
    AsyncStorage.removeItem("sentimenta_refresh_token");
    // Navegar para login — depende da sua navigation setup
    // Ex: router.replace("/login") se usar Expo Router
  },
});
```

## Step 6: Variáveis de ambiente do mobile

Criar `apps/mobile/.env`:
```env
# Desenvolvimento local
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:8000/api/v1
# (substituir pelo IP local da sua máquina)

# Produção (quando subir para VPS)
# EXPO_PUBLIC_API_URL=https://api.sentimenta.com.br/api/v1
```

> ⚠️ Use o IP local da máquina, não `localhost`.
> No terminal: `ipconfig` → IPv4 Address do adaptador Wi-Fi.

## Step 7: Instalar dependências do workspace

```powershell
# Na raiz do monorepo:
npm install

# Isso instala tudo, incluindo @sentimenta/types e @sentimenta/api-client
# resolvidos como pacotes locais (sem publicar no npm)
```

## Step 8: Build dos tipos compartilhados

```powershell
npm run build:packages
```

## Step 9: Rodar o app no iPhone

```powershell
# 1. Backend rodando localmente
# (já documentado em PRODUCTION_GUIDE.md)

# 2. Rodar o app Expo
cd apps/mobile
npx expo start

# 3. No iPhone:
# - Baixar "Expo Go" na App Store
# - Escanear o QR Code no terminal
# - O app abre instantaneamente! ✅
```

---

## Estrutura após integração

```
sentimenta/
├── apps/
│   └── mobile/                  ← Sentimentaapp (Expo/React Native)
│       ├── src/
│       │   └── lib/
│       │       └── api.ts       ← usa @sentimenta/api-client
│       ├── app.json
│       └── package.json         ← @sentimenta/mobile
│
├── packages/
│   ├── types/                   ← @sentimenta/types
│   └── api-client/              ← @sentimenta/api-client
│
├── frontend/                    ← @sentimenta/web (Next.js)
│   └── lib/
│       └── api.ts               ← usa @sentimenta/api-client
│
└── backend/                     ← FastAPI
```

---

## Troubleshooting

### Problema: "Module @sentimenta/types not found"
```bash
# Rodar build dos pacotes
npm run build:packages
# E verificar node_modules symlinks
npm install
```

### Problema: Não conecta ao backend
```bash
# Verificar se o backend está rodando:
curl http://SEU_IP_LOCAL:8000/health
# Deve retornar: {"status":"ok"}

# Verificar se o IP no .env do mobile está correto
ipconfig | findstr "IPv4"
```

### Problema: "Network request failed" no Expo Go
- Garantir que iPhone e PC estão na **mesma rede Wi-Fi**
- Desabilitar firewall do Windows temporariamente
- Usar IP local (não localhost)
