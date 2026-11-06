export interface DebouncedFn<A extends unknown[]> {
  (...args: A): void;
  /** 取消尚未触发的调用（页面卸载/条件变更时防残留定时器）。 */
  cancel(): void;
}

/**  trailing 防抖：连续调用只执行最后一次，waitMs 内无新调用才触发。 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): DebouncedFn<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const debounced = ((...args: A): void => {
    clear();
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as DebouncedFn<A>;

  debounced.cancel = clear;
  return debounced;
}
