// =============================================
// Marketo QA Tool — Validation Engine
// =============================================

const Validator = {
    run({ code, styleCSS, responsiveCSS }) {
        const lines = code.split(/\r?\n/);
        const parser = new DOMParser();
        const doc = parser.parseFromString(code, 'text/html');

        const styleLines = styleCSS ? styleCSS.split(/\r?\n/) : [];
        const responsiveLines = responsiveCSS ? responsiveCSS.split(/\r?\n/) : [];

        const ctx = {
            raw: code,
            doc,
            lines,
            styleCSS,
            responsiveCSS,
            styleLines,
            responsiveLines
        };

        const results = [];
        RULES.forEach(rule => {
            let ruleResult;
            try {
                ruleResult = rule.check(ctx);
            } catch (e) {
                ruleResult = { issues: [{ line: null, message: `Rule error: ${e.message}`, suggestion: 'Internal rule check failed.' }] };
            }
            results.push({
                id: rule.id,
                name: rule.name,
                category: rule.category,
                severity: rule.severity,
                description: rule.description,
                passed: !ruleResult.issues.some(i => (i.severity || rule.severity) !== 'info'),
                issues: ruleResult.issues.map(i => ({
                    ...i,
                    severity: i.severity || rule.severity
                }))
            });
        });

        return {
            results,
            summary: {
                total: results.length,
                passed: results.filter(r => r.passed).length,
                critical: results.filter(r => !r.passed && r.severity === 'critical').length,
                warning: results.filter(r => !r.passed && r.severity === 'warning').length,
                info: results.filter(r => !r.passed && r.severity === 'info').length,
            }
        };
    }
};
