export const theme = {
  categoryPalette: [
    '#444ce7',
    '#0e7090',
    '#5720b7',
    '#97180c',
    '#9e165f',
    '#4f7a21',
    '#52a8dd',
    '#646d73',
  ],
  fixedVariablePalette: {
    fixed: '#5720b7',
    variable: '#0071a6',
  },
  color: {
    bg: {
      base: '#f4f6f8',
      sunken: '#e8ecee',
    },
    surface: {
      default: '#ffffff',
      raised: '#ffffff',
      muted: '#e8ecee',
      selected: '#d2ecfe',
      overlay: '#ffffff',
      inverse: '#121b21',
      border: '#0f172a14',
    },
    text: {
      primary: '#121b21',
      secondary: '#535c62',
      tertiary: '#646d73',
      disabled: '#98a0a5',
      inverse: '#ffffff',
      onInverse: '#ffffff',
    },
    icon: {
      primary: '#121b21',
      secondary: '#535c62',
      action: '#0071a6',
      disabled: '#98a0a5',
      onMedia: '#ffffff',
      onInverse: '#ffffff',
    },
    border: {
      subtle: '#0f172a0f',
      default: '#0f172a1f',
      strong: '#0f172a38',
      focus: '#005984',
      focusContrast: '#ffffff',
      onInverse: '#ffffff3d',
    },
    separatorInset: '#0f172a1a',
    field: {
      fill: '#eef2f4',
      border: '#7c848a',
      borderError: '#b42318',
      borderFocus: '#005984',
      placeholder: '#646d73',
      supportingError: '#b42318',
      disabledFill: '#f4f6f8',
      disabledContent: '#98a0a5',
      disabledBorder: '#dadfe2',
      readOnlyFill: '#e8ecee',
      readOnlyContent: '#535c62',
    },
    action: {
      primary: {
        fill: '#0071a6',
        hover: '#005984',
        pressed: '#004061',
        content: '#ffffff',
        icon: '#ffffff',
        focus: '#005984',
        disabled: '#c7cdd1',
        disabledContent: '#98a0a5',
      },
      secondary: {
        fill: '#ffffff',
        hover: '#eef2f4',
        pressed: '#e8ecee',
        content: '#121b21',
        border: '#7c848a',
        focus: '#005984',
        disabledFill: '#f4f6f8',
        disabledContent: '#98a0a5',
        disabledBorder: '#dadfe2',
      },
      link: {
        rest: '#0071a6',
        hover: '#005984',
        pressed: '#004061',
        disabled: '#98a0a5',
      },
      container: '#ebf6fe',
      destructive: {
        fill: '#d92d20',
        hover: '#b42318',
        pressed: '#912018',
        content: '#ffffff',
        focus: '#b42318',
        disabledFill: '#dadfe2',
        disabledContent: '#98a0a5',
      },
    },
    state: {
      hover: '#0f172a0a',
      pressed: '#0f172a14',
    },
    selection: {
      container: '#a1d8fe',
    },
    status: {
      success: {
        content: '#067647',
        container: '#ecfdf3',
        border: '#abefc6',
        icon: '#067647',
      },
      warning: {
        content: '#93370d',
        container: '#fffaeb',
        border: '#fedf89',
        icon: '#93370d',
      },
      error: {
        content: '#b42318',
        container: '#fef3f2',
        border: '#fecdca',
        icon: '#b42318',
      },
      info: {
        content: '#005984',
        container: '#ebf6fe',
        border: '#a1d8fe',
        icon: '#005984',
      },
    },
    finance: {
      inflow: {
        content: '#107569',
        container: '#f0fdf9',
        border: '#99f6e0',
      },
      overLimit: {
        content: '#b93815',
        container: '#fef6ee',
        border: '#f9dbaf',
      },
    },
    data: {
      // Eight validated categorical hues (distinct under CVD), light & dark stepped.
      categorical: [
        '#2a78d6',
        '#eb6834',
        '#1baf7a',
        '#eda100',
        '#e87ba4',
        '#008300',
        '#6250d6',
        '#e34948',
      ],
      sequential: {
        1: '#bee4fe',
        3: '#52a8dd',
        5: '#006a9c',
      },
      diverging: {
        negative: '#b93815',
        neutral: '#c7cdd1',
        positive: '#107569',
      },
      selection: '#0071a6',
      selectionOutline: '#121b21',
      grid: '#0f172a0f',
      axis: '#0f172a1f',
      label: '#646d73',
      muted: '#7c848a',
      tooltipFill: '#121b21',
      tooltipContent: '#ffffff',
      tooltipBorder: '#ffffff3d',
    },
    overlay: {
      scrim: '#000000a6',
    },
    content: {
      onMedia: '#ffffff',
    },
    receipt: {
      scanGuide: '#ffffff',
    },
  },
  colors: {
    accent: '#0071a6',
    accentMuted: '#ebf6fe',
    background: '#f4f6f8',
    border: '#0f172a1f',
    danger: '#d92d20',
    dangerMuted: '#fef3f2',
    disabled: '#c7cdd1',
    overlay: '#000000a6',
    surface: '#ffffff',
    text: '#121b21',
    textMuted: '#535c62',
    white: '#ffffff',
  },
  fontSizes: {
    amount: 36,
    body: 16,
    button: 16,
    caption: 13,
    dayHeader: 14,
    label: 14,
    monthTotal: 34,
    small: 12,
    title: 28,
  },
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  type: {
    // Display/Hero — month balance on Home (only place this large)
    displayHero: { fontFamily: 'Inter_700Bold', fontSize: 56, lineHeight: 60, letterSpacing: -1.12 },
    // Display/Hero Small — same balance when the string is long (3 currencies / 6 digits)
    displayHeroSmall: { fontFamily: 'Inter_700Bold', fontSize: 40, lineHeight: 44, letterSpacing: -0.6 },
    // Title/Screen — screen title under the navbar
    titleScreen: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
    // Title/Section — section heading inside a screen
    titleSection: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
    // Title/Nav — navbar title, sheet header
    titleNav: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 22, letterSpacing: 0 },
    // Body/Strong — place name, receipt line-item name
    bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 22, letterSpacing: 0 },
    // Body/Default — settings row, ordinary text
    bodyDefault: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 22, letterSpacing: 0 },
    // Amount/Row — expense amount in a row (tabular required)
    amountRow: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: 0,
      fontVariant: ['tabular-nums'],
    },
    // Amount/Row Exception — refund / top-up, one weight heavier to code the exception
    amountRowException: {
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: 0,
      fontVariant: ['tabular-nums'],
    },
    // Label/Default — button label, label under an action icon
    labelDefault: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, letterSpacing: 0 },
    // Caption/Default — category, service caption
    captionDefault: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, letterSpacing: 0 },
    // Amount/Secondary — second-currency equivalent (tabular)
    amountSecondary: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
      fontVariant: ['tabular-nums'],
    },
    // Data/Value — value in a chart tooltip
    dataValue: { fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    // Micro/Label — pill, counter, state marker (all-caps, tracked)
    microLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 0.22 },
    // Micro/Strong — active tab, status pill, category in chart tooltip
    microStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 0 },
    // Micro/Default — inactive tab (no tracking — caption, not eyebrow)
    microDefault: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14, letterSpacing: 0 },
    // Data/Axis — axis labels, column labels, day numbers (smallest tier)
    dataAxis: { fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 14, letterSpacing: 0 },
  },
  opacity: {
    disabled: 0.55,
    pressed: 0.7,
  },
  radii: {
    button: 10,
    card: 14,
    chip: 20,
    input: 10,
    modal: 18,
    round: 999,
  },
  sizes: {
    border: 1,
    buttonHeight: 48,
    cameraHeight: 440,
    cameraMarker: 240,
    cameraMarkerBorder: 3,
    categoryMarker: 10,
    dateCell: 42,
    dateColumn: '14.285714%' as const,
    floatingButton: 56,
    iconButton: 40,
    maxContentWidth: 640,
    modalMaxHeight: '85%' as const,
    modalWidth: '92%' as const,
    multilineInputHeight: 104,
  },
  scale: {
    radius: {
      xs: 6,
      sm: 10,
      md: 14,
      lg: 20,
      sheet: 28,
      pill: 999,
    },
    size: {
      iconSm: 16,
      iconMd: 20,
      iconLg: 24,
      iconCircle: 34,
      iconButton: 40,
      fieldHeight: 40,
      touchTarget: 44,
      buttonHeight: 48,
      rowHeight: 64,
      chipHeight: 28,
      chipLgHeight: 36,
    },
    space: {
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      8: 32,
    },
    stroke: {
      hairline: 1,
      focusRing: 2,
      icon: 2,
    },
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    floatingOffset: 24,
    floatingStackOffset: 92,
    listBottom: 176,
  },
} as const;

