self.onmessage = function(e) {
  const { imageData, src } = e.data;
  const data = new Uint8ClampedArray(imageData);
  let brightnessSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // Only count pixels with significant opacity
    if (a > 125) {
      brightnessSum += (0.299 * r + 0.587 * g + 0.114 * b);
      count++;
    }
  }

  const brightness = count > 0 ? (brightnessSum / count) : 255;
  const result = (brightness < 145) ? 'dark' : 'light';

  self.postMessage({ src, result });
};