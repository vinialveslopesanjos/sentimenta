# Celery no Windows - Guia de Configuração

## ❗ Problema
O Celery no Windows tem problemas com o pool padrão `prefork` (multiprocessing), causando erros:
- `PermissionError: [WinError 5] Access is denied`
- `OSError: [WinError 6] The handle is invalid`

## ✅ Soluções

### Opção 1: Pool SOLO (Recomendado para Dev)
Executa em processo único. Sem concorrência real, mas funciona perfeitamente.

```powershell
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

**Prós:**
- ✅ Funciona imediatamente
- ✅ Fácil debug (sem múltiplos processos)
- ✅ Menor consumo de memória

**Contras:**
- ❌ Processa uma tarefa por vez
- ❌ Não aproveita múltiplos cores

---

### Opção 2: Pool THREADS
Usa threads ao invés de processos. Melhor concorrência que solo.

```powershell
celery -A app.tasks.celery_app worker --loglevel=info --pool=threads --concurrency=4
```

**Prós:**
- ✅ Melhor concorrência que solo
- ✅ Funciona bem no Windows
- ✅ Bom para I/O bound (API calls, DB)

**Contras:**
- ❌ Não evita GIL (Python Global Interpreter Lock)
- ❌ Menos eficiente para CPU bound

---

### Opção 3: Pool GEVENT (Produção no Windows)
Usa greenlets para alta concorrência.

```powershell
# Instalar primeiro
pip install gevent

# Rodar
celery -A app.tasks.celery_app worker --loglevel=info --pool=gevent --concurrency=100
```

**Prós:**
- ✅ Alta concorrência
- ✅ Bom para muitas conexões I/O

**Contras:**
- ❌ Requer instalação extra
- ❌ Pode ter comportamentos estranhos com algumas libs

---

### Opção 4: WSL (Melhor para Produção)
Rode o Celery no Windows Subsystem for Linux com pool prefork normal.

```bash
# No WSL/Ubuntu
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

---

## 🚀 Scripts Prontos

### PowerShell (Recomendado)
```powershell
.\start_celery_win.ps1 -Pool solo -LogLevel info
```

### Batch
```cmd
start_celery_win.bat
```

---

## 📊 Comparação de Pools

| Pool | Concorrência | Windows | Uso Recomendado |
|------|--------------|---------|-----------------|
| `solo` | 1 | ✅ | Desenvolvimento, debug |
| `threads` | 10-50 | ✅ | I/O bound, APIs |
| `gevent` | 100+ | ✅ | Alta concorrência I/O |
| `prefork` | 4-8 | ❌ | Produção Linux/Mac |

---

## 🔍 Comandos Úteis

### Ver filas do Celery
```powershell
celery -A app.tasks.celery_app inspect active
celery -A app.tasks.celery_app inspect scheduled
celery -A app.tasks.celery_app inspect reserved
```

### Purge fila (limpar todas as tasks pendentes)
```powershell
celery -A app.tasks.celery_app purge
```

### Flower (Dashboard web)
```powershell
pip install flower
celery -A app.tasks.celery_app flower --port=5555
# Acesse: http://localhost:5555
```

---

## ⚠️ Notas Importantes

1. **Redis deve estar rodando** antes de iniciar o Celery:
   ```powershell
   docker run -d --name redis -p 6379:6379 redis:latest
   ```

2. **Variável PYTHONPATH**: Sempre defina antes de rodar:
   ```powershell
   $env:PYTHONPATH = "."
   ```

3. **Ambiente Virtual**: Ative o `.venv` antes:
   ```powershell
   .venv\Scripts\activate
   ```

4. **Para Produção no Windows**: Considere usar:
   - WSL2 com pool prefork
   - Docker com Linux containers
   - Azure Container Instances / AWS ECS