export const color = theme.color;
export const lightColor = color;

export type Colors = typeof color;
export type ColorScheme = 'light' | 'dark';

type ColorShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string
    ? string
    : ColorShape<T[Key]>;
};

export const darkColor = {
  bg: {
    base: '#0e0e0e',
    sunken: '#070707',
  },
  surface: {
    default: '#171717',
    raised: '#1f1f1f',
    muted: '#262626',
    selected: '#35a7e824',
    overlay: '#1f1f1f',
    inverse: '#f2f2f2',
    border: '#ffffff00',
  },
  text: {
    primary: '#f2f2f2',
    secondary: '#a8a8a8',
    tertiary: '#8e8e8e',
    disabled: '#5c5c5c',
    inverse: '#0e0e0e',
    onInverse: '#0e0e0e',
  },
  icon: {
    primary: '#f2f2f2',
    secondary: '#a8a8a8',
    action: '#71c2f7',
    disabled: '#5c5c5c',
    onMedia: '#ffffff',
    onInverse: '#0e0e0e',
  },
  border: {
    subtle: '#ffffff17',
    default: '#ffffff38',
    strong: '#ffffff57',
    focus: '#71c2f7',
    focusContrast: '#0e0e0e',
    onInverse: '#0f172a3d',
  },
  separatorInset: '#ffffff2b',
  field: {
    fill: '#262626',
    border: '#7c848a',
    borderError: '#fda29b',
    borderFocus: '#71c2f7',
    placeholder: '#8e8e8e',
    supportingError: '#fda29b',
    disabledFill: '#262626',
    disabledContent: '#5c5c5c',
    disabledBorder: '#2b2b2b',
    readOnlyFill: '#2b2b2b',
    readOnlyContent: '#a8a8a8',
  },
  action: {
    primary: {
      fill: '#35a7e8',
      hover: '#71c2f7',
      pressed: '#008dcd',
      content: '#001727',
      icon: '#001727',
      focus: '#71c2f7',
      disabled: '#2b2b2b',
      disabledContent: '#5c5c5c',
    },
    secondary: {
      fill: '#1f1f1f',
      hover: '#2b2b2b',
      pressed: '#262626',
      content: '#f2f2f2',
      border: '#7c848a',
      focus: '#71c2f7',
      disabledFill: '#262626',
      disabledContent: '#5c5c5c',
      disabledBorder: '#2b2b2b',
    },
    link: {
      rest: '#71c2f7',
      hover: '#a1d8fe',
      pressed: '#d2ecfe',
      disabled: '#5c5c5c',
    },
    container: '#35a7e829',
    destructive: {
      fill: '#f97066',
      hover: '#fda29b',
      pressed: '#f04438',
      content: '#0e0e0e',
      focus: '#fda29b',
      disabledFill: '#2b2b2b',
      disabledContent: '#5c5c5c',
    },
  },
  state: {
    hover: '#ffffff0d',
    pressed: '#ffffff17',
  },
  selection: {
    container: '#35a7e84d',
  },
  status: {
    success: {
      content: '#75e0a7',
      container: '#053321',
      border: '#085d3a',
      icon: '#75e0a7',
    },
    warning: {
      content: '#fec84b',
      container: '#4e1d09',
      border: '#93370d',
      icon: '#fec84b',
    },
    error: {
      content: '#fda29b',
      container: '#55160c',
      border: '#912018',
      icon: '#fda29b',
    },
    info: {
      content: '#71c2f7',
      container: '#00253b',
      border: '#005984',
      icon: '#71c2f7',
    },
  },
  finance: {
    inflow: {
      content: '#5fe9d0',
      container: '#0a2926',
      border: '#125d56',
    },
    overLimit: {
      content: '#f7b27a',
      container: '#511c10',
      border: '#932f19',
    },
  },
  data: {
    // Eight validated categorical hues (distinct under CVD), light & dark stepped.
    categorical: [
      '#3987e5',
      '#d95926',
      '#199e70',
      '#c98500',
      '#d55181',
      '#008300',
      '#9085e9',
      '#e66767',
    ],
    sequential: {
      1: '#006a9c',
      3: '#52a8dd',
      5: '#bee4fe',
    },
    diverging: {
      negative: '#f7b27a',
      neutral: '#2b2b2b',
      positive: '#5fe9d0',
    },
    selection: '#35a7e8',
    selectionOutline: '#f2f2f2',
    grid: '#ffffff17',
    axis: '#ffffff38',
    label: '#8e8e8e',
    muted: '#8e8e8e',
    tooltipFill: '#f2f2f2',
    tooltipContent: '#0e0e0e',
    tooltipBorder: '#0f172a3d',
  },
  overlay: {
    scrim: '#000000b8',
  },
  content: {
    onMedia: '#ffffff',
  },
  receipt: {
    scanGuide: '#ffffff',
  },
} as const satisfies ColorShape<Colors>;
