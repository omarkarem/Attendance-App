// Joins class names, skipping falsy values.
const cx = (...parts) => parts.filter(Boolean).join(' ');

export default cx;
