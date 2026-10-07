import { useNovoriTheme } from '@/context/theme-context';

// Keep shared components on the same palette as the app screens.
export function useTheme() {
  const { colors } = useNovoriTheme();
  return {
    ...colors,
    textSecondary: colors.secondaryText,
    backgroundElement: colors.surface,
    backgroundSelected: colors.elevated,
  };
}
