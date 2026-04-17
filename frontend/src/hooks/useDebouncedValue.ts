import { useState, useEffect, useRef } from "react";

/**
 * 返回一个防抖后的值。当 value 变化后，延迟 delay 毫秒才更新返回值。
 * 适用于搜索输入等需要减少频繁触发的场景。
 *
 * @param value 原始值
 * @param delay 防抖延迟（毫秒），默认 400ms
 */
export function useDebouncedValue<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 返回一个防抖回调。在 delay 毫秒内多次调用只会执行最后一次。
 *
 * @param callback 要防抖的回调函数
 * @param delay 防抖延迟（毫秒），默认 400ms
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 400
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debouncedFn = useRef(
    ((...args: any[]) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T
  ).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return debouncedFn;
}
