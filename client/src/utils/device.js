/** True on phones and tablets (finger input), where focusing a field opens the keyboard. */
export const isTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
