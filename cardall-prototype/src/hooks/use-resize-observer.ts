import { useEffect, useRef, useCallback } from 'react'

interface UseResizeObserverOptions {
  onResize?: (entry: ResizeObserverEntry) => void
  debounceMs?: number
}

export function useResizeObserver<T extends HTMLElement>({
  onResize,
  debounceMs = 100
}: UseResizeObserverOptions = {}) {
  const elementRef = useRef<T>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback((entry: ResizeObserverEntry) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      onResize?.(entry)
    }, debounceMs)
  }, [onResize, debounceMs])

  useEffect(() => {
    const element = elementRef.current
    if (!element || !onResize) return

    // Create ResizeObserver
    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        debouncedCallback(entry)
      }
    })

    // Start observing
    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [debouncedCallback, onResize])

  return elementRef
}

export default useResizeObserver