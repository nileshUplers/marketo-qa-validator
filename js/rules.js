// =============================================
// Marketo QA Tool — Rule Definitions
// =============================================

function findLine(lines, search) {
    if (!search) return null;
    const s = search.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(s)) return i + 1;
    }
    return null;
}

const RULES = [

    // ─── BRANDING ───────────────────────────────────────────────────────────
    {
        id: 'no-company-names',
        name: 'No Agency Names in Code',
        category: 'Branding',
        severity: 'critical',
        description: 'Source code must not contain "Uplers" or "Mavlers".',
        check(ctx) {
            const { lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            const checkLines = (lineArr, source) => {
                lineArr.forEach((line, idx) => {
                    const re = /\b(uplers|mavlers)\b/gi;
                    let m;
                    while ((m = re.exec(line)) !== null) {
                        issues.push({
                            line: idx + 1,
                            message: `Found agency name "${m[0]}" in ${source}`,
                            suggestion: 'Remove all references to agency names from source code, CSS, and comments.'
                        });
                    }
                });
            };
            checkLines(lines, 'HTML');
            checkLines(styleLines, 'Style CSS');
            checkLines(responsiveLines, 'Responsive CSS');
            return { issues };
        }
    },

    // ─── META TAGS ───────────────────────────────────────────────────────────
    {
        id: 'viewport-auto-zoom',
        name: 'Viewport: Prevent Auto-Zoom on iOS',
        category: 'Meta Tags',
        severity: 'critical',
        description: 'Viewport meta must prevent auto-zoom on iPhone Safari.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const meta = doc.querySelector('meta[name="viewport"]');
            if (!meta) {
                issues.push({ line: 1, message: 'Viewport meta tag is missing', suggestion: 'Add: <meta name="viewport" content="width=device-width, minimum-scale=1.0, maximum-scale=1.0">' });
                return { issues };
            }
            const content = meta.getAttribute('content') || '';
            const hasMaxScale = /maximum-scale\s*=\s*1\.0/.test(content);
            const preventsZoom = /minimum-scale\s*=\s*1\.0/.test(content) || /user-scalable\s*=\s*0/.test(content);
            if (!hasMaxScale || !preventsZoom) {
                issues.push({
                    line: findLine(lines, 'viewport'),
                    message: `Viewport does not prevent auto-zoom. Current: "${content}"`,
                    suggestion: 'Use: content="width=device-width, minimum-scale=1.0, maximum-scale=1.0"'
                });
            }
            return { issues };
        }
    },

    // ─── TYPOGRAPHY ──────────────────────────────────────────────────────────
    {
        id: 'font-smoothing',
        name: 'Font Smoothing on Body',
        category: 'Typography',
        severity: 'warning',
        description: 'Body must have -webkit-font-smoothing: antialiased.',
        check(ctx) {
            const { raw, styleCSS, lines, styleLines } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS;
            // Matches: body { ... -webkit-font-smoothing: antialiased ... } or html, body { ... }
            const bodyHasSmoothing = /(?:^|\s|,|\})body(?:\s*|,.*?)\{[^}]*-webkit-font-smoothing\s*:\s*antialiased[^}]*\}/i.test(fullCss);
            if (!bodyHasSmoothing) {
                issues.push({ line: findLine(lines, 'body') || findLine(styleLines, 'body'), message: 'body missing -webkit-font-smoothing: antialiased', suggestion: 'Add -webkit-font-smoothing: antialiased to the body CSS rule.' });
            }
            return { issues };
        }
    },
    {
        id: 'global-heading-styles',
        name: 'Global H1–H6 Styles',
        category: 'Typography',
        severity: 'warning',
        description: 'All heading levels H1–H6 must be styled globally.',
        check(ctx) {
            const { raw, styleCSS } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS;
            for (let i = 1; i <= 6; i++) {
                const pattern = new RegExp(`(?:[\\s,{>])h${i}(?:[\\s{,.:]|$)`, 'm');
                if (!pattern.test(fullCss)) {
                    issues.push({ line: null, message: `h${i} is not styled globally in CSS`, suggestion: `.up h${i} { font-size: ...; line-height: ...; }` });
                }
            }
            return { issues };
        }
    },
    {
        id: 'global-list-styles',
        name: 'Global ul / ol / li Styles',
        category: 'Typography',
        severity: 'warning',
        description: 'Lists must have global CSS styles for consistent formatting.',
        check(ctx) {
            const { raw, styleCSS } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS;
            ['ul', 'ol', 'li'].forEach(tag => {
                const pattern = new RegExp(`(?:[\\s,{>])${tag}(?:[\\s{,.]|$)`, 'm');
                if (!pattern.test(fullCss)) {
                    issues.push({ line: null, message: `<${tag}> not globally styled`, suggestion: `Add .up ${tag} { ... } in your main <style> block.` });
                }
            });
            return { issues };
        }
    },
    {
        id: 'font-weight-bold-check',
        name: 'Bold Font — Mac Chrome Verification',
        category: 'Typography',
        severity: 'info',
        description: 'flag font-weight: bold/700 for manual Mac Chrome verification (passes automatically if body font-smoothing is active).',
        check(ctx) {
            const { raw, styleCSS, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS;
            
            // Check if smoothing is already present
            const bodyHasSmoothing = /(?:^|\s|,|\})body(?:\s*|,.*?)\{[^}]*-webkit-font-smoothing\s*:\s*antialiased[^}]*\}/i.test(fullCss);
            
            // If smoothing is present, no need to flag bold fonts
            if (bodyHasSmoothing) {
                return { issues };
            }

            const checkLines = (lineArr, source) => {
                lineArr.forEach((line, idx) => {
                    if (/font-weight\s*:\s*(bold|700)\b/i.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
                        issues.push({ line: idx + 1, message: `font-weight: bold/700 in ${source} — verify rendering on Mac Chrome`, suggestion: 'Ensure -webkit-font-smoothing: antialiased is on body for correct bold rendering.' });
                    }
                });
            };
            checkLines(lines, 'HTML');
            checkLines(styleLines, 'Style CSS');
            checkLines(responsiveLines, 'Responsive CSS');
            return { issues };
        }
    },

    // ─── SHOW / HIDE ─────────────────────────────────────────────────────────
    {
        id: 'section-show-hide',
        name: 'Section Show/Hide Toggles',
        category: 'Show / Hide',
        severity: 'critical',
        description: 'All sections (excl. header/footer) must have mktoBoolean show/hide.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const boolIds = Array.from(doc.querySelectorAll('meta.mktoBoolean')).map(m => m.id);
            const sections = doc.querySelectorAll('[class*="-section"], .mid-container > div[class]');
            const seen = new Set();
            sections.forEach(section => {
                const cls = section.className.split(' ')[0];
                if (seen.has(cls) || !cls) return;
                if (section.closest('header') || section.closest('footer')) return;
                seen.add(cls);
                const style = section.getAttribute('style') || '';
                const displayMatch = style.match(/display\s*:\s*\$\{([^}]+)\}/);
                if (!displayMatch) {
                    issues.push({ line: findLine(lines, cls), message: `Section ".${cls}" has no show/hide control`, suggestion: `Add style="display:\${show_${cls.replace(/-section/,'')}};" and declare a mktoBoolean in <head>.` });
                } else {
                    const varId = displayMatch[1].trim();
                    if (!boolIds.includes(varId)) {
                        issues.push({ line: findLine(lines, varId), message: `show/hide variable "\${${varId}}" used but not declared as mktoBoolean`, suggestion: `Add: <meta class="mktoBoolean" id="${varId}" mktoName="Show Section" default="true" false_value="none" true_value="block">` });
                    }
                }
            });
            return { issues };
        }
    },
    {
        id: 'hidden-section-no-gap',
        name: 'Hidden Sections Must Not Create Gaps',
        category: 'Show / Hide',
        severity: 'warning',
        description: 'mktoBoolean false_value must be "none" to collapse hidden sections.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            doc.querySelectorAll('meta.mktoBoolean').forEach(meta => {
                const falseVal = meta.getAttribute('false_value');
                if (falseVal && falseVal !== 'none') {
                    issues.push({ line: findLine(lines, meta.id), message: `mktoBoolean "${meta.id}" uses false_value="${falseVal}" — may leave spacing gaps`, suggestion: 'Change to false_value="none" so the section fully collapses when hidden.' });
                }
            });
            return { issues };
        }
    },

    // ─── BUTTONS ─────────────────────────────────────────────────────────────
    {
        id: 'button-show-hide',
        name: 'Button Show/Hide Toggle',
        category: 'Buttons',
        severity: 'critical',
        description: 'Each button must have an independent show/hide mktoBoolean.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const boolIds = Array.from(doc.querySelectorAll('meta.mktoBoolean')).map(m => m.id);
            doc.querySelectorAll('.btn_grp').forEach(grp => {
                const parent = grp.parentElement;
                if (!parent) return;
                const style = parent.getAttribute('style') || '';
                const gp = parent.parentElement;
                const gpStyle = gp ? (gp.getAttribute('style') || '') : '';
                const hasToggle = /display\s*:\s*\$\{/.test(style) || /display\s*:\s*\$\{/.test(gpStyle);
                if (!hasToggle) {
                    issues.push({ line: findLine(lines, parent.className || 'btn_grp'), message: `Button group in ".${parent.className || 'unknown'}" has no show/hide toggle`, suggestion: 'Wrap in a div with style="display:${show_btn};" and add mktoBoolean in <head>.' });
                } else {
                    const m = (style + gpStyle).match(/display\s*:\s*\$\{([^}]+)\}/);
                    if (m && !boolIds.includes(m[1].trim())) {
                        issues.push({ line: findLine(lines, m[1]), message: `Button toggle variable "\${${m[1]}}" not declared as mktoBoolean`, suggestion: `Add: <meta class="mktoBoolean" id="${m[1]}" mktoName="Show Button" default="true" false_value="none" true_value="block">` });
                    }
                }
            });
            return { issues };
        }
    },
    {
        id: 'button-editable-text',
        name: 'Button Text Must Be Editable (mktoText)',
        category: 'Buttons',
        severity: 'critical',
        description: 'Button text must be wrapped in mktoText for editor access.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            doc.querySelectorAll('.btn_grp a, .btn_grp > div > a').forEach(btn => {
                const hasText = btn.classList.contains('mktoText') || !!btn.querySelector('.mktoText');
                if (!hasText) {
                    const id = btn.id || btn.className || 'button';
                    issues.push({ line: findLine(lines, id), message: `Button "${id}" text is not editable (no mktoText)`, suggestion: 'Add <span class="mktoText" id="btn_text" mktoName="Button Text"> inside the anchor.' });
                }
            });
            return { issues };
        }
    },
    {
        id: 'button-colors-editable',
        name: 'Button Colors Must Be Editable (mktoColor)',
        category: 'Buttons',
        severity: 'critical',
        description: 'Buttons need mktoColor for BG, hover BG, border, hover border, and text color.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const hasBtns = !!doc.querySelector('.btn_grp');
            if (!hasBtns) return { issues };
            const colorIds = Array.from(doc.querySelectorAll('meta.mktoColor')).map(m => m.id.toLowerCase());
            const required = [
                { pattern: /btn.*bg|btn.*background/i, label: 'Button BG Color' },
                { pattern: /btn.*hover.*bg|hover.*btn.*bg/i, label: 'Button Hover BG Color' },
                { pattern: /btn.*border/i, label: 'Button Border Color' },
                { pattern: /btn.*hover.*border|hover.*btn.*border/i, label: 'Button Hover Border Color' },
                { pattern: /btn.*text/i, label: 'Button Text Color' }
            ];
            required.forEach(r => {
                if (!colorIds.some(id => r.pattern.test(id))) {
                    issues.push({ line: findLine(lines, 'mktoColor'), message: `Missing mktoColor variable for: ${r.label}`, suggestion: `Add <meta class="mktoColor" id="btn_color" mktoName="${r.label}" default="#000000"> in <head>.` });
                }
            });
            return { issues };
        }
    },
    {
        id: 'button-no-hardcoded-colors',
        name: 'No Hardcoded Colors on Buttons',
        category: 'Buttons',
        severity: 'warning',
        description: 'Button inline styles and CSS must not have hardcoded hex colors.',
        check(ctx) {
            const { raw, styleCSS, responsiveCSS, doc, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            
            // HTML Inline
            doc.querySelectorAll('.btn_grp a, .btn_grp > div > a, .sticky_btn a').forEach(btn => {
                const style = btn.getAttribute('style') || '';
                const hexMatch = style.match(/#[0-9a-fA-F]{3,6}/);
                if (hexMatch) {
                    const id = btn.id || btn.className || 'button';
                    issues.push({ line: findLine(lines, hexMatch[0]), message: `Button "${id}" has hardcoded color "${hexMatch[0]}" in inline style`, suggestion: 'Replace hardcoded hex with Marketo variable e.g. style="color: ${btn_text_color};"' });
                }
            });

            // External CSS checking for .btn classes and hex
            const checkCssText = (cssArr, source) => {
                cssArr.forEach((line, idx) => {
                    if (/\.btn(_grp)?(-.*?)?\s*\{[^}]*#[0-9a-fA-F]{3,6}/i.test(line)) {
                         // crude regex to find hex inside curly braces connected to btn class
                         // Let's instead just look for direct btn class and hex in same line for simplicity since it's hard to parse full CSS robustly with regex
                    }
                    if (/(btn|button)[^{]*\{[^{]*#[0-9a-fA-F]{3,6}/i.test(line)) {
                        issues.push({ line: idx + 1, message: `Button styles in ${source} have hardcoded color`, suggestion: 'Avoid hardcoded colors for buttons to allow Marketo customisation.' });
                    }
                });
            }

            checkCssText(styleLines, 'Style CSS');
            checkCssText(responsiveLines, 'Responsive CSS');
            
            return { issues };
        }
    },

    // ─── SECTIONS ────────────────────────────────────────────────────────────
    {
        id: 'section-reorder-support',
        name: 'Section Reordering via CSS Order',
        category: 'Sections',
        severity: 'critical',
        description: 'Sections must support Marketo reordering via CSS order property.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const seen = new Set();
            doc.querySelectorAll('[class*="-section"], .mid-container > div[class]').forEach(section => {
                const cls = section.className.split(' ')[0];
                if (seen.has(cls) || !cls) return;
                if (section.closest('header') || section.closest('footer')) return;
                seen.add(cls);
                const style = section.getAttribute('style') || '';
                if (!/order\s*:\s*\$\{[^}]+\}/.test(style)) {
                    const hasHardcoded = /\border\s*:\s*\d/.test(style);
                    issues.push({
                        line: findLine(lines, cls),
                        message: `Section ".${cls}" has no dynamic order property for reordering`,
                        suggestion: `Add "order: \${${cls.replace(/-section/, '')}_order};" to section style and declare mktoString in <head>.`
                    });
                }
            });
            return { issues };
        }
    },
    {
        id: 'section-bg-color-editable',
        name: 'Section Background Color Editable',
        category: 'Sections',
        severity: 'warning',
        description: 'Each section must have an mktoColor variable for background color.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const seen = new Set();
            doc.querySelectorAll('[class*="-section"], .mid-container > div[class]').forEach(section => {
                const cls = section.className.split(' ')[0];
                if (seen.has(cls) || !cls) return;
                if (section.closest('header') || section.closest('footer')) return;
                seen.add(cls);
                const style = section.getAttribute('style') || '';
                if (!/background-color\s*:\s*\$\{[^}]+\}/.test(style)) {
                    const hardcoded = style.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,6}|rgb)/);
                    if (hardcoded) {
                        issues.push({ line: findLine(lines, cls), message: `Section ".${cls}" has hardcoded background-color`, suggestion: `Use background-color: \${${cls.replace(/-/g,'_')}_bg_color} and add mktoColor in <head>.` });
                    } else {
                        issues.push({ line: findLine(lines, cls), message: `Section ".${cls}" has no editable background color`, suggestion: `Add background-color: \${${cls.replace(/-/g,'_')}_bg_color} to section style and declare mktoColor in <head>.` });
                    }
                }
            });
            return { issues };
        }
    },
    {
        id: 'section-bg-image-editable',
        name: 'Background Images Must Be Editable',
        category: 'Sections',
        severity: 'info',
        description: 'Hardcoded background-image URLs in styles should use Marketo variables.',
        check(ctx) {
            const { doc, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            
            // Inline HTML
            doc.querySelectorAll('[style*="background-image"]').forEach(el => {
                const style = el.getAttribute('style');
                if (!style.includes('${')) {
                    issues.push({ line: findLine(lines, 'background-image'), message: `Element ".${el.className.split(' ')[0]}" has hardcoded background-image`, suggestion: 'Use background-image: url(${bg_image_variable}) with mktoString or mktoImg.' });
                }
            });

            // External CSS
            const checkCssBg = (cssArr, source) => {
                cssArr.forEach((line, idx) => {
                    const bgInLine = line.match(/background-image\s*:\s*url\(['"]?(?!\$\{)(?!.*\$\{)[^)'"]+['"]?\)/gi);
                    if (bgInLine) {
                        issues.push({ line: idx + 1, message: `Hardcoded background-image in ${source}: "${bgInLine[0].slice(0, 60)}"`, suggestion: 'Use a mktoString variable for editability.' });
                    }
                });
            };

            checkCssBg(styleLines, 'Style CSS');
            checkCssBg(responsiveLines, 'Responsive CSS');
            
            return { issues };
        }
    },

    // ─── NAMING ──────────────────────────────────────────────────────────────
    {
        id: 'mkto-naming-convention',
        name: 'Marketo ID Naming Convention',
        category: 'Naming',
        severity: 'warning',
        description: 'mkto IDs must follow section_element pattern, no generic names.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const generic = /^(module|section|div|item|element|new|test|comp|block|part|area|widget|region)\d*$/i;
            doc.querySelectorAll('[id][class*="mkto"]').forEach(el => {
                const id = el.id;
                if (!id || id.includes('${')) return;
                if (generic.test(id)) {
                    issues.push({ line: findLine(lines, `id="${id}"`), message: `Generic mkto ID "${id}" found`, suggestion: 'Rename to follow section_element pattern (e.g., banner_title, footer_logo_img).' });
                } else if (!id.includes('_')) {
                    issues.push({ line: findLine(lines, `id="${id}"`), message: `mkto ID "${id}" missing section prefix`, suggestion: `Add a section prefix: e.g., "sectionname_${id}".` });
                }
            });
            return { issues };
        }
    },

    // ─── CODE QUALITY ────────────────────────────────────────────────────────
    {
        id: 'mktoname-case',
        name: 'mktoName Must Be camelCase',
        category: 'Code Quality',
        severity: 'critical',
        description: '"mktoName" must use capital N — Marketo is case-sensitive.',
        check(ctx) {
            const { lines } = ctx;
            const issues = [];
            lines.forEach((line, idx) => {
                // match mktoname= but NOT mktoName= (case-sensitive)
                if (/mktoname\s*=/i.test(line) && !/mktoName\s*=/.test(line)) {
                    issues.push({ line: idx + 1, message: 'Lowercase "mktoname" attribute found', suggestion: 'Replace mktoname= with mktoName= (capital N). Marketo ignores attributes with wrong case.' });
                }
            });
            return { issues };
        }
    },
    {
        id: 'duplicate-scripts',
        name: 'Duplicate Script Tags',
        category: 'Code Quality',
        severity: 'warning',
        description: 'Same script URL or script ID should not appear more than once.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const seenSrc = {}, seenId = {};
            doc.querySelectorAll('script[src]').forEach(s => {
                const src = s.getAttribute('src');
                if (seenSrc[src]) {
                    issues.push({ line: findLine(lines, src), message: `Duplicate script loaded: "${src}"`, suggestion: 'Remove the duplicate <script> tag — each external script should load only once.' });
                } else seenSrc[src] = true;
            });
            doc.querySelectorAll('script[id]').forEach(s => {
                const id = s.id;
                if (seenId[id]) {
                    issues.push({ line: findLine(lines, id), message: `Duplicate script block id="${id}"`, suggestion: 'Remove the duplicate script block — may cause double registration or JS errors.' });
                } else seenId[id] = true;
            });
            return { issues };
        }
    },
    {
        id: 'duplicate-ids',
        name: 'Duplicate HTML Element IDs',
        category: 'Code Quality',
        severity: 'warning',
        description: 'All HTML element IDs must be unique.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const seen = {};
            doc.querySelectorAll('[id]').forEach(el => {
                const id = el.id;
                if (!id || id.includes('${')) return;
                if (seen[id] && !seen[id].reported) {
                    seen[id].reported = true;
                    issues.push({ line: findLine(lines, `id="${id}"`), message: `Duplicate id="${id}" found`, suggestion: `Rename one of the duplicate "${id}" attributes — all IDs must be unique.` });
                } else if (!seen[id]) {
                    seen[id] = { reported: false };
                }
            });
            return { issues };
        }
    },
    {
        id: 'image-alt-text',
        name: 'Image Alt Text',
        category: 'Code Quality',
        severity: 'info',
        description: 'All images must have meaningful alt attributes.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            doc.querySelectorAll('img').forEach(img => {
                const alt = img.getAttribute('alt');
                const src = img.getAttribute('src') || '';
                const filename = src.split('/').pop().split('?')[0] || 'image';
                const isMkto = img.classList.contains('mktoImg');
                if (alt === null) {
                    issues.push({ line: findLine(lines, filename), message: `Image "${filename}" missing alt attribute`, suggestion: 'Add alt="" for decorative images or a descriptive alt for meaningful ones.' });
                } else if (alt.trim() === '' && isMkto) {
                    issues.push({ line: findLine(lines, filename), message: `Editable image (mktoImg) "${filename}" has empty default alt`, suggestion: 'Add a descriptive default alt — editors may not add alt when swapping images.' });
                }
            });
            return { issues };
        }
    },

    // ─── FORMS ───────────────────────────────────────────────────────────────
    {
        id: 'form-elements-styled',
        name: 'Form Elements Globally Styled',
        category: 'Forms',
        severity: 'info',
        description: 'Input, select, textarea, radio, checkbox must have consistent global CSS.',
        check(ctx) {
            const { raw, styleCSS, responsiveCSS } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS + '\n' + responsiveCSS;
            const checks = [
                { label: 'Text inputs (input[type=text/email])', pattern: /input\s*\{|input\[type[^]]*?(text|email)/i },
                { label: 'Dropdowns (select)', pattern: /select\s*\{|select\s*,/i },
                { label: 'Textarea', pattern: /textarea\s*\{/i },
                { label: 'Radio buttons (input[type=radio])', pattern: /input\[type=.?radio/i },
                { label: 'Checkboxes (input[type=checkbox])', pattern: /input\[type=.?checkbox/i }
            ];
            checks.forEach(({ label, pattern }) => {
                if (!pattern.test(fullCss)) {
                    issues.push({ line: null, message: `No global CSS found for: ${label}`, suggestion: `Add styles for ${label} in the main <style> block.` });
                }
            });
            return { issues };
        }
    },
    {
        id: 'thank-you-message',
        name: 'Thank You / Success Message Styled',
        category: 'Forms',
        severity: 'info',
        description: 'A styled Thank You message must exist and match the UI design.',
        check(ctx) {
            const { raw, styleCSS, responsiveCSS, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS + '\n' + responsiveCSS;
            const hasTy = /thank.?you|thankyou|success.?msg|form.?success|mktFormMsg|confirmation/i.test(raw);
            if (!hasTy) {
                issues.push({ line: null, message: 'No Thank You / success message found', suggestion: 'Add a styled Thank You section triggered on form submission matching the UI design.' });
            } else {
                const hasTyStyle = /\.?thank.?you\s*\{|#thank|\.?form.?success\s*\{|\.?mktFormMsg/i.test(fullCss);
                if (!hasTyStyle) {
                    issues.push({ line: findLine(lines, 'thank') || findLine(styleLines, 'thank') || findLine(responsiveLines, 'thank'), message: 'Thank You element found but no matching CSS styles detected', suggestion: 'Add CSS for the Thank You state that matches the overall design.' });
                }
            }
            return { issues };
        }
    },

    // ─── LAYOUT ──────────────────────────────────────────────────────────────
    {
        id: 'equal-height-flexbox',
        name: 'Equal-Height Columns Use Flexbox',
        category: 'Layout',
        severity: 'info',
        description: 'Side-by-side equal-height columns must use display:flex on the parent.',
        check(ctx) {
            const { raw, styleCSS, responsiveCSS, doc, lines } = ctx;
            const issues = [];
            const fullCss = raw + '\n' + styleCSS + '\n' + responsiveCSS;
            const targets = ['location-content-wrapper', 'footer_btm_grp', 'footer_inner_grp', 'agenda-content-wrapper', 'header-inner'];
            targets.forEach(cls => {
                const el = doc.querySelector(`.${cls}`);
                if (!el) return;
                const escape = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const hasFlexInCSS = new RegExp(`\\.${escape}[^{]*\\{[^}]*display\\s*:\\s*flex`, 'is').test(fullCss);
                const hasFlexInStyle = /display\s*:\s*flex/.test(el.getAttribute('style') || '');
                if (!hasFlexInCSS && !hasFlexInStyle) {
                    issues.push({ line: findLine(lines, cls), message: `".${cls}" uses side-by-side columns but no display:flex found`, suggestion: `Add display: flex to .${cls} { } in your CSS for reliable equal-height layout.` });
                }
            });
            return { issues };
        }
    }
];
