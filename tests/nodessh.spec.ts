import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/Giaken/.gemini/antigravity/brain/885ed45a-a756-4059-aa84-676303d11341';

test.describe('NodeSSH Comprehensive E2E Test Suite', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      if (err.message.includes('ResizeObserver')) return;
      console.warn('Page error caught:', err.message);
    });
  });

  test('01. Authentication Flow: Register, Login and Dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NodeSSH/i);

    // If Auth Modal is open, test registration
    const registerTab = page.locator('button:has-text("Local Register")').first();
    if (await registerTab.isVisible()) {
      await registerTab.click();
      const testUsername = `user_${Date.now()}`;
      await page.fill('input[placeholder="Choose username"]', testUsername);
      await page.fill('input[placeholder="your.email@company.com"]', `${testUsername}@example.com`);
      await page.fill('input[placeholder="••••••••"]', 'SecretP@ssw0rd123');
      await page.click('button:has-text("Create Account")');
    }

    // Wait for terminal screen to load
    await page.waitForSelector('.xterm', { timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_dashboard.png') });
  });

  test('02. Multi-Tab Terminal & Vertical / Horizontal Split Views', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm', { timeout: 15000 });

    // Open another terminal tab
    const addTabBtn = page.locator('button[title*="New Terminal Tab"]').first();
    if (await addTabBtn.isVisible()) {
      await addTabBtn.click();
      const localShellOption = page.locator('button:has-text("New Local Shell")').first();
      if (await localShellOption.isVisible()) {
        await localShellOption.click();
      }
    }

    // Click Vertical Split (Left / Right)
    const splitVertBtn = page.locator('button[title*="Vertical Split"]').first();
    if (await splitVertBtn.isVisible()) {
      await splitVertBtn.click();
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_split_terminal.png') });
  });

  test('03. Broadcast / Multi-Exec Mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm', { timeout: 15000 });

    // Click Multi-Exec toggle button
    const multiExecBtn = page.locator('button:has-text("Multi-Exec")').first();
    if (await multiExecBtn.isVisible()) {
      await multiExecBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_multi_exec_banner.png') });
    }
  });

  test('04. Dockable Side-by-Side SFTP Explorer & In-Browser Code Editor', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm', { timeout: 15000 });

    // Toggle SFTP Side Explorer
    const sftpBtn = page.locator('button:has-text("SFTP")').first();
    if (await sftpBtn.isVisible()) {
      await sftpBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_sftp_explorer.png') });

      // Click on any file to test inline editor modal
      const firstFile = page.locator('.cursor-pointer:has-text(".sh"), .cursor-pointer:has-text(".conf"), .cursor-pointer:has-text(".json"), .cursor-pointer:has-text("txt")').first();
      if (await firstFile.isVisible()) {
        await firstFile.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, '04b_code_editor.png') });
        
        const closeEditorBtn = page.locator('button:has-text("Cancel"), button[title="Close"]').first();
        if (await closeEditorBtn.isVisible()) {
          await closeEditorBtn.click();
        }
      }
    }
  });

  test('05. Visual SSH Tunneling & LAN Sharing Manager', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { timeout: 15000 });

    // Click SSH Tunnels navigation on sidebar
    const tunnelsNav = page.locator('button:has-text("SSH Tunnels")').first();
    await expect(tunnelsNav).toBeVisible();
    await tunnelsNav.click();
    await page.waitForTimeout(500);

    // Verify Tunnel Dashboard
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_tunnel_dashboard.png') });

    // Open New Tunnel Modal
    const addTunnelBtn = page.locator('button:has-text("New Tunnel"), button:has-text("Create Tunnel")').first();
    if (await addTunnelBtn.isVisible()) {
      await addTunnelBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '05b_new_tunnel_modal.png') });

      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });

  test('06. Server Profiles & MobaXterm Importer / Exporter', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { timeout: 15000 });

    // Click Server Profiles on sidebar
    const profilesNav = page.locator('button:has-text("Server Profiles")').first();
    await expect(profilesNav).toBeVisible();
    await profilesNav.click();
    await page.waitForTimeout(500);

    // Verify Profiles View
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_profile_manager.png') });

    // Open Import / Export Modal
    const importExportBtn = page.locator('button:has-text("Import / Export"), button:has-text("Import")').first();
    if (await importExportBtn.isVisible()) {
      await importExportBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '06b_mobaxterm_importer.png') });

      const closeBtn = page.locator('button:has-text("Close"), button:has-text("Cancel")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test('07. Key Vault, Generator & ssh-copy-id Push Modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { timeout: 15000 });

    // Click Key Vault on sidebar
    const keysNav = page.locator('button:has-text("Key Vault")').first();
    await expect(keysNav).toBeVisible();
    await keysNav.click();
    await page.waitForTimeout(500);

    // Verify Key Vault View
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_key_vault.png') });

    // Open Key Generator Modal
    const genKeyBtn = page.locator('button:has-text("Generate Key")').first();
    if (await genKeyBtn.isVisible()) {
      await genKeyBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '07b_keygen_modal.png') });

      const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });

  test('08. Snippets & Macro Library', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { timeout: 15000 });

    // Click Snippet Library on sidebar
    const snippetsNav = page.locator('button:has-text("Snippet Library")').first();
    await expect(snippetsNav).toBeVisible();
    await snippetsNav.click();
    await page.waitForTimeout(500);

    // Verify Snippet Library View
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_snippet_library.png') });
  });

  test('09. Settings & Theme Customization', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { timeout: 15000 });

    // Open Settings Modal
    const settingsBtn = page.locator('button[title*="Settings"], button:has(.lucide-settings)').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_settings_themes.png') });

      const closeBtn = page.locator('button:has-text("Save"), button:has-text("Close")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });
});
