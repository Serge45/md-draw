import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const MPE_BLOCK_START = '<!-- markdown-draw-overlay:start -->';
const MPE_BLOCK_END = '<!-- markdown-draw-overlay:end -->';
const MPE_SCRIPT_FILENAME = 'markdown-draw-overlay.js';

/**
 * Resolve the global Crossnote / Markdown Preview Enhanced configuration directory.
 */
function resolveMpeConfigDir(): string {
  const customPath = vscode.workspace
    .getConfiguration('markdown-preview-enhanced')
    .get<string>('configPath', '')
    .trim();

  if (customPath.length > 0) {
    let expanded = customPath;
    if (expanded === '~') {
      expanded = os.homedir();
    } else if (expanded.startsWith('~/') || expanded.startsWith('~\\')) {
      expanded = path.join(os.homedir(), expanded.slice(2));
    }
    return path.resolve(expanded);
  }

  if (process.platform === 'win32') {
    return path.join(os.homedir(), '.crossnote');
  }

  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, '.crossnote');
  }

  const legacyDir = path.join(os.homedir(), '.crossnote');
  if (fs.existsSync(legacyDir)) {
    return legacyDir;
  }

  return path.join(os.homedir(), '.local', 'state', 'crossnote');
}

/**
 * Insert or replace the managed Markdown Draw Overlay block inside head.html.
 */
function upsertManagedBlock(existing: string, block: string): string {
  const startIdx = existing.indexOf(MPE_BLOCK_START);
  const endIdx = existing.indexOf(MPE_BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    return (
      existing.slice(0, startIdx) +
      block +
      existing.slice(endIdx + MPE_BLOCK_END.length)
    );
  }

  const trimmed = existing.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

/**
 * Remove the managed Markdown Draw Overlay block from head.html if present.
 */
function removeManagedBlock(existing: string): { content: string; removed: boolean } {
  const startIdx = existing.indexOf(MPE_BLOCK_START);
  const endIdx = existing.indexOf(MPE_BLOCK_END);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return { content: existing, removed: false };
  }

  const before = existing.slice(0, startIdx).replace(/[ \t]*\r?\n*$/, '');
  const after = existing.slice(endIdx + MPE_BLOCK_END.length).replace(/^\r?\n*/, '');

  let merged = '';
  if (before && after) {
    merged = `${before}\n\n${after}`;
  } else if (before) {
    merged = `${before}\n`;
  } else if (after) {
    merged = after;
  }

  return { content: merged, removed: true };
}

