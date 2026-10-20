'use client';

import { useEffect } from 'react';
import { getThemeColor, getThemeSidebar, readSettings } from './appSettings.js';

export default function ThemeRuntime() {
  useEffect(() => {
    function applyTheme() {
      const themeId = readSettings().themeId;
      document.documentElement.style.setProperty('--clinic-accent', getThemeColor(themeId));
      document.documentElement.style.setProperty('--clinic-sidebar', getThemeSidebar(themeId));
    }

    applyTheme();
    window.addEventListener('clinic-settings-updated', applyTheme);
    window.addEventListener('storage', applyTheme);
    return () => {
      window.removeEventListener('clinic-settings-updated', applyTheme);
      window.removeEventListener('storage', applyTheme);
    };
  }, []);

  return null;
}