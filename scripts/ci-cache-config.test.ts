/**
 * CI Cache Configuration Tests
 *
 * These tests verify that:
 * 1. All necessary dependency files exist (package-lock.json, Cargo.lock)
 * 2. CI workflows are properly configured with cache settings
 * 3. Cache keys are generated based on dependency hashes for consistency
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const ROOT_DIR = path.resolve(__dirname, '..');

describe('CI Cache Configuration', () => {
  describe('Dependency Files', () => {
    it('should have backend/package-lock.json', () => {
      const file = path.join(ROOT_DIR, 'backend', 'package-lock.json');
      expect(fs.existsSync(file)).toBe(true);
    });

    it('should have frontend/package-lock.json', () => {
      const file = path.join(ROOT_DIR, 'frontend', 'package-lock.json');
      expect(fs.existsSync(file)).toBe(true);
    });

    it('should have contract/Cargo.lock', () => {
      const file = path.join(ROOT_DIR, 'contract', 'Cargo.lock');
      expect(fs.existsSync(file)).toBe(true);
    });

    it('should have contract/Cargo.toml', () => {
      const file = path.join(ROOT_DIR, 'contract', 'Cargo.toml');
      expect(fs.existsSync(file)).toBe(true);
    });
  });

  describe('Workflow Cache Configuration', () => {
    const workflowsDir = path.join(ROOT_DIR, '.github', 'workflows');

    const readWorkflow = (filename: string) => {
      const content = fs.readFileSync(path.join(workflowsDir, filename), 'utf8');
      return yaml.parse(content);
    };

    describe('ci.yml', () => {
      it('should have cache configuration for backend job', () => {
        const workflow = readWorkflow('ci.yml');
        const backendJob = workflow.jobs.backend;
        
        expect(backendJob).toBeDefined();
        
        // Check for setup-node cache
        const setupNode = backendJob.steps.find(
          (s: any) => s.uses && s.uses.includes('setup-node')
        );
        expect(setupNode?.with?.cache).toBe('npm');
        expect(setupNode?.with?.['cache-dependency-path']).toBe('backend/package-lock.json');
      });

      it('should have cache configuration for frontend job', () => {
        const workflow = readWorkflow('ci.yml');
        const frontendJob = workflow.jobs.frontend;
        
        expect(frontendJob).toBeDefined();
        
        const setupNode = frontendJob.steps.find(
          (s: any) => s.uses && s.uses.includes('setup-node')
        );
        expect(setupNode?.with?.cache).toBe('npm');
        expect(setupNode?.with?.['cache-dependency-path']).toBe('frontend/package-lock.json');
      });

      it('should have Cargo cache for contract job', () => {
        const workflow = readWorkflow('ci.yml');
        const contractJob = workflow.jobs.contract;
        
        expect(contractJob).toBeDefined();
        
        const cargoRegistryCache = contractJob.steps.find(
          (s: any) => s.name && s.name.includes('Cache Cargo registry')
        );
        expect(cargoRegistryCache).toBeDefined();
        
        const cargoTargetCache = contractJob.steps.find(
          (s: any) => s.name && s.name.includes('Cache Cargo target')
        );
        expect(cargoTargetCache).toBeDefined();
      });

      it('should restore cache before install steps', () => {
        const workflow = readWorkflow('ci.yml');
        const backendJob = workflow.jobs.backend;
        
        const setupNodeIndex = backendJob.steps.findIndex(
          (s: any) => s.uses && s.uses.includes('setup-node')
        );
        const installIndex = backendJob.steps.findIndex(
          (s: any) => s.name && s.name.includes('Install dependencies')
        );
        
        expect(setupNodeIndex).toBeLessThan(installIndex);
      });
    });

    describe('backend-ci.yml', () => {
      it('should have npm cache configuration', () => {
        const workflow = readWorkflow('backend-ci.yml');
        const job = workflow.jobs.backend;
        
        const setupNode = job.steps.find(
          (s: any) => s.uses && s.uses.includes('setup-node')
        );
        expect(setupNode?.with?.cache).toBe('npm');
        expect(setupNode?.with?.['cache-dependency-path']).toBe('backend/package-lock.json');
      });
    });

    describe('frontend-ci.yml', () => {
      it('should have npm cache configuration', () => {
        const workflow = readWorkflow('frontend-ci.yml');
        const job = workflow.jobs.frontend;
        
        const setupNode = job.steps.find(
          (s: any) => s.uses && s.uses.includes('setup-node')
        );
        expect(setupNode?.with?.cache).toBe('npm');
        expect(setupNode?.with?.['cache-dependency-path']).toBe('frontend/package-lock.json');
      });
    });

    describe('contract-ci.yml', () => {
      it('should have Swatinem/rust-cache configuration', () => {
        const workflow = readWorkflow('contract-ci.yml');
        const job = workflow.jobs.contract;
        
        const cacheStep = job.steps.find(
          (s: any) => s.uses && s.uses.includes('Swatinem/rust-cache')
        );
        expect(cacheStep).toBeDefined();
        expect(cacheStep?.with?.workspaces).toBe('contract');
      });

      it('should restore cache before build steps', () => {
        const workflow = readWorkflow('contract-ci.yml');
        const job = workflow.jobs.contract;
        
        const cacheIndex = job.steps.findIndex(
          (s: any) => s.uses && s.uses.includes('Swatinem/rust-cache')
        );
        const buildIndex = job.steps.findIndex(
          (s: any) => s.name && s.name.includes('Check formatting')
        );
        
        expect(cacheIndex).toBeLessThan(buildIndex);
      });
    });
  });

  describe('Cache Key Strategy', () => {
    it('should use Cargo.lock hash for contract cache key', () => {
      const workflow = yaml.parse(
        fs.readFileSync(path.join(ROOT_DIR, '.github/workflows/ci.yml'), 'utf8')
      );
      const contractJob = workflow.jobs.contract;
      
      const registryCache = contractJob.steps.find(
        (s: any) => s.name && s.name.includes('Cache Cargo registry')
      );
      expect(registryCache?.with?.key).toContain("hashFiles('contract/**/Cargo.lock')");
    });

    it('should use package-lock.json hash for npm cache key', () => {
      const workflow = yaml.parse(
        fs.readFileSync(path.join(ROOT_DIR, '.github/workflows/backend-ci.yml'), 'utf8')
      );
      const job = workflow.jobs.backend;
      
      const setupNode = job.steps.find(
        (s: any) => s.uses && s.uses.includes('setup-node')
      );
      expect(setupNode?.with?.['cache-dependency-path']).toBe('backend/package-lock.json');
    });
  });
});
