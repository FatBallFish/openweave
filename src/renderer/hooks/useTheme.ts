import { useEffect } from 'react';
import { useSettingsStore } from '../features/workbench/settings.store';

const applyTheme = (theme: 'light' | 'dark'): void => {
  document.documentElement.setAttribute('data-theme', theme);
};

const clearTheme = (): void => {
  document.documentElement.removeAttribute('data-theme');
};

const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = (): void => {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    if (theme === 'system') {
      applyTheme(getSystemTheme());
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (event: MediaQueryListEvent): void => {
        applyTheme(event.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => {
        mediaQuery.removeEventListener('change', handler);
        clearTheme();
      };
    }

    if (theme === 'dark') {
      applyTheme('dark');
    } else {
      clearTheme();
    }

    return () => {
      clearTheme();
    };
  }, [theme]);
};
