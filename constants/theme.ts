export const C = {
  bg: '#000000',
  surface: '#080808',
  surfaceHigh: '#111111',
  surfaceBorder: '#1A1A1A',

  red: '#FF0000',
  redDark: '#8B0000',
  redMid: '#CC0000',
  redGlow: 'rgba(255,0,0,0.18)',
  redGlowStrong: 'rgba(255,0,0,0.35)',

  green: '#00FF41',
  greenDark: '#00BB30',
  greenGlow: 'rgba(0,255,65,0.2)',

  white: '#FFFFFF',
  whiteOff: '#CCCCCC',

  gray: '#222222',
  grayMid: '#444444',
  grayLight: '#888888',

  text: '#FFFFFF',
  textMuted: '#888888',
  textDim: '#444444',

  gold: '#FFB200',
  blue: '#00C8FF',

  border: '#1A1A1A',
  radius: 12,
  radiusLg: 20,
};

export const FONT = {
  mono: Platform.OS === 'android' ? 'monospace' : 'Courier',
};

import { Platform } from 'react-native';
