import { RefObject, useCallback, useEffect, useState } from 'react';

interface DropdownPosition {
  openUp: boolean;
  alignRight: boolean;
}

/**
 * Measures the trigger element and determines whether a dropdown/popover
 * should open upward (when near viewport bottom) or align to the right
 * edge (when near viewport right). Recalculates on open, scroll & resize.
 *
 * @param containerRef  – ref to the wrapper element that holds the trigger
 * @param open          – whether the dropdown is currently visible
 * @param dropdownH     – estimated dropdown height in px (default 320)
 * @param dropdownW     – estimated dropdown width in px (default 300)
 */
export function useDropdownPosition(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  dropdownH = 320,
  dropdownW = 300,
): DropdownPosition {
  const [pos, setPos] = useState<DropdownPosition>({ openUp: false, alignRight: false });

  const calculate = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Space below trigger vs above trigger
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < dropdownH && spaceAbove > spaceBelow;

    // Space to the right of the trigger's left edge
    const spaceRight = vw - rect.left;
    const alignRight = spaceRight < dropdownW && rect.right > dropdownW;

    setPos({ openUp, alignRight });
  }, [containerRef, dropdownH, dropdownW]);

  useEffect(() => {
    if (!open) return;
    // Calculate immediately
    calculate();
    // Recalculate on scroll/resize (any scroll container via capture)
    window.addEventListener('scroll', calculate, true);
    window.addEventListener('resize', calculate);
    return () => {
      window.removeEventListener('scroll', calculate, true);
      window.removeEventListener('resize', calculate);
    };
  }, [open, calculate]);

  return pos;
}
