export type CryptDepthTheme = {
  name: string;

  background: number;
  fog: number;
  glow: number;

  panel: number;
  panelWarm: number;

  stroke: number;
  accent: number;
  danger: number;

  text: string;
  mutedText: string;
};

export function getCryptDepthTheme(floor: number): CryptDepthTheme {
  if (floor >= 46) {
    return {
      name: 'Донная бездна',

      background: 0x010203,
      fog: 0x181126,
      glow: 0x0b3438,

      panel: 0x030d18,
      panelWarm: 0x181126,

      stroke: 0x9f7e45,
      accent: 0x0b3438,
      danger: 0x7a1f24,

      text: '#d8c088',
      mutedText: '#7f9aa0',
    };
  }

  if (floor >= 36) {
    return {
      name: 'Склепы чёрной воды',

      background: 0x030405,
      fog: 0x0e2a2d,
      glow: 0x5f7f9d,

      panel: 0x071827,
      panelWarm: 0x263426,

      stroke: 0x5e3a24,
      accent: 0x5f7f9d,
      danger: 0x8d2f2f,

      text: '#d8e6e8',
      mutedText: '#8aa4a8',
    };
  }

  if (floor >= 25) {
    return {
      name: 'Затопленные склепы',

      background: 0x050607,
      fog: 0x1f2e27,
      glow: 0x101c2a,

      panel: 0x10141a,
      panelWarm: 0x1f2e27,

      stroke: 0x2a2e31,
      accent: 0xb89a5e,
      danger: 0x7a1f24,

      text: '#d9d4c8',
      mutedText: '#9fa8a3',
    };
  }

  if (floor >= 21) {
    return {
      name: 'Черная усыпальница',

      background: 0x030202,
      fog: 0x5c1010,
      glow: 0x8a1c1c,

      panel: 0x120606,
      panelWarm: 0x1a0808,

      stroke: 0x8a2a2a,
      accent: 0xff6b6b,
      danger: 0xff4d4d,

      text: '#f2dada',
      mutedText: '#b88f8f',
    };
  }

  if (floor >= 11) {
    return {
      name: 'Гниющие глубины',

      background: 0x050605,
      fog: 0x44523a,
      glow: 0x4f6b3a,

      panel: 0x0d100b,
      panelWarm: 0x11170d,

      stroke: 0x3f5a32,
      accent: 0x9fbf7a,
      danger: 0xff6b6b,

      text: '#d8e0c5',
      mutedText: '#9aaa82',
    };
  }

  return {
    name: 'Заброшенный склеп',

    background: 0x080706,
    fog: 0xb8aa91,
    glow: 0x8b6f4a,

    panel: 0x120d0a,
    panelWarm: 0x17100c,

    stroke: 0x5a422a,
    accent: 0xd8c7a3,
    danger: 0xff6b6b,

    text: '#e8dcc7',
    mutedText: '#b8aa91',
  };
}
