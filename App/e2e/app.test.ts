import { by, device, element, expect } from 'detox';

describe('Go Analysis App E2E', () => {
    beforeAll(async () => {
        await device.launchApp();
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('App Launch', () => {
        it('should show the Go board on launch', async () => {
            await expect(element(by.id('go-board'))).toBeVisible();
        });

        it('should show navigation controls', async () => {
            await expect(element(by.id('prev-move-button'))).toBeVisible();
            await expect(element(by.id('next-move-button'))).toBeVisible();
        });

        it('should show the game chart', async () => {
            await expect(element(by.id('game-chart'))).toBeVisible();
        });
    });

    describe('Navigation', () => {
        it('should navigate to next move', async () => {
            await element(by.id('next-move-button')).tap();
            // Board should still be visible after navigation
            await expect(element(by.id('go-board'))).toBeVisible();
        });

        it('should navigate to previous move', async () => {
            await element(by.id('prev-move-button')).tap();
            await expect(element(by.id('go-board'))).toBeVisible();
        });

        it('should jump forward 10 moves', async () => {
            await element(by.id('next-10-button')).tap();
            await expect(element(by.id('go-board'))).toBeVisible();
        });

        it('should jump to start', async () => {
            await element(by.id('jump-start-button')).tap();
            await expect(element(by.id('go-board'))).toBeVisible();
        });

        it('should jump to end', async () => {
            await element(by.id('jump-end-button')).tap();
            await expect(element(by.id('go-board'))).toBeVisible();
        });
    });

    describe('Analysis Mode Toggle', () => {
        it('should toggle analysis mode on tap', async () => {
            await element(by.id('toggle-analysis-mode')).tap();
            // Chart should still be visible after toggle
            await expect(element(by.id('game-chart'))).toBeVisible();
        });

        it('should toggle back', async () => {
            await element(by.id('toggle-analysis-mode')).tap();
            await element(by.id('toggle-analysis-mode')).tap();
            await expect(element(by.id('game-chart'))).toBeVisible();
        });
    });

    describe('Board Interaction', () => {
        it('should handle tap on go board', async () => {
            await element(by.id('go-board')).tap();
            // App should not crash
            await expect(element(by.id('go-board'))).toBeVisible();
        });
    });
});
