// =============================================
// Marketo QA Tool — Rule Definitions
// =============================================

function findLine(lines, search, startIndex = 0) {
    if (!search || !lines) return null;
    const s = search.toLowerCase();
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(s)) return i + 1;
    }
    return null;
}

function findLineRegex(lines, regex) {
    if (!lines || !regex) return null;
    for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].replace(/\/\*[\s\S]*?\*\//g, '');
        if (regex.test(cleanLine)) return i + 1;
    }
    return null;
}

const stripComments = (str) => (str || '').replace(/\/\*[\s\S]*?\*\//g, '');

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
            const { doc, styleCSS, responsiveCSS, lines, styleLines } = ctx;
            const issues = [];
            
            // Collect all CSS and strip comments
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;
            
            // Matches: body { ... -webkit-font-smoothing: antialiased ... } or html, body { ... }
            const bodyHasSmoothing = /(?:^|\s|,|\})body(?:\s*|,.*?)\{[^}]*-webkit-font-smoothing\s*:\s*antialiased[^}]*\}/i.test(fullCss);
            
            if (!bodyHasSmoothing) {
                issues.push({ 
                    line: findLine(lines, 'body') || findLine(styleLines, 'body'), 
                    message: 'body missing active -webkit-font-smoothing: antialiased', 
                    suggestion: 'Add -webkit-font-smoothing: antialiased to the body CSS rule.' 
                });
            }
            return { issues };
        }
    },
    {
        id: 'global-heading-styles',
        name: 'Global H1–H6 Styles',
        category: 'Typography',
        severity: 'warning',
        description: 'All heading levels H1–H6 present in the template must be styled globally.',
        check(ctx) {
            const { doc, styleCSS, responsiveCSS, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            
            const mainCss = stripComments(styleCSS);
            const respCss = stripComments(responsiveCSS);
            
            for (let i = 1; i <= 6; i++) {
                const tag = `h${i}`;
                if (doc.querySelector(tag)) {
                    const pattern = new RegExp(`(?:^|,|\\.up\\s+)\\s*${tag}\\s*[{,:]`, 'im');
                    
                    const inMain = pattern.test(mainCss);
                    const inTags = pattern.test(styleTags);
                    const inResp = pattern.test(respCss);

                    if (inMain || inTags) {
                        const line = inMain ? findLineRegex(styleLines, pattern) : findLineRegex(lines, pattern);
                        const file = inMain ? 'Style CSS' : 'HTML Style Tag';
                        issues.push({ 
                            line, 
                            message: `Global style for ${tag.toUpperCase()} detected in ${file}.`, 
                            severity: 'info',
                            suggestion: 'Confirmed global baseline style found.' 
                        });
                    } else if (inResp) {
                        const line = findLineRegex(responsiveLines, pattern);
                        issues.push({ 
                            line, 
                            message: `${tag.toUpperCase()} is styled in Responsive CSS only but lacks a global base style in your main CSS.`, 
                            suggestion: `Add .up ${tag} { ... } in your main <style> block.` 
                        });
                    } else {
                        issues.push({ 
                            line: null, 
                            message: `${tag.toUpperCase()} is used in HTML but lacks a global base style entirely.`, 
                            suggestion: `Add .up ${tag} { font-size: ...; font-family: ...; } in your main <style> block.` 
                        });
                    }
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
        description: 'Lists present in the template must have global CSS styles.',
        check(ctx) {
            const { doc, styleCSS, responsiveCSS, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            
            const stripComments = (str) => (str || '').replace(/\/\*[\s\S]*?\*\//g, '');
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            
            const mainCss = stripComments(styleCSS);
            const respCss = stripComments(responsiveCSS);
            
            ['ul', 'ol', 'li'].forEach(tag => {
                if (doc.querySelector(tag)) {
                    const pattern = new RegExp(`(?:^|,|\\.up\\s+)\\s*${tag}\\s*[{,:]`, 'im');
                    
                    const inMain = pattern.test(mainCss);
                    const inTags = pattern.test(styleTags);
                    const inResp = pattern.test(respCss);

                    if (inMain || inTags) {
                        const line = inMain ? findLineRegex(styleLines, pattern) : findLineRegex(lines, pattern);
                        const file = inMain ? 'Style CSS' : 'HTML Style Tag';
                        issues.push({ 
                            line, 
                            message: `Global style for <${tag}> detected in ${file}.`, 
                            severity: 'info',
                            suggestion: 'Confirmed global baseline style found.' 
                        });
                    } else if (inResp) {
                        const line = findLineRegex(responsiveLines, pattern);
                        issues.push({ 
                            line, 
                            message: `<${tag}> is styled in Responsive CSS only but lacks a global base style in your main CSS.`, 
                            suggestion: `Add .up ${tag} { ... } in your main <style> block.` 
                        });
                    } else {
                        issues.push({ 
                            line: null, 
                            message: `<${tag}> is used in HTML but lacks a global base style entirely.`, 
                            suggestion: `Add .up ${tag} { list-style: ...; } in your main <style> block.` 
                        });
                    }
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
            const { doc, styleCSS, responsiveCSS, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;
            
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
            const mainSectionSelector = '[class*="-section"], [class*="module"], .mid-container > div[class]:not(.wrapper):not(.container):not(.inner):not(.outer)';
            const parentSectionSelector = '[class*="-section"], [class*="module"]';

            const sections = Array.from(doc.querySelectorAll(mainSectionSelector))
                .filter(el => {
                    if (el.closest('header, footer')) return false;
                    // Skip if nested inside another REAL section (ignore generic wrappers)
                    const parentSection = el.parentElement.closest(parentSectionSelector);
                    return !parentSection;
                });

            const seen = new Set();
            sections.forEach(section => {
                const cls = section.className.split(' ')[0];
                if (seen.has(cls) || !cls) return;
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


    // ─── BUTTONS ─────────────────────────────────────────────────────────────
    {
        id: 'button-per-instance',
        name: 'Per-Button Requirements',
        category: 'Buttons',
        severity: 'critical',
        description: 'Check individual buttons for show/hide toggles, editable text, and link support.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            const btnSelector = '.btn_grp, .button, .btn, .sticky_btn, a.mktoText[id*="btn"]';
            const buttons = Array.from(doc.querySelectorAll(btnSelector));

            if (buttons.length === 0) return { issues };

            let lastBtnLine = 0;
            buttons.forEach(btn => {
                const id   = btn.id || btn.className.split(' ')[0] || 'button';
                const search = btn.id ? `id="${btn.id}"` : btn.textContent.trim().substring(0, 30);
                const name   = btn.id ? `#${btn.id}` : `"${btn.textContent.trim().substring(0, 25)}"`;

                const foundLine = findLine(lines, search, lastBtnLine) || findLine(lines, id, lastBtnLine);
                if (foundLine) lastBtnLine = foundLine;

                const style       = btn.getAttribute('style') || '';
                const parentStyle = btn.parentElement ? (btn.parentElement.getAttribute('style') || '') : '';
                const anchor      = btn.tagName === 'A' ? btn : btn.querySelector('a');

                if (!/display\s*:\s*\$\{/.test(style) && !/display\s*:\s*\$\{/.test(parentStyle)) {
                    issues.push({ 
                        line: foundLine, 
                        message: `Button ${name}: missing Show/Hide toggle`, 
                        suggestion: `Add style="display:\${show_${id}};" and declare <meta class="mktoBoolean" id="show_${id}" …> in <head>.` 
                    });
                }

                if (!anchor) {
                    issues.push({ 
                        line: foundLine, 
                        message: `Button ${name}: no <a> tag found`, 
                        suggestion: 'Wrap your button label in an <a> tag.' 
                    });
                } else {
                    const hasMktoText = anchor.classList.contains('mktoText') || !!anchor.querySelector('.mktoText');
                    if (!hasMktoText) {
                        issues.push({ 
                            line: foundLine, 
                            message: `Button ${name}: no mktoText class`, 
                            suggestion: 'Add class="mktoText" to the anchor or wrap text in a mktoText span.' 
                        });
                    }
                    const href = anchor.getAttribute('href') || '';
                    if (href && !href.includes('${') && !anchor.classList.contains('mktoLink') && href !== '#') {
                        issues.push({ 
                            line: foundLine, 
                            message: `Button ${name}: hardcoded href`, 
                            suggestion: 'Use href="${btn_url}" or add class="mktoLink".' 
                        });
                    }
                }
            });
            return { issues };
        }
    },
    {
        id: 'button-global-style',
        name: 'Global Button Styling',
        category: 'Buttons',
        severity: 'warning',
        description: 'Verify 6 required global color variables and ensure button hover states use variables (not hex).',
        check(ctx) {
            const { doc, lines, styleLines, responsiveLines, styleCSS, responsiveCSS } = ctx;
            const issues = [];
            const btnSelector = '.btn_grp, .button, .btn, .sticky_btn, a.mktoText[id*="btn"]';
            if (!doc.querySelector(btnSelector)) return { issues };

            // 1. Global Color Variables
            const allMetaIds = Array.from(doc.querySelectorAll('meta.mktoColor, meta.mktoString')).map(m => m.id.toLowerCase());
            const globalVars = [
                { patterns: [/btn_?(?:text_?)?colou?r$/i], label: 'Button text color', example: 'btn_color' },
                { patterns: [/btn_?(?:text_?)?hover_?colou?r$/i, /btn_?colou?r_?hover$/i], label: 'Button text hover color', example: 'btn_hover_color' },
                { patterns: [/btn_?bg_?colou?r$/i, /btn_?background_?colou?r$/i], label: 'Button background color', example: 'btn_bg_color' },
                { patterns: [/btn_?bg_?hover_?colou?r$/i, /btn_?hover_?bg_?colou?r$/i], label: 'Button background hover color', example: 'btn_bg_hover_color' },
                { patterns: [/btn_?border_?colou?r$/i], label: 'Button border color', example: 'btn_border_color' },
                { patterns: [/btn_?border_?hover_?colou?r$/i, /btn_?hover_?border_?colou?r$/i], label: 'Button border hover color', example: 'btn_border_hover_color' }
            ];

            const missingVars = globalVars.filter(v => !allMetaIds.some(id => v.patterns.some(p => p.test(id))));
            if (missingVars.length > 0) {
                const mktoColorLine = findLine(lines, 'mktoColor') || findLine(lines, 'mktoString');
                issues.push({
                    line: mktoColorLine,
                    message: `Missing ${missingVars.length} global variables: ${missingVars.map(v => v.label).join(', ')}`,
                    suggestion: 'Add missing <meta class="mktoColor"> tags with IDs like ' + missingVars.map(v => v.example).join(', ')
                });
            }

            // 2. Hover State CSS
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;
            const hoverBlocks = fullCss.match(/[^{},]+:hover\s*\{[^}]+\}/gi) || [];
            
            hoverBlocks.forEach(block => {
                const selector = block.split(':hover')[0].trim();
                const isBtnHover = /\.btn|button|sticky_btn/i.test(selector);
                if (isBtnHover && /#([0-9a-fA-F]{3,6})/.test(block) && !block.includes('${')) {
                    issues.push({
                        line: findLine(styleLines, selector) || findLine(responsiveLines, selector) || findLine(lines, selector),
                        message: `Hardcoded hex in button :hover: "${selector}:hover"`,
                        suggestion: 'Replace with Marketo variables, e.g. color: ${btn_hover_color};'
                    });
                }
            });

            if (!hoverBlocks.some(b => /\.btn|button|sticky_btn/i.test(b.split(':hover')[0]) && b.includes('${')) && hoverBlocks.length === 0) {
                issues.push({
                    line: findLine(styleLines, ':hover') || findLine(responsiveLines, ':hover'),
                    message: 'No button :hover rule found in CSS',
                    suggestion: 'Add :hover rules using global style variables.'
                });
            }

            return { issues };
        }
    },

    // ─── SECTIONS ────────────────────────────────────────────────────────────
    {
        id: 'section-reorder-support',
        name: 'Section Reordering Support',
        category: 'Sections',
        severity: 'critical',
        description: 'Verify that sections have dynamic order properties and the container is set to display: flex.',
        check(ctx) {
            const { doc, lines, styleCSS, responsiveCSS } = ctx;
            const issues = [];
            const seen = new Set();
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;
            
            const mainSectionSelector = '[class*="-section"], [class*="module"], .mid-container > div[class]:not(.wrapper):not(.container):not(.inner):not(.outer)';
            const parentSectionSelector = '[class*="-section"], [class*="module"]';
            
            const sections = Array.from(doc.querySelectorAll(mainSectionSelector))
                .filter(el => {
                    if (el.closest('header, footer')) return false;
                    const parentSection = el.parentElement.closest(parentSectionSelector);
                    return !parentSection;
                });

            // 1. Check for Flex Container
            const hasFlexContainer = /\.mid-container[^{]*\{[^}]*display\s*:\s*flex/i.test(fullCss) || 
                                     /display\s*:\s*flex/.test(doc.querySelector('.mid-container')?.getAttribute('style') || '');
            if (!hasFlexContainer && sections.length > 1) {
                issues.push({ 
                    line: null, 
                    message: 'Main section container (.mid-container) is not set to display: flex', 
                    suggestion: 'Add "display: flex; flex-direction: column;" to .mid-container to enable the "order" property for reordering.' 
                });
            }

            sections.forEach(section => {
                const cls = section.className.split(' ')[0];
                if (seen.has(cls) || !cls) return;
                seen.add(cls);
                const style = section.getAttribute('style') || '';
                
                // 2. Check Order Property
                if (!/order\s*:\s*\$\{[^}]+\}/.test(style)) {
                    issues.push({
                        line: findLine(lines, cls),
                        message: `Section ".${cls}" missing dynamic order property`,
                        suggestion: `Add style="order: \${${cls.replace(/-/g, '_')}_order};" to enable reordering.`
                    });
                }
                
                // 3. No Absolute Position (Layout Dependency)
                if (/position\s*:\s*absolute/i.test(style)) {
                    issues.push({
                        line: findLine(lines, cls),
                        message: `Section ".${cls}" uses position: absolute`,
                        suggestion: 'Avoid position: absolute on main sections as it breaks the flexbox "order" property for reordering.'
                    });
                }
            });
            return { issues };
        }
    },
    {
        id: 'section-bg-image-and-color',
        name: 'Section Background Fallback & Editability',
        category: 'Sections',
        severity: 'warning',
        description: 'Each section must have BOTH background-image and background-color editable for proper fallback.',
        check(ctx) {
            const { doc, lines, styleLines, responsiveLines } = ctx;
            const issues = [];
            
            const mainSectionSelector = '[class*="-section"], [class*="module"], .mid-container > div[class]:not(.wrapper):not(.container):not(.inner):not(.outer)';
            const parentSectionSelector = '[class*="-section"], [class*="module"]';

            const sections = Array.from(doc.querySelectorAll(mainSectionSelector))
                .filter(el => {
                    if (el.closest('header, footer')) return false;
                    const parentSection = el.parentElement.closest(parentSectionSelector);
                    return !parentSection;
                });

            const seen = new Set();
            sections.forEach(section => {
                const cls = section.className.split(' ')[0];
                if (seen.has(cls) || !cls) return;
                seen.add(cls);
                const style = section.getAttribute('style') || '';
                
                const hasBgImg = /background-image\s*:\s*url\(\s*\$\{[^}]+\}\s*\)/i.test(style);
                const hasBgColor = /background-color\s*:\s*\$\{[^}]+\}/i.test(style);

                if (!hasBgImg) {
                    issues.push({ 
                        line: findLine(lines, cls), 
                        message: `Section ".${cls}" missing editable background-image`, 
                        suggestion: `Add "background-image: url(\${${cls.replace(/-/g,'_')}_bg_image});" using mktoImg or mktoString.` 
                    });
                }
                
                if (!hasBgColor) {
                    issues.push({ 
                        line: findLine(lines, cls), 
                        message: `Section ".${cls}" missing editable background-color fallback`, 
                        suggestion: `Add "background-color: \${${cls.replace(/-/g,'_')}_bg_color};" so a color applies if the image is removed.` 
                    });
                }
            });

            // check for hardcoded images in CSS
            const checkCssBg = (cssArr, source) => {
                cssArr.forEach((line, idx) => {
                    const bgInLine = line.match(/background-image\s*:\s*url\(['"]?(?!\$\{)(?!.*\$\{)[^)'"]+['"]?\)/gi);
                    if (bgInLine) {
                        issues.push({ 
                            line: idx + 1, 
                            message: `Hardcoded background-image found in ${source}`, 
                            suggestion: 'Use a Marketo variable (mktoImg or mktoString) to allow users to update the image.' 
                        });
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
        name: 'Section-based Naming Convention',
        category: 'Naming',
        severity: 'warning',
        description: 'mkto IDs must follow section-based naming (e.g., Banner_section) and avoid generic names like Module1.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            
            // Prohibit generic names based on user's examples
            const generic = /^(module|section|div|item|element|new|test|comp|block|part|area|widget|region|newmodule)\d*$/i;
            
            doc.querySelectorAll('[id][class*="mkto"], meta[id][class*="mkto"]').forEach(el => {
                const id = el.id;
                if (!id || id.includes('${')) return;
                
                // 1. Check for generic names
                if (generic.test(id)) {
                    issues.push({ 
                        line: findLine(lines, `id="${id}"`), 
                        message: `Generic name "${id}" found in ID`, 
                        suggestion: 'Avoid generic names like "Module1" or "NewModule". Use descriptive names like "Banner_section".' 
                    });
                } 
                // 2. Check for underscore and descriptive pattern
                else if (!id.includes('_')) {
                    issues.push({ 
                        line: findLine(lines, `id="${id}"`), 
                        message: `ID "${id}" missing section prefix or underscore`, 
                        suggestion: `Follow section-based naming: e.g., "Banner_section" or "Testimonial_title". Current ID: "${id}"` 
                    });
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
        id: 'form-presence-check',
        name: 'Form Presence',
        category: 'Forms',
        severity: 'info',
        description: 'Check if a Marketo form is present on the template.',
        check(ctx) {
            const { doc } = ctx;
            const hasForm = !!doc.querySelector('.mktoForm, [id*="mktoForm"]');
            if (!hasForm) {
                return { issues: [{ line: null, severity: 'info', message: 'No Marketo form detected in this template.', suggestion: 'If this template should include a form, ensure you have a <div class="mktoForm" id="..."></div> container.' }] };
            }
            return { issues: [] };
        }
    },
    {
        id: 'form-elements-styled',
        name: 'Form Elements Globally Styled',
        category: 'Forms',
        severity: 'info',
        description: 'Input, select, textarea, radio, checkbox must have consistent global CSS.',
        check(ctx) {
            const { doc, styleCSS, responsiveCSS } = ctx;
            const issues = [];
            
            // Only validate if a form exists on the page
            const hasForm = !!doc.querySelector('.mktoForm, [id*="mktoForm"]');
            if (!hasForm) return { issues };

            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;

            const checks = [
                { label: 'Text inputs (input[type=text/email])', pattern: /input\s*\{|input\[type[^]]*?(text|email)/i },
                { label: 'Dropdowns (select)', pattern: /select\s*\{|select\s*,/i },
                { label: 'Textarea', pattern: /textarea\s*\{/i },
                { label: 'Radio buttons (input[type=radio])', pattern: /input\[type=.?radio/i },
                { label: 'Checkboxes (input[type=checkbox])', pattern: /input\[type=.?checkbox/i }
            ];
            checks.forEach(({ label, pattern }) => {
                if (!pattern.test(fullCss)) {
                    issues.push({ line: null, message: `No active global CSS found for: ${label}`, suggestion: `Add styles for ${label} in the main <style> block.` });
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
            const { doc, styleCSS, responsiveCSS, lines, styleLines, responsiveLines } = ctx;
            const issues = [];

            // Only validate if a form exists on the page
            const hasForm = !!doc.querySelector('.mktoForm, [id*="mktoForm"]');
            if (!hasForm) return { issues };

            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;
            
            const hasTy = /thank.?you|thankyou|success.?msg|form.?success|mktFormMsg|confirmation/i.test(ctx.raw);
            if (!hasTy) {
                issues.push({ line: null, message: 'No Thank You / success message found', suggestion: 'Add a styled Thank You section triggered on form submission matching the UI design.' });
            } else {
                const hasTyStyle = /\.?thank.?you\s*\{|#thank|\.?form.?success\s*\{|\.?mktFormMsg/i.test(fullCss);
                if (!hasTyStyle) {
                    issues.push({ line: findLine(lines, 'thank') || findLine(styleLines, 'thank') || findLine(responsiveLines, 'thank'), message: 'Thank You element found but no matching active CSS styles detected', suggestion: 'Add CSS for the Thank You state that matches the overall design.' });
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
            const { doc, styleCSS, responsiveCSS, lines } = ctx;
            const issues = [];
            const styleTags = Array.from(doc.querySelectorAll('style')).map(s => stripComments(s.textContent)).join('\n');
            const fullCss = stripComments(styleCSS) + '\n' + stripComments(responsiveCSS) + '\n' + styleTags;
            
            const targets = ['location-content-wrapper', 'footer_btm_grp', 'footer_inner_grp', 'agenda-content-wrapper', 'header-inner'];
            targets.forEach(cls => {
                const el = doc.querySelector(`.${cls}`);
                if (!el) return;
                const escape = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const hasFlexInCSS = new RegExp(`\\.${escape}[^{]*\\{[^}]*display\\s*:\\s*flex`, 'is').test(fullCss);
                const hasFlexInStyle = /display\s*:\s*flex/.test(el.getAttribute('style') || '');
                if (!hasFlexInCSS && !hasFlexInStyle) {
                    issues.push({ line: findLine(lines, cls), message: `".${cls}" uses side-by-side columns but no active display:flex found in CSS`, suggestion: `Add display: flex to .${cls} { } in your CSS for reliable equal-height layout.` });
                }
            });
            return { issues };
        }
    },
    {
        id: 'section-spacing-consistency',
        name: 'Section Spacing Consistency',
        category: 'Layout',
        severity: 'warning',
        description: 'Ensure consistent vertical padding/margins across all main sections.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            
            const mainSectionSelector = '[class*="-section"], [class*="module"], .mid-container > div[class]:not(.wrapper):not(.container):not(.inner):not(.outer)';
            const parentSectionSelector = '[class*="-section"], [class*="module"]';

            const sections = Array.from(doc.querySelectorAll(mainSectionSelector))
                .filter(el => {
                    if (el.closest('header, footer')) return false;
                    const parentSection = el.parentElement.closest(parentSectionSelector);
                    return !parentSection;
                });

            const data = [];
            sections.forEach(sec => {
                const style = sec.getAttribute('style') || '';
                // Simple regex to extract padding/margin
                const pt = (style.match(/padding-top\s*:\s*([^;]+)/i) || [null, ''])[1].trim();
                const pb = (style.match(/padding-bottom\s*:\s*([^;]+)/i) || [null, ''])[1].trim();
                const p = (style.match(/[^-\b]padding\s*:\s*([^;]+)/i) || [null, ''])[1].trim(); // non-dash prefix to avoid padding-top
                
                // Effective vertical padding
                let vertical = p || `${pt} / ${pb}`;
                if (vertical === ' / ') vertical = 'Not Set';
                
                data.push({ el: sec, spacing: vertical, cls: sec.className.split(' ')[0] });
            });

            // Find majority spacing
            const counts = {};
            data.forEach(d => counts[d.spacing] = (counts[d.spacing] || 0) + 1);
            let majority = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'Not Set');

            data.forEach(d => {
                if (d.spacing !== majority && d.spacing !== 'Not Set') {
                    issues.push({ 
                        line: findLine(lines, d.cls), 
                        message: `Section ".${d.cls}" has inconsistent spacing: "${d.spacing}" (Majority is "${majority}")`, 
                        suggestion: `Align spacing to "${majority}" to maintain design consistency and avoid odd/even gaps.`
                    });
                }
            });

            return { issues };
        }
    },
    {
        id: 'image-optimization-best-practices',
        name: 'Image Optimization & Icons',
        category: 'Assets',
        severity: 'info',
        description: 'Verify 2x Retina PNGs, SVGs for logos, and FontAwesome for icons.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            
            doc.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src') || '';
                const filename = src.split('/').pop().toLowerCase();
                
                // 1. Check for 1x PNGs
                if (filename.endsWith('.png') && !filename.includes('2x') && !filename.includes('svg')) {
                    issues.push({ 
                        line: findLine(lines, filename), 
                        message: `Image "${filename}" might not be Retina optimized (no "@2x" found)`, 
                        suggestion: 'Priority 1: Use 2x PNG images for high-density displays (e.g. filename@2x.png).' 
                    });
                }
                
                // 2. Suggest SVG for logos/UI elements
                if ((filename.includes('logo') || filename.includes('icon')) && filename.endsWith('.png')) {
                    issues.push({
                        line: findLine(lines, filename),
                        message: `UI Element "${filename}" is a PNG`,
                        suggestion: 'Priority 2: Use .SVG images or SVG code for logos and simple icons for better performance.'
                    });
                }
            });

            // 3. Social Icons -> Font Awesome check
            const socialPatterns = /facebook|twitter|instagram|linkedin|youtube|social/i;
            doc.querySelectorAll('a').forEach(anchor => {
                const href = anchor.getAttribute('href') || '';
                const cls = anchor.className || '';
                if (socialPatterns.test(href) || socialPatterns.test(cls)) {
                    const hasIcon = !!anchor.querySelector('i.fa, i.fab, i.fas, i.far');
                    const hasImg = !!anchor.querySelector('img');
                    if (hasImg && !hasIcon) {
                        issues.push({
                            line: findLine(lines, anchor.className.split(' ')[0] || 'social'),
                            message: 'Social link using <img> instead of FontAwesome',
                            suggestion: 'Use FontAwesome icons (<i> tags) for social links instead of images.'
                        });
                    }
                }
            });

            return { issues };
        }
    },
    {
        id: 'hidden-section-no-gap',
        name: 'Hidden Sections & Slider Gaps',
        category: 'Show / Hide',
        severity: 'warning',
        description: 'Verify false_value="none" for all mktoBoolean toggles and check slider/slide consistency.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            
            // 1. Check all mktoBoolean for false_value="none"
            doc.querySelectorAll('meta.mktoBoolean').forEach(meta => {
                const id = meta.id || 'unknown';
                const falseVal = meta.getAttribute('false_value');
                const mktoName = meta.getAttribute('mktoName') || id;
                
                if (falseVal && falseVal !== 'none') {
                    issues.push({ 
                        line: findLine(lines, id), 
                        message: `Toggle "${mktoName}" uses false_value="${falseVal}"`, 
                        suggestion: 'Change to false_value="none" so the element fully collapses and doesn\'t leave spacing gaps when hidden.' 
                    });
                }
                
                // 2. Specific Slider/Slide check
                if (id.toLowerCase().includes('slide') || mktoName.toLowerCase().includes('slide')) {
                    issues.push({
                        line: findLine(lines, id),
                        message: `Slider toggle detected: "${mktoName}"`,
                        suggestion: 'NOTE: For sliders, ensure show/hide logic doesn\'t break layout or create odd gaps between active slides. Verify default visibility matches design.'
                    });
                }
            });

            // 3. Check for elements that look like slides
            const slideSelectors = '.slide, .carousel-item, [class*="slide"]';
            doc.querySelectorAll(slideSelectors).forEach(slide => {
                const style = slide.getAttribute('style') || '';
                if (slide.className.includes('slide') && !style.includes('display')) {
                    issues.push({
                        line: findLine(lines, slide.className.split(' ')[0]),
                        message: `Potential slide ".${slide.className.split(' ')[0]}" has no inline show/hide control`,
                        suggestion: 'Ensure slides can be toggled and that hidden slides use display:none to avoid layout shifts.'
                    });
                }
            });

            return { issues };
        }
    },
    {
        id: 'centralized-style-control',
        name: 'Centralized Style Control',
        category: 'Layout',
        severity: 'warning',
        description: 'Ensure styles are controlled centrally in CSS or via Marketo variables, not hardcoded in modules.',
        check(ctx) {
            const { doc, lines } = ctx;
            const issues = [];
            
            const mainSectionSelector = '[class*="-section"], [class*="module"], .mid-container > div[class]:not(.wrapper):not(.container):not(.inner):not(.outer)';
            const bannedProps = ['font-family', 'color', 'font-size', 'line-height', 'background-color'];

            doc.querySelectorAll(mainSectionSelector).forEach(sec => {
                const elements = [sec, ...Array.from(sec.querySelectorAll('*'))];
                elements.forEach(el => {
                    const style = el.getAttribute('style') || '';
                    if (!style) return;

                    bannedProps.forEach(prop => {
                        const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i');
                        const match = style.match(regex);
                        if (match) {
                            const val = match[1].trim();
                            // If value doesn't contain a Marketo variable ${...}
                            if (!val.includes('${')) {
                                const id = el.id || el.className.split(' ')[0] || el.tagName.toLowerCase();
                                issues.push({
                                    line: findLine(lines, id),
                                    message: `Hardcoded "${prop}: ${val}" found in <${el.tagName.toLowerCase()}> inside module`,
                                    suggestion: `Move "${prop}" to global CSS or use a Marketo variable (\${var_name}) to maintain centralized control.`
                                });
                            }
                        }
                    });
                });
            });

            return { issues };
        }
    }
];
