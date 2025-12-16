/**
 * Tests for validateBackend utility
 */
import { validateBackendConfig } from '../../lib/validateBackend';

describe('validateBackendConfig', () => {
    const mockT = (key: string) => key;

    describe('domain mode', () => {
        it('returns valid for correct domain config', () => {
            const config = {
                mode: 'domain' as const,
                domainUrl: 'https://api.example.com',
                runpodEndpoint: ''
            };

            const result = validateBackendConfig(config, mockT);
            expect(result.isValid).toBe(true);
        });

        it('returns invalid for empty domain URL', () => {
            const config = {
                mode: 'domain' as const,
                domainUrl: '',
                runpodEndpoint: ''
            };

            const result = validateBackendConfig(config, mockT);
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('noBackendUrl');
        });

        it('returns invalid for whitespace-only domain URL', () => {
            const config = {
                mode: 'domain' as const,
                domainUrl: '   ',
                runpodEndpoint: ''
            };

            const result = validateBackendConfig(config, mockT);
            expect(result.isValid).toBe(false);
        });

        it('returns invalid for malformed URL', () => {
            const config = {
                mode: 'domain' as const,
                domainUrl: 'not-a-valid-url',
                runpodEndpoint: ''
            };

            const result = validateBackendConfig(config, mockT);
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('invalidUrl');
        });
    });

    describe('runpod mode', () => {
        it('returns valid for correct runpod config', () => {
            const config = {
                mode: 'runpod' as const,
                domainUrl: '',
                runpodEndpoint: 'https://api.runpod.io/v2/xyz'
            };

            const result = validateBackendConfig(config, mockT);
            expect(result.isValid).toBe(true);
        });

        it('returns invalid for empty runpod endpoint', () => {
            const config = {
                mode: 'runpod' as const,
                domainUrl: '',
                runpodEndpoint: ''
            };

            const result = validateBackendConfig(config, mockT);
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('noRunpodEndpoint');
        });
    });
});
