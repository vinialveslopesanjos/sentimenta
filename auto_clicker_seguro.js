// ═══════════════════════════════════════════════════════════
// AUTO-CLICKER SEGURO PARA O BOTÃO "Aprovar/Aceitar"
// Modificado para não aprovar coisas perigosas (exclusões de bd ou arquivos)
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ==================== GESTÃO DE ESTADO ====================
    const state = {
        interval: null,
        ui: null,
        totalClicks: 0,
        totalScrolls: 0,
        isCollapsed: false
    };

    // Padrões de comandos perigosos que bloquearão o auto-click
    const dangerousPatterns = [
        /\brm\s+-/i,                     // rm -rf, rm -r
        /\brm\s+[\w.\-\/\\*]+/i,         // rm arquivo
        /\bdel\s+[\w.\-\/\\*]+/i,        // del arquivo (Windows)
        /\bremove-item\b/i,              // Remove-Item (PowerShell)
        /\bdrop\s+table\b/i,             // SQL DROP TABLE
        /\bdrop\s+database\b/i,          // SQL DROP DATABASE
        /\bdelete\s+from\b/i,            // SQL DELETE FROM
        /\btruncate\s+table\b/i,         // SQL TRUNCATE TABLE
        /\brd\s+\/s/i,                   // Windows rd /s
        /\brmdir\b/i,                    // rmdir
        /\bprisma\s+migrate\s+reset\b/i, // Prisma reset
        /\bdb\..+\.drop\(\)/i,           // MongoDB db.col.drop()
        /\bdb\..+\.deleteMany/i          // MongoDB db.col.deleteMany()
    ];

    // Palavras que indicam o botão que queremos clicar
    const clickKeywords = ['aceitar', 'aprovar', 'confirmar', 'executar etapa', 'executar', 'approve', 'confirm', 'run', 'execute step'];

    // ==================== LIMPEZA ====================
    function cleanup() {
        if (window.autoClickerInterval) {
            clearInterval(window.autoClickerInterval);
        }

        const oldUI = document.getElementById('auto-clicker-indicator');
        if (oldUI) oldUI.remove();

        window.autoClickerInterval = null;
        window.autoClickerUI = null;
    }

    // ==================== CRIAÇÃO DA UI ====================
    function createUI() {
        const container = document.createElement('div');
        container.id = 'auto-clicker-indicator';
        container.style.cssText = `
            position: fixed; top: 20px; left: 20px;
            background: rgba(30, 30, 30, 0.95); color: #cccccc;
            padding: 15px 20px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px; z-index: 999999;
            border: 1px solid #4ec9b0; backdrop-filter: blur(4px);
            min-width: 250px;
        `;

        const titleBar = document.createElement('div');
        titleBar.id = 'title-bar';
        titleBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: move;';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; color: #4ec9b0; flex: 1;';
        title.textContent = '🛡️ Auto-Clicker Seguro';

        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'collapse-btn';
        collapseBtn.textContent = '−';
        collapseBtn.style.cssText = 'background: transparent; color: #cccccc; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-size: 18px; width: 24px; height: 24px; padding: 0; line-height: 1; margin-left: 10px;';

        titleBar.appendChild(title);
        titleBar.appendChild(collapseBtn);

        const contentWrapper = document.createElement('div');
        contentWrapper.id = 'content-wrapper';
        contentWrapper.style.display = 'block';

        const clickedDiv = document.createElement('div');
        clickedDiv.style.cssText = 'margin-bottom: 8px; color: #858585;';
        clickedDiv.appendChild(document.createTextNode('Aprovados: '));
        const clickCountSpan = document.createElement('span');
        clickCountSpan.id = 'click-count';
        clickCountSpan.style.cssText = 'color: #4ec9b0; font-weight: bold;';
        clickCountSpan.textContent = '0';
        clickedDiv.appendChild(clickCountSpan);
        clickedDiv.appendChild(document.createTextNode(' vezes'));

        const clickLabel = document.createElement('label');
        clickLabel.style.cssText = 'display: flex; align-items: center; cursor: pointer; user-select: none; margin-bottom: 8px;';
        const clickCheckbox = document.createElement('input');
        clickCheckbox.type = 'checkbox';
        clickCheckbox.id = 'auto-click-checkbox';
        clickCheckbox.checked = true;
        clickCheckbox.style.cssText = 'margin-right: 8px; cursor: pointer; width: 16px; height: 16px;';
        const clickText = document.createElement('span');
        clickText.textContent = 'Ativar Auto-Click';
        clickLabel.append(clickCheckbox, clickText);

        const killBtn = document.createElement('button');
        killBtn.id = 'kill-btn';
        killBtn.textContent = '🛑 Parar & Fechar';
        killBtn.style.cssText = 'width: 100%; padding: 8px; margin-top: 8px; background: #c74440; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';

        const status = document.createElement('div');
        status.id = 'status-text';
        status.style.cssText = 'margin-top: 10px; font-size: 12px; color: #858585; text-align: center; font-weight: bold;';
        status.textContent = '🔍 Escaneando...';

        contentWrapper.append(clickedDiv, clickLabel, killBtn, status);
        container.append(titleBar, contentWrapper);
        document.body.appendChild(container);

        setupEventListeners(container);
        setupDraggable(container);

        return container;
    }

    // ==================== OUVINTES DE EVENTOS ====================
    function setupEventListeners(container) {
        const collapseBtn = container.querySelector('#collapse-btn');
        const contentWrapper = container.querySelector('#content-wrapper');
        const titleBar = container.querySelector('#title-bar');

        collapseBtn.onclick = () => {
            state.isCollapsed = !state.isCollapsed;
            if (state.isCollapsed) {
                contentWrapper.style.display = 'none';
                collapseBtn.textContent = '+';
                container.style.minWidth = 'auto';
                container.style.padding = '8px 12px';
                titleBar.style.marginBottom = '0';
            } else {
                contentWrapper.style.display = 'block';
                collapseBtn.textContent = '−';
                container.style.minWidth = '250px';
                container.style.padding = '15px 20px';
                titleBar.style.marginBottom = '10px';
            }
        };

        container.querySelector('#kill-btn').onclick = () => {
            cleanup();
            console.log('🛑 AUTO-CLICKER PARADO');
        };
    }

    // ==================== ARRASTÁVEL ====================
    function setupDraggable(container) {
        let isDragging = false;
        let currentX = 0, currentY = 0;
        let initialX = 0, initialY = 0;
        let xOffset = 0, yOffset = 0;
        const titleBar = container.querySelector('#title-bar');
        const collapseBtn = container.querySelector('#collapse-btn');

        titleBar.addEventListener('mousedown', (e) => {
            if (e.target === collapseBtn) return;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        });

        document.addEventListener('mouseup', () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        });
    }

    // ==================== ENCONTRAR O BOTÃO ====================
    function findAndClickButton() {
        try {
            const autoClickEnabled = document.getElementById('auto-click-checkbox').checked;
            if (!autoClickEnabled) {
                document.getElementById('status-text').textContent = '⏸️ Pausado';
                document.getElementById('status-text').style.color = '#858585';
                return;
            }

            // Precisamos procurar tanto no document principal quanto em iframes
            const docsToScan = [document];
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (doc) docsToScan.push(doc);
                } catch (e) { }
            });

            let foundSafeButton = false;
            let blockedDangerous = false;

            docsToScan.forEach(doc => {
                const bodyTextLower = doc.body.innerText.toLowerCase();

                // Verificar se o documento atual contém comandos perigosos
                let isDangerous = false;
                for (let pattern of dangerousPatterns) {
                    if (pattern.test(bodyTextLower)) {
                        isDangerous = true;
                        break;
                    }
                }

                // Procurar os botões neste documento
                const buttons = doc.querySelectorAll('button');
                buttons.forEach(button => {
                    const textLower = (button.textContent || '').trim().toLowerCase();
                    const isTargetButton = clickKeywords.some(kw => textLower.includes(kw));

                    if (isTargetButton && button.offsetWidth > 0 && button.offsetHeight > 0 && !button.disabled) {
                        if (isDangerous) {
                            // Se achou um comando perigoso na mesma tela, avisa e NÃO clica
                            button.style.border = '2px solid #c74440';
                            button.style.boxShadow = '0 0 15px #c74440';
                            button.style.backgroundColor = 'rgba(199, 68, 64, 0.2)';
                            blockedDangerous = true;
                        } else {
                            // Clica no botão e faz um efeitinho visual
                            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            button.style.transition = 'all 0.3s';
                            button.style.boxShadow = '0 0 15px #4ec9b0';
                            setTimeout(() => {
                                button.click();
                                state.totalClicks++;
                                const countEl = document.getElementById('click-count');
                                if (countEl) countEl.textContent = state.totalClicks;
                            }, 500);
                            foundSafeButton = true;
                        }
                    }
                });
            });

            // Atualiza status na interface
            const statusEl = document.getElementById('status-text');
            if (statusEl) {
                if (blockedDangerous) {
                    statusEl.textContent = '⚠️ Bloqueado: Comando Perigoso!';
                    statusEl.style.color = '#c74440';
                    document.getElementById('auto-clicker-indicator').style.borderColor = '#c74440';
                } else if (foundSafeButton) {
                    statusEl.textContent = '✅ Aprovando...';
                    statusEl.style.color = '#4ec9b0';
                    document.getElementById('auto-clicker-indicator').style.borderColor = '#4ec9b0';
                } else {
                    statusEl.textContent = '🔍 Escaneando...';
                    statusEl.style.color = '#858585';
                    document.getElementById('auto-clicker-indicator').style.borderColor = '#4ec9b0';
                }
            }

        } catch (error) {
            console.error('❗ Erro no Auto-Clicker:', error);
        }
    }

    // ==================== INICIALIZAÇÃO ====================
    cleanup();
    state.ui = createUI();
    window.autoClickerUI = state.ui;

    console.log('🛡️ AUTO-CLICKER SEGURO ATIVO');
    console.log('Ignorando exclusões no banco e deleção de arquivos.');

    findAndClickButton();
    state.interval = setInterval(findAndClickButton, 3000);
    window.autoClickerInterval = state.interval;

})();
