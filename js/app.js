// =============================================
// Marketo QA Tool — UI Logic
// =============================================

const CATEGORY_ICONS = {
    'Branding':     '🏷️',
    'Meta Tags':    '📋',
    'Typography':   '🔤',
    'Show / Hide':  '👁️',
    'Buttons':      '🔘',
    'Sections':     '📐',
    'Naming':       '🏷️',
    'Code Quality': '🔍',
    'Forms':        '📝',
    'Layout':       '📏'
};

const SEVERITY_LABEL = { critical: 'Critical', warning: 'Warning', info: 'Info' };

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const dropZone       = document.getElementById('dropZone');
const codeInput      = document.getElementById('codeInput');
const fileInput      = document.getElementById('fileInput');
const uploadBtn      = document.getElementById('uploadBtn');
const clearBtn       = document.getElementById('clearBtn');
const validateBtn    = document.getElementById('validateBtn');
const resultsSection = document.getElementById('resultsSection');
const resultsBody    = document.getElementById('resultsBody');
const exportBtn      = document.getElementById('exportBtn');
const charCount      = document.getElementById('charCount');
const toastEl        = document.getElementById('toast');

// Summary elements
const sumPassed   = document.getElementById('sumPassed');
const sumCritical = document.getElementById('sumCritical');
const sumWarning  = document.getElementById('sumWarning');
const sumInfo     = document.getElementById('sumInfo');

let lastReport = null;

// ── File Upload Logic ─────────────────────────────────────────────────────────
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
    Array.from(e.target.files).forEach(file => readFile(file));
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(file => readFile(file));
});

function readFile(file) {
    if (!file.name.match(/\.(html|htm|css)$/i)) {
        showToast('⚠️ Please upload HTML or CSS files.', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        if (file.name.match(/\.(html|htm)$/i)) {
            codeInput.value = e.target.result;
            updateCharCount();
            showToast(`✅ Loaded HTML: ${file.name}`, 'success');
        } else if (file.name.match(/responsive/i) && file.name.match(/\.css$/i)) {
            document.getElementById('responsiveInput').value = e.target.result;
            showToast(`✅ Loaded Responsive CSS: ${file.name}`, 'success');
        } else if (file.name.match(/\.css$/i)) {
            document.getElementById('styleInput').value = e.target.result;
            showToast(`✅ Loaded Style CSS: ${file.name}`, 'success');
        }
    };
    reader.readAsText(file);
}

// ── Textarea helpers ──────────────────────────────────────────────────────────
codeInput.addEventListener('input', updateCharCount);

function updateCharCount() {
    const len = codeInput.value.length;
    charCount.textContent = len > 0 ? `${len.toLocaleString()} characters` : '';
}

clearBtn.addEventListener('click', () => {
    codeInput.value = '';
    updateCharCount();
    resultsSection.classList.add('hidden');
    lastReport = null;
});

// ── Validate ──────────────────────────────────────────────────────────────────
validateBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code) {
        showToast('⚠️ Please paste or upload template code first.', 'warning');
        codeInput.focus();
        return;
    }

    const styleCSS = document.getElementById('styleInput').value.trim();
    const responsiveCSS = document.getElementById('responsiveInput').value.trim();

    if (!styleCSS) {
        showToast('⚠️ Please paste your Style CSS.', 'warning');
        document.getElementById('styleInput').focus();
        return;
    }

    if (!responsiveCSS) {
        showToast('⚠️ Please paste your Responsive CSS.', 'warning');
        document.getElementById('responsiveInput').focus();
        return;
    }

    validateBtn.disabled = true;
    validateBtn.querySelector('.btn-text').textContent = 'Validating…';

    setTimeout(() => {
        try {
            lastReport = Validator.run({ code, styleCSS, responsiveCSS });
            renderResults(lastReport);
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const { summary } = lastReport;
            const msg = summary.critical > 0
                ? `🔴 ${summary.critical} critical issue(s) found.`
                : summary.warning > 0
                    ? `🟡 ${summary.warning} warning(s) found.`
                    : `✅ Validation complete — ${summary.passed} rules passed.`;
            showToast(msg, summary.critical > 0 ? 'error' : summary.warning > 0 ? 'warning' : 'success');
        } catch (err) {
            showToast(`❌ Validation error: ${err.message}`, 'error');
        } finally {
            validateBtn.disabled = false;
            validateBtn.querySelector('.btn-text').textContent = 'Validate';
        }
    }, 50);
});

// ── Render Results ────────────────────────────────────────────────────────────
function renderResults(report) {
    const { results, summary } = report;

    // Summary counts
    sumPassed.textContent   = summary.passed;
    sumCritical.textContent = summary.critical;
    sumWarning.textContent  = summary.warning;
    sumInfo.textContent     = summary.info;

    // Group by category
    const byCategory = {};
    results.forEach(r => {
        if (!byCategory[r.category]) byCategory[r.category] = [];
        byCategory[r.category].push(r);
    });

    resultsBody.innerHTML = '';

    Object.entries(byCategory).forEach(([category, rules]) => {
        const catPassed  = rules.filter(r => r.passed).length;
        const catFailed  = rules.length - catPassed;
        const hasCritical = rules.some(r => !r.passed && r.severity === 'critical');
        const hasWarning  = rules.some(r => !r.passed && r.severity === 'warning');
        const catStatus   = hasCritical ? 'critical' : hasWarning ? 'warning' : catFailed > 0 ? 'info' : 'passed';

        const section = document.createElement('div');
        section.className = 'cat-section';
        section.innerHTML = `
            <div class="cat-header" onclick="toggleCat(this)">
                <span class="cat-icon">${CATEGORY_ICONS[category] || '📌'}</span>
                <span class="cat-name">${category}</span>
                <span class="cat-stats">
                    <span class="badge badge-${catStatus === 'passed' ? 'passed' : catStatus}">${catFailed} issue${catFailed !== 1 ? 's' : ''}</span>
                    <span class="cat-score">${catPassed}/${rules.length} passed</span>
                </span>
                <span class="cat-chevron">▼</span>
            </div>
            <div class="cat-body">
                ${rules.map(r => renderRule(r)).join('')}
            </div>`;
        resultsBody.appendChild(section);
    });
}

