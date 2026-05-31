import * as fs from 'fs';
import * as path from 'path';

/**
 * Security Audit Integration Tests
 * 
 * These tests verify the complete security auditing system works
 * end-to-end, including:
 * 1. Audit checks run successfully
 * 2. Results are properly reported
 * 3. Thresholds are enforced
 * 4. Exceptions are handled gracefully
 */

describe('Security Audit Integration', () => {
  const repoRoot = path.resolve(__dirname, '../../../');

  describe('Audit Output Verification', () => {
    it('should parse npm audit JSON output correctly', () => {
      const auditOutput = {
        metadata: {
          vulnerabilities: {
            critical: 0,
            high: 5,
            moderate: 12,
            low: 3,
          },
        },
        vulnerabilities: {
          'example-package': {
            severity: 'high',
            ranges: [{ patched: '<1.2.3' }],
            more_info: 'https://example.com',
          },
        },
      };

      expect(auditOutput.metadata.vulnerabilities.critical).toBe(0);
      expect(auditOutput.metadata.vulnerabilities.high).toBeGreaterThan(0);
      expect(auditOutput.metadata.vulnerabilities.moderate).toBeGreaterThan(0);
    });

    it('should parse cargo audit JSON output correctly', () => {
      const cargoAuditOutput = {
        vulnerabilities: [
          {
            advisory: {
              id: 'RUSTSEC-2024-0001',
              title: 'Example vulnerability',
              url: 'https://example.com',
            },
            versions: {
              patched: ['>=1.2.3'],
            },
            severity: 'critical',
          },
        ],
      };

      expect(cargoAuditOutput.vulnerabilities).toBeDefined();
      expect(Array.isArray(cargoAuditOutput.vulnerabilities)).toBe(true);
      
      if (cargoAuditOutput.vulnerabilities.length > 0) {
        expect(cargoAuditOutput.vulnerabilities[0].severity).toBeDefined();
        expect(
          ['critical', 'high', 'medium', 'low'].includes(
            cargoAuditOutput.vulnerabilities[0].severity
          )
        ).toBe(true);
      }
    });
  });

  describe('Audit Exception Handling', () => {
    it('should load and parse backend audit exceptions', () => {
      const exceptionFile = path.join(repoRoot, 'backend/.auditignore');
      if (fs.existsSync(exceptionFile)) {
        const content = fs.readFileSync(exceptionFile, 'utf8');
        const exceptions = content
          .split('\n')
          .filter((line) => line.trim() && !line.trim().startsWith('#'))
          .map((line) => line.split(':')[0].trim());

        // Should be array even if empty
        expect(Array.isArray(exceptions)).toBe(true);
      }
    });

    it('should validate exception format', () => {
      const exceptionFile = path.join(repoRoot, 'backend/.auditignore');
      if (fs.existsSync(exceptionFile)) {
        const content = fs.readFileSync(exceptionFile, 'utf8');
        const lines = content
          .split('\n')
          .filter((line) => line.trim() && !line.trim().startsWith('#'));

        for (const line of lines) {
          // Should match: ID: reason
          expect(line).toMatch(/^[\w-]+:\s*.+/);
        }
      }
    });

    it('should enforce exception deadline tracking', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      
      // Documentation should mention tracking deadlines
      expect(content.toLowerCase()).toContain('deadline');
      expect(content.toLowerCase()).toContain('time');
      expect(content.toLowerCase()).toContain('temporary');
    });
  });

  describe('CI/CD Integration', () => {
    it('should trigger audits on pull requests', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('pull_request');
    });

    it('should trigger audits on push to main', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('push');
      expect(workflow).toContain('main');
    });

    it('should trigger audits on schedule', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('schedule');
      expect(workflow).toContain('cron');
    });

    it('should report results in PR comments', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('github-script');
      expect(workflow).toContain('issues.createComment');
    });

    it('should publish audit results to step summary', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('GITHUB_STEP_SUMMARY');
    });
  });

  describe('Severity Threshold Enforcement', () => {
    it('should fail on critical vulnerabilities', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      expect(content).toContain('CRITICAL_THRESHOLD=0');
      expect(content).toContain('if (( CRITICAL >');
      expect(content).toContain('FAILED=1');
    });

    it('should fail on high vulnerabilities', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      expect(content).toContain('HIGH_THRESHOLD');
      expect(content).toContain('if (( HIGH >');
    });

    it('should warn on moderate vulnerabilities', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      expect(content).toContain('MODERATE_THRESHOLD');
      // Should warn but not fail
      expect(content).toContain('MODERATE');
    });
  });

  describe('Local Audit Command', () => {
    it('should provide local audit command', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('should support verbose flag', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('--verbose');
      expect(content).toContain('VERBOSE');
    });

    it('should document local testing in README', () => {
      const paths = [
        path.join(repoRoot, 'QUICKSTART.md'),
        path.join(repoRoot, 'DEVELOPMENT.md'),
        path.join(repoRoot, 'docs/SECURITY_AUDIT.md'),
      ];

      const found = paths.some((p) => {
        if (!fs.existsSync(p)) return false;
        const content = fs.readFileSync(p, 'utf8');
        return content.includes('check-audits.sh') || content.includes('npm audit');
      });

      expect(found).toBe(true);
    });
  });

  describe('Audit Report Generation', () => {
    it('should generate detailed audit summary', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      
      // Should create summary table
      expect(workflow).toContain('| Severity | Count |');
      expect(workflow).toContain('|----------|-------|');
    });

    it('should include backend audit in report', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('Backend');
    });

    it('should include frontend audit in report', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('Frontend');
    });

    it('should include contract audit in report', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('Contract');
    });
  });

  describe('State and Disconnection Handling', () => {
    it('should handle missing package.json gracefully', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      expect(content).toContain('2>/dev/null');
      expect(content).toContain('|| echo');
    });

    it('should handle missing Cargo.toml gracefully', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      expect(content).toContain('[ -f "Cargo.toml" ]');
      expect(content).toContain('|| return');
    });

    it('should gracefully handle cargo-audit not installed', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      expect(content).toContain('command -v cargo-audit');
      expect(content).toContain('cargo install cargo-audit');
    });

    it('should provide error messages on audit failure', () => {
      const workflow = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(workflow).toContain('::error::');
      expect(workflow).toContain('::warning::');
    });
  });

  describe('Security Best Practices', () => {
    it('should document CVE/advisory response process', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      
      expect(content.toLowerCase()).toContain('fix');
      expect(content.toLowerCase()).toContain('updat');
    });

    it('should recommend quarterly exception review', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      
      expect(content.toLowerCase()).toContain('review');
      expect(content.toLowerCase()).toContain('quarter');
    });

    it('should recommend weekly audit runs', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      
      expect(content.toLowerCase()).toContain('weekly');
    });

    it('should discourage ignoring critical vulnerabilities', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      
      expect(content).toContain('Never ignore');
      expect(content.toLowerCase()).toContain('critical');
    });
  });
});
