/**
 * 微信自定义导航布局计算（纯函数，便于单测）
 *
 * 决策（tasks.json MP-07）：只自绘 44px 标题导航，状态栏与微信胶囊交给系统渲染。
 * 但「状态栏高度」与「胶囊位置」随机型变化，必须用
 * uni.getMenuButtonBoundingClientRect() 反推标题导航高度与右侧安全留白；
 * 接口不可用 / 返回值异常时兜底 nav 44 + 状态栏 32 = 76（与设计稿一致）。
 */

/** 微信标题导航设计高度（px）。 */
export const NAV_TITLE_HEIGHT = 44;
/** 状态栏兜底高度（px，设计基准）。 */
export const DEFAULT_STATUS_BAR_HEIGHT = 32;
/** 导航整体兜底高度 = 44 + 32。 */
export const DEFAULT_NAV_TOTAL_HEIGHT = NAV_TITLE_HEIGHT + DEFAULT_STATUS_BAR_HEIGHT;
/** 胶囊兜底尺寸（px）。 */
export const DEFAULT_CAPSULE_WIDTH = 76;
export const DEFAULT_CAPSULE_HEIGHT = 28;
/** 设计基准屏宽（px）。 */
export const DEFAULT_WINDOW_WIDTH = 375;
/** 标题导航左右内边距（px）。 */
export const NAV_PADDING_X = 16;
/** 胶囊右侧安全留白兜底 = 胶囊宽 76 + 右内边距 16。 */
export const DEFAULT_RIGHT_SAFE_WIDTH = DEFAULT_CAPSULE_WIDTH + NAV_PADDING_X;

/** 胶囊与标题导航之间的最小垂直间距（px）。 */
const MIN_CAPSULE_GAP = 2;
/** 反推标题导航高度的合理区间（px）。 */
const MIN_NAV_BAR_HEIGHT = 40;
const MAX_NAV_BAR_HEIGHT = 56;

export interface MenuButtonRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface NavLayoutInput {
  /** uni.getMenuButtonBoundingClientRect() 的返回值；缺失表示接口不可用。 */
  menuRect?: Partial<MenuButtonRect> | null;
  /** uni.getSystemInfoSync().statusBarHeight。 */
  statusBarHeight?: number | null;
  /** uni.getSystemInfoSync().windowWidth。 */
  windowWidth?: number | null;
}

export interface NavLayout {
  /** 状态栏高度（px）。 */
  statusBarHeight: number;
  /** 标题导航高度（px）。 */
  navBarHeight: number;
  /** 导航总高 = 状态栏 + 标题导航（px）。 */
  totalHeight: number;
  /** 标题导航右侧需要为微信胶囊让出的宽度（px）。 */
  rightSafeWidth: number;
  /** 是否命中兜底（胶囊接口不可用或返回值异常）。 */
  fallback: boolean;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** 判断胶囊矩形是否可用于反推导航高度。 */
export function isValidMenuRect(
  rect: Partial<MenuButtonRect> | null | undefined,
  statusBarHeight: number,
  windowWidth: number
): rect is MenuButtonRect {
  if (!rect) return false;
  const { top, bottom, left, right, width, height } = rect;
  if (
    !isFinitePositive(top) ||
    !isFinitePositive(bottom) ||
    !isFinitePositive(left) ||
    !isFinitePositive(right) ||
    !isFinitePositive(width) ||
    !isFinitePositive(height)
  ) {
    return false;
  }
  if (width < 20 || width > windowWidth) return false;
  if (height < 16 || height > 48) return false;
  if (top < statusBarHeight - 4) return false;
  if (bottom <= top || bottom > statusBarHeight + MAX_NAV_BAR_HEIGHT) return false;
  if (right > windowWidth + 1) return false;
  if (left >= right) return false;
  return true;
}

/**
 * 计算导航布局。
 * 反推公式：标题导航高度 = (胶囊 top - 状态栏高度) * 2 + 胶囊高度。
 */
export function resolveNavLayout(input: NavLayoutInput = {}): NavLayout {
  const statusBarHeight = isFinitePositive(input.statusBarHeight)
    ? input.statusBarHeight
    : DEFAULT_STATUS_BAR_HEIGHT;
  const windowWidth = isFinitePositive(input.windowWidth)
    ? input.windowWidth
    : DEFAULT_WINDOW_WIDTH;
  const fallbackLayout: NavLayout = {
    statusBarHeight,
    navBarHeight: NAV_TITLE_HEIGHT,
    totalHeight: statusBarHeight + NAV_TITLE_HEIGHT,
    rightSafeWidth: DEFAULT_RIGHT_SAFE_WIDTH,
    fallback: true,
  };

  if (!isValidMenuRect(input.menuRect, statusBarHeight, windowWidth)) {
    return fallbackLayout;
  }

  const menuRect = input.menuRect;
  const verticalGap = menuRect.top - statusBarHeight;
  if (verticalGap < MIN_CAPSULE_GAP) {
    return fallbackLayout;
  }

  const navBarHeight = verticalGap * 2 + menuRect.height;
  if (navBarHeight < MIN_NAV_BAR_HEIGHT || navBarHeight > MAX_NAV_BAR_HEIGHT) {
    return fallbackLayout;
  }

  const rightSafeWidth = Math.max(
    DEFAULT_CAPSULE_WIDTH,
    Math.min(windowWidth, Math.round(windowWidth - menuRect.left + NAV_PADDING_X))
  );

  return {
    statusBarHeight,
    navBarHeight,
    totalHeight: statusBarHeight + navBarHeight,
    rightSafeWidth,
    fallback: false,
  };
}

interface UniLike {
  getMenuButtonBoundingClientRect?: () => Partial<MenuButtonRect> | undefined;
  getSystemInfoSync?: () => {
    statusBarHeight?: number;
    windowWidth?: number;
  };
}

/** 取当前运行时的 uni（编译期注入的全局，测试环境通过 globalThis.uni 注入）。 */
function getUni(): UniLike | undefined {
  const injected = (globalThis as { uni?: UniLike }).uni;
  if (injected) return injected;
  try {
    // eslint-disable-next-line no-undef
    return typeof uni !== "undefined" ? (uni as unknown as UniLike) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 读取真实环境指标并计算布局。任何 API 抛错或缺失都走兜底，绝不让导航渲染失败。
 */
export function readNavLayout(): NavLayout {
  const uniApi = getUni();
  let menuRect: Partial<MenuButtonRect> | undefined;
  let statusBarHeight: number | undefined;
  let windowWidth: number | undefined;

  try {
    menuRect = uniApi?.getMenuButtonBoundingClientRect?.();
  } catch {
    menuRect = undefined;
  }
  try {
    const info = uniApi?.getSystemInfoSync?.();
    statusBarHeight = info?.statusBarHeight;
    windowWidth = info?.windowWidth;
  } catch {
    statusBarHeight = undefined;
    windowWidth = undefined;
  }

  return resolveNavLayout({ menuRect, statusBarHeight, windowWidth });
}
