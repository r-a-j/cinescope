import packageJson from '../../../../package.json';
import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
    it('matches the frontend package version', () => {
        expect(APP_VERSION).toBe(packageJson.version);
    });
});