/**
 * Activate the Markdown Draw Overlay extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  const openPreviewDisposable = vscode.commands.registerCommand(
    'markdownDrawOverlay.openPreview',
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (editor && editor.document.languageId === 'markdown') {
        await vscode.commands.executeCommand('markdown.showPreviewToSide');
        return;
      }

      if (editor) {
        const previewAnywayBtn = vscode.l10n.t('Preview Current File Anyway');
        const action = await vscode.window.showInformationMessage(
          vscode.l10n.t(
            'Please open a Markdown (.md) file first, then open the native Markdown Preview (Ctrl+Shift+V or Ctrl+K V) to start annotating.'
          ),
          previewAnywayBtn
        );
        if (action === previewAnywayBtn) {
          await vscode.commands.executeCommand('markdown.showPreview');
        }
        return;
      }

      void vscode.window.showInformationMessage(
        vscode.l10n.t(
          'Please open a Markdown (.md) file first, then open the native Markdown Preview (Ctrl+Shift+V or Ctrl+K V) to use Markdown Draw Overlay.'
        )
      );
    }
  );

  const installMpeDisposable = vscode.commands.registerCommand(
    'markdownDrawOverlay.installMpeIntegration',
    async () => {
      try {
        const mpeConfigDir = resolveMpeConfigDir();
        fs.mkdirSync(mpeConfigDir, { recursive: true });

        const overlayJsPath = path.join(context.extensionPath, 'media', 'overlay.js');
        const overlayCssPath = path.join(context.extensionPath, 'media', 'overlay.css');
        const overlayJs = fs.readFileSync(overlayJsPath, 'utf8');
        const overlayCss = fs.readFileSync(overlayCssPath, 'utf8');

        const targetScriptPath = path.join(mpeConfigDir, MPE_SCRIPT_FILENAME);
        fs.writeFileSync(targetScriptPath, overlayJs, 'utf8');

        const managedBlock = [
          MPE_BLOCK_START,
          '<style id="mdo-mpe-style">',
          overlayCss.trimEnd(),
          '</style>',
          `<script src="${MPE_SCRIPT_FILENAME}" defer></script>`,
          MPE_BLOCK_END
        ].join('\n');

        const headHtmlPath = path.join(mpeConfigDir, 'head.html');
        const existingHead = fs.existsSync(headHtmlPath)
          ? fs.readFileSync(headHtmlPath, 'utf8')
          : '';
        const updatedHead = upsertManagedBlock(existingHead, managedBlock);
        fs.writeFileSync(headHtmlPath, updatedHead, 'utf8');

        const mpeConfig = vscode.workspace.getConfiguration('markdown-preview-enhanced');
        const scriptsEnabled = mpeConfig.get<boolean>('enablePreviewScripts', false);
        const openHeadBtn = vscode.l10n.t('Open head.html');

        if (!scriptsEnabled) {
          const enableNowBtn = vscode.l10n.t('Enable enablePreviewScripts Now');
          const laterBtn = vscode.l10n.t('Later');
          const choice = await vscode.window.showInformationMessage(
            vscode.l10n.t(
              'Markdown Draw Overlay has been written to the MPE config directory ({0}). MPE disables preview scripts by default — enable markdown-preview-enhanced.enablePreviewScripts to load the toolbar.',
              mpeConfigDir
            ),
            enableNowBtn,
            openHeadBtn,
            laterBtn
          );

          if (choice === enableNowBtn) {
            try {
              await mpeConfig.update(
                'enablePreviewScripts',
                true,
                vscode.ConfigurationTarget.Global
              );
              const trustNotice = vscode.workspace.isTrusted
                ? vscode.l10n.t(
                    'Enabled enablePreviewScripts. Please reopen or refresh your MPE preview tab to start drawing.'
                  )
                : vscode.l10n.t(
                    'Enabled enablePreviewScripts. Note: this workspace is currently untrusted, so MPE will ignore preview scripts until you trust the workspace.'
                  );
              void vscode.window.showInformationMessage(trustNotice);
            } catch {
              const openSettingsBtn = vscode.l10n.t('Open Settings');
              const fallback = await vscode.window.showWarningMessage(
                vscode.l10n.t(
                  'Could not automatically update markdown-preview-enhanced.enablePreviewScripts (please verify Markdown Preview Enhanced is installed).'
                ),
                openSettingsBtn
              );
              if (fallback === openSettingsBtn) {
                await vscode.commands.executeCommand(
                  'workbench.action.openSettings',
                  'markdown-preview-enhanced.enablePreviewScripts'
                );
              }
            }
          } else if (choice === openHeadBtn) {
            await vscode.window.showTextDocument(vscode.Uri.file(headHtmlPath));
          }
          return;
        }

        const readyMsg = vscode.workspace.isTrusted
          ? vscode.l10n.t(
              'Synced Markdown Draw Overlay to MPE ({0}). Reopen or refresh your MPE preview tab to start drawing.',
              mpeConfigDir
            )
          : vscode.l10n.t(
              'Synced Markdown Draw Overlay to MPE ({0}). This workspace is currently untrusted, so MPE will ignore head.html scripts until you trust the workspace.',
              mpeConfigDir
            );

        const action = await vscode.window.showInformationMessage(readyMsg, openHeadBtn);
        if (action === openHeadBtn) {
          await vscode.window.showTextDocument(vscode.Uri.file(headHtmlPath));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to install MPE integration: {0}', message)
        );
      }
    }
  );

  const removeMpeDisposable = vscode.commands.registerCommand(
    'markdownDrawOverlay.removeMpeIntegration',
    async () => {
      try {
        const mpeConfigDir = resolveMpeConfigDir();
        const headHtmlPath = path.join(mpeConfigDir, 'head.html');
        const targetScriptPath = path.join(mpeConfigDir, MPE_SCRIPT_FILENAME);

        let removedHead = false;
        let removedScript = false;

        if (fs.existsSync(headHtmlPath)) {
          const existingHead = fs.readFileSync(headHtmlPath, 'utf8');
          const result = removeManagedBlock(existingHead);
          if (result.removed) {
            fs.writeFileSync(headHtmlPath, result.content, 'utf8');
            removedHead = true;
          }
        }

        if (fs.existsSync(targetScriptPath)) {
          fs.unlinkSync(targetScriptPath);
          removedScript = true;
        }

        if (removedHead || removedScript) {
          void vscode.window.showInformationMessage(
            vscode.l10n.t(
              'Removed Markdown Draw Overlay integration from MPE config directory ({0}).',
              mpeConfigDir
            )
          );
        } else {
          void vscode.window.showInformationMessage(
            vscode.l10n.t(
              'No Markdown Draw Overlay integration was found in MPE config directory ({0}).',
              mpeConfigDir
            )
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to remove MPE integration: {0}', message)
        );
      }
    }
  );

  context.subscriptions.push(openPreviewDisposable, installMpeDisposable, removeMpeDisposable);
}

/**
 * Clean up resources when the extension is deactivated.
 */
export function deactivate(): void {
  // All annotation UI runs inside the Markdown Preview webview.
}
