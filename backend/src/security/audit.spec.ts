import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Security Audit Tests
 * 
 * These tests verify that:
 * 1. Audit exception files exist and are properly formatted
 * 2. CI workflows are configured with audit steps
 * 3. Audit thresholds are enforced correctly
 * 4. Documentation is comprehensive
 */

describe('Security Auditing', () => {
  const repoRoot = path.resolve(__dirname, '../../../');
  const auditFilePaths = {
    backend: path.join(repoRoot, 'backend/.auditignore'),
    frontend: path.join(repoRoot, 'frontend/.auditignore'),
    contract: path.join(repoRoot, 'contract/.auditignore'),
  };

  const workflowPaths = {
    auditCheck: path.join(repoRoot, '.github/workflows/audit-check.yml'),
    backendCi: path.join(repoRoot, '.github/workflows/backend-ci.yml'),
    frontendCi: path.join(repoRoot, '.github/workflows/frontend-ci.yml'),
    contractCi: path.join(repoRoot, '.github/workflows/contract-ci.yml'),
  };

  describe('Audit Ignore Files', () => {
    it('should have .auditignore file for backend', () => {
      expect(fs.existsSync(auditFilePaths.backend)).toBe(true);
    });

    it('should have .auditignore file for frontend', () => {
      expect(fs.existsSync(auditFilePaths.frontend)).toBe(true);
    });

    it('should have .auditignore file for contract', () => {
      expect(fs.existsSync(auditFilePaths.contract)).toBe(true);
    });

    it('should contain valid format for audit exceptions', () => {
      const content = fs.readFileSync(auditFilePaths.backend, 'utf8');
      // File should either be empty or contain properly formatted exceptions
      const lines = content
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#'));
      
      for (const line of lines) {
        // Should match pattern: ADVISORY_ID: reason
        expect(line).toMatch(/^(NPM|RUSTSEC)-[\d-]+:\s*.+/);
      }
    });
  });

  describe('CI Workflows', () => {
    it('should include npm audit in backend CI', () => {
      const content = fs.readFileSync(workflowPaths.backendCi, 'utf8');
      expect(content).toContain('npm audit');
    });

    it('should include npm audit in frontend CI', () => {
      const content = fs.readFileSync(workflowPaths.frontendCi, 'utf8');
      expect(content).toContain('npm audit');
    });

    it('should include cargo audit in contract CI', () => {
      const content = fs.readFileSync(workflowPaths.contractCi, 'utf8');
      expect(content).toContain('cargo audit');
    });

    it('should include comprehensive audit check workflow', () => {
      const content = fs.readFileSync(workflowPaths.auditCheck, 'utf8');
      expect(content).toContain('Check Dependencies & Audits');
      expect(content).toContain('npm audit');
      expect(content).toContain('cargo audit');
    });

    it('should fail on critical vulnerabilities', () => {
      const content = fs.readFileSync(workflowPaths.auditCheck, 'utf8');
      expect(content).toContain('CRITICAL');
      expect(content).toContain('exit 1');
    });

    it('should parse JSON output from audits', () => {
      const content = fs.readFileSync(workflowPaths.auditCheck, 'utf8');
      expect(content).toContain('jq');
      expect(content).toContain('.metadata.vulnerabilities');
    });
  });

  describe('Audit Script', () => {
    it('should have check-audits.sh script', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('should support verbose mode', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('--verbose');
    });

    it('should check backend npm audit', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('backend');
      expect(content).toContain('npm audit');
    });

    it('should check frontend npm audit', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('frontend');
      expect(content).toContain('npm audit');
    });

    it('should check cargo audit for contract', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('cargo audit');
    });

    it('should define vulnerability thresholds', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('CRITICAL_THRESHOLD');
      expect(content).toContain('HIGH_THRESHOLD');
    });
  });

  describe('Documentation', () => {
    it('should have security audit documentation', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      expect(fs.existsSync(docPath)).toBe(true);
    });

    it('should document exception handling', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      expect(content).toContain('Audit Exceptions');
      expect(content).toContain('Managing');
    });

    it('should include CI workflow information', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      expect(content).toContain('audit-check.yml');
      expect(content).toContain('npm audit');
      expect(content).toContain('cargo audit');
    });

    it('should document local testing instructions', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      expect(content).toContain('check-audits.sh');
      expect(content).toContain('Local Testing');
    });

    it('should provide vulnerability threshold guidance', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      expect(content).toContain('Thresholds');
      expect(content).toContain('Critical');
      expect(content).toContain('High');
    });

    it('should include best practices', () => {
      const docPath = path.join(repoRoot, 'docs/SECURITY_AUDIT.md');
      const content = fs.readFileSync(docPath, 'utf8');
      expect(content).toContain('Best Practices');
    });
  });

  describe('Vulnerability Severity Handling', () => {
    it('should correctly parse npm audit critical count', () => {
      // This test verifies the audit script can extract severity data
      const content = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(content).toContain("CRITICAL=$(echo \"$AUDIT_JSON\" | jq '.metadata.vulnerabilities.critical // 0')");
    });

    it('should correctly parse cargo audit severity', () => {
      const content = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/contract-ci.yml'),
        'utf8'
      );
      expect(content).toContain('select(.severity==\"critical\")');
    });

    it('should exit with failure on critical vulnerabilities', () => {
      const content = fs.readFileSync(
        path.join(repoRoot, '.github/workflows/audit-check.yml'),
        'utf8'
      );
      expect(content).toContain('if (( CRITICAL > 0 ))');
      expect(content).toContain('exit 1');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing npm audit output gracefully', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('2>/dev/null');
      expect(content).toContain('|| echo');
    });

    it('should handle missing cargo-audit installation', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('cargo install cargo-audit');
    });

    it('should provide helpful error messages', () => {
      const scriptPath = path.join(repoRoot, 'scripts/check-audits.sh');
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('::error::');
      expect(content).toContain('::warning::');
    });
  });
});