function renderRule(rule) {
    if (rule.passed) {
        return `<div class="rule-item rule-passed">
            <span class="rule-status-icon">✅</span>
            <div class="rule-info">
                <div class="rule-name">${rule.name}</div>
                <div class="rule-desc">${rule.description}</div>
            </div>
        </div>`;
    }

    const issueHTML = rule.issues.map(issue => `
        <div class="issue-item">
            <div class="issue-header">
                <span class="badge badge-${rule.severity}">${SEVERITY_LABEL[rule.severity]}</span>
                ${issue.line ? `<span class="issue-line">Line ${issue.line}</span>` : ''}
            </div>
            <div class="issue-message">⚠ ${escHtml(issue.message)}</div>
            <div class="issue-suggestion">💡 ${escHtml(issue.suggestion)}</div>
        </div>`).join('');

    return `<div class="rule-item rule-failed">
        <span class="rule-status-icon">❌</span>
        <div class="rule-info">
            <div class="rule-name">${rule.name}</div>
            <div class="rule-desc">${rule.description}</div>
            <div class="issues-list">${issueHTML}</div>
        </div>
    </div>`;
}

function toggleCat(header) {
    const body = header.nextElementSibling;
    const chevron = header.querySelector('.cat-chevron');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
}

// ── Export Report ─────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', () => {
    if (!lastReport) return;
    const { results, summary } = lastReport;
    let text = `MARKETO QA VALIDATION REPORT\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `${'='.repeat(60)}\n\n`;
    text += `SUMMARY\n${'-'.repeat(30)}\n`;
    text += `Total Rules : ${summary.total}\n`;
    text += `Passed      : ${summary.passed}\n`;
    text += `Critical    : ${summary.critical}\n`;
    text += `Warnings    : ${summary.warning}\n`;
    text += `Info        : ${summary.info}\n\n`;

    const byCategory = {};
    results.forEach(r => {
        if (!byCategory[r.category]) byCategory[r.category] = [];
        byCategory[r.category].push(r);
    });

    Object.entries(byCategory).forEach(([cat, rules]) => {
        text += `\n${'='.repeat(60)}\n${cat.toUpperCase()}\n${'='.repeat(60)}\n`;
        rules.forEach(r => {
            const icon = r.passed ? '✅' : '❌';
            text += `\n${icon} ${r.name} [${r.severity.toUpperCase()}]\n`;
            if (!r.passed) {
                r.issues.forEach(issue => {
                    text += `   • ${issue.message}${issue.line ? ` (Line ${issue.line})` : ''}\n`;
                    text += `     Fix: ${issue.suggestion}\n`;
                });
            }
        });
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `marketo-qa-report-${Date.now()}.txt`;
    a.click();
    showToast('📄 Report exported!', 'success');
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    toastEl.textContent = msg;
    toastEl.className = `toast toast-${type} show`;
    setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal Logic ─────────────────────────────────────────────────────────────
const rulesModal = document.getElementById('rulesModal');
const rulesModalBody = document.getElementById('rulesModalBody');
const rulesBadgeBtn = document.getElementById('rulesBadgeBtn');
const closeModalBtn = document.getElementById('closeModalBtn');

function renderRulesModal() {
    const byCategory = {};
    RULES.forEach(r => {
        if (!byCategory[r.category]) byCategory[r.category] = [];
        byCategory[r.category].push(r);
    });

    let html = '';
    Object.entries(byCategory).forEach(([cat, rules]) => {
        html += `<div class="modal-rule-group">
            <div class="modal-rule-cat">${CATEGORY_ICONS[cat]} ${cat}</div>
            ${rules.map(r => `
                <div class="modal-rule-item">
                    <div class="modal-rule-header">
                        <span class="badge badge-${r.severity}">${SEVERITY_LABEL[r.severity]}</span>
                        <span class="modal-rule-title">${r.name}</span>
                    </div>
                    <div class="modal-rule-desc">${r.description}</div>
                </div>
            `).join('')}
        </div>`;
    });
    rulesModalBody.innerHTML = html;
}

if (rulesBadgeBtn) {
    rulesBadgeBtn.addEventListener('click', () => {
        if (!rulesModalBody.innerHTML.trim() || rulesModalBody.innerHTML.includes('will be injected')) {
            renderRulesModal();
        }
        rulesModal.classList.remove('hidden');
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        rulesModal.classList.add('hidden');
    });
}

if (rulesModal) {
    rulesModal.addEventListener('click', e => {
        if (e.target === rulesModal) rulesModal.classList.add('hidden');
    });
}
