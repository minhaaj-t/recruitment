import { MD3LightTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export const theme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1a237e',
    primaryContainer: '#e8eaf6',
    secondary: '#00695c',
    tertiary: '#c62828',
    surface: '#fafafa',
  },
};
