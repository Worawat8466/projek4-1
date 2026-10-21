'use client';

import { useEffect } from 'react';
import { defaultSettings, getThemeColor, getThemeSidebar } from './appSettings.js';

export default function ThemeRuntime() {
  useEffect(() => {
    let active = true;
    async function applyTheme() {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('settings_load_failed');
        const data = await response.json();
        if (!active) return;
        document.documentElement.style.setProperty('--clinic-accent', getThemeColor(data.settings.themeId));
        document.documentElement.style.setProperty('--clinic-sidebar', getThemeSidebar(data.settings.themeId));
      } catch {
        if (!active) return;
        document.documentElement.style.setProperty('--clinic-accent', getThemeColor(defaultSettings.themeId));
        document.documentElement.style.setProperty('--clinic-sidebar', getThemeSidebar(defaultSettings.themeId));
      }
    }

    applyTheme();
    window.addEventListener('clinic-settings-updated', applyTheme);
    return () => {
      active = false;
      window.removeEventListener('clinic-settings-updated', applyTheme);
    };
  }, []);

  return null;
}