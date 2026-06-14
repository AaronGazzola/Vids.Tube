import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isVertical(
  width: number | null | undefined,
  height: number | null | undefined
): boolean {
  if (!width || !height) {
    return false;
  }
  return height > width;
}
