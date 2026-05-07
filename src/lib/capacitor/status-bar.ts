// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Status Bar Plugin
// ============================================================================
// Wrapper for Capacitor Status Bar plugin.
// Controls the native status bar appearance on iOS and Android.
// No-op on web browsers.
// ============================================================================

/**
 * Set the status bar background color.
 * Only effective on Android; iOS uses the style (light/dark content).
 * @param color - Hex color string (e.g., '#ffffff', '#9333ea')
 */
export function setStatusBarColor(color: string): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.setBackgroundColor({ color });
    } catch {
      // StatusBar not available on web; silently ignore
    }
  })();
}

/**
 * Set the status bar style (light or dark content).
 * - 'light': White status bar with dark text/icons
 * - 'dark': Dark status bar with light text/icons
 * @param style - The style to apply
 */
export function setStatusBarStyle(style: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      const styleMap: Record<string, typeof Style.Light> = {
        light: Style.Light,
        dark: Style.Dark,
      };
      await StatusBar.setStyle({ style: styleMap[style] ?? Style.Light });
    } catch {
      // StatusBar not available on web; silently ignore
    }
  })();
}

/**
 * Show or hide the status bar.
 * @param visible - Whether the status bar should be visible
 */
export function setStatusBarVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { StatusBar } = await import('@capacitor/status-bar');
      if (visible) {
        await StatusBar.show();
      } else {
        await StatusBar.hide();
      }
    } catch {
      // StatusBar not available on web; silently ignore
    }
  })();
}
