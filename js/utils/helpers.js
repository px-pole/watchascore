export const pad = (n) => String(n).padStart(2, '0');
export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const levenshteinDistance = (s1, s2) => {
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  if (s2.length === 0) return s1.length;
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    let currRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = prevRow[j + 1] + 1;
      const deletions = currRow[j] + 1;
      const subs = prevRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currRow.push(Math.min(insertions, deletions, subs));
    }
    prevRow = currRow;
  }
  return prevRow[s2.length];
};

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
