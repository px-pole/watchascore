export function createMediaManager({
  getUi,
  placeholder,
  allowedLogoTypes,
  canvasSampleSize,
  capitalize,
  applyTeamBadge,
  openModal,
  closeActiveModal,
  updateVisibilityHighlight
}) {
  const brightnessCache = new Map();
  const pendingAnalysis = new Map();
  let pendingLogoSide = null;
  let pendingLogoSource = null;
  let pendingLogoImage = null;

  // Worker script that classifies badge brightness as light or dark.
  const workerCode = `
onmessage = function(e) {
  const { imageData, src } = e.data;
  const data = new Uint8ClampedArray(imageData);
  let colorSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    colorSum += (r * 0.299 + g * 0.587 + b * 0.114);
  }
  const brightness = colorSum / (data.length / 4);
  postMessage({ src, result: brightness < 128 ? 'dark' : 'light' });
};
`;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const brightnessWorker = new Worker(URL.createObjectURL(blob));
  // Logs worker errors that prevent brightness analysis from completing.
  brightnessWorker.onerror = (e) => {
    console.warn('WatchaScore: Brightness Worker error:', e.message);
  };

  const analysisCanvas = document.createElement('canvas');
  const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
  analysisCanvas.width = canvasSampleSize;
  analysisCanvas.height = canvasSampleSize;

  // Clears staged upload data after finishing or cancelling crop.
  function clearPendingLogoState() {
    pendingLogoSide = null;
    pendingLogoSource = null;
    pendingLogoImage = null;
  }

  // Clamps a number to the provided range.
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Returns crop settings from modal controls with safe defaults.
  function getCropSettings() {
    const ui = getUi();
    const zoomPercent = clamp(parseFloat(ui.cropZoom?.value || '100'), 100, 300);
    const topPercent = clamp(parseFloat(ui.cropTop?.value || '0'), 0, 45);
    const rightPercent = clamp(parseFloat(ui.cropRight?.value || '0'), 0, 45);
    const bottomPercent = clamp(parseFloat(ui.cropBottom?.value || '0'), 0, 45);
    const leftPercent = clamp(parseFloat(ui.cropLeft?.value || '0'), 0, 45);
    return {
      zoom: zoomPercent / 100,
      topPercent,
      rightPercent,
      bottomPercent,
      leftPercent,
      zoomPercent
    };
  }

  // Updates visible value labels beside crop sliders.
  function syncCropControlLabels() {
    const ui = getUi();
    const { zoomPercent, topPercent, rightPercent, bottomPercent, leftPercent } = getCropSettings();
    if (ui.cropZoomValue) ui.cropZoomValue.textContent = `${Math.round(zoomPercent)}%`;
    if (ui.cropTopValue) ui.cropTopValue.textContent = `${Math.round(topPercent)}%`;
    if (ui.cropRightValue) ui.cropRightValue.textContent = `${Math.round(rightPercent)}%`;
    if (ui.cropBottomValue) ui.cropBottomValue.textContent = `${Math.round(bottomPercent)}%`;
    if (ui.cropLeftValue) ui.cropLeftValue.textContent = `${Math.round(leftPercent)}%`;
  }

  // Calculates a crop rectangle in source-image coordinates.
  function getCropRect(img, zoom, topPercent, rightPercent, bottomPercent, leftPercent) {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const insetX = width * (leftPercent / 100);
    const insetY = height * (topPercent / 100);
    const trimmedWidth = Math.max(1, width * (1 - (leftPercent + rightPercent) / 100));
    const trimmedHeight = Math.max(1, height * (1 - (topPercent + bottomPercent) / 100));

    const cropWidth = clamp(trimmedWidth / zoom, 1, trimmedWidth);
    const cropHeight = clamp(trimmedHeight / zoom, 1, trimmedHeight);
    const srcX = insetX + (trimmedWidth - cropWidth) / 2;
    const srcY = insetY + (trimmedHeight - cropHeight) / 2;

    return { srcX, srcY, cropWidth, cropHeight };
  }

  // Draws a crop region onto a square canvas while preserving image aspect ratio.
  function drawCropToCanvas(ctx, canvas, img, srcX, srcY, srcW, srcH) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const destX = (canvas.width - drawW) / 2;
    const destY = (canvas.height - drawH) / 2;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, drawW, drawH);
  }

  // Renders the current crop selection into the modal preview canvas.
  function renderCropPreview() {
    const ui = getUi();
    const previewCanvas = ui.cropPreviewCanvas;
    if (!previewCanvas) return;

    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (!pendingLogoImage) return;

    const { zoom, topPercent, rightPercent, bottomPercent, leftPercent } = getCropSettings();
    const { srcX, srcY, cropWidth, cropHeight } = getCropRect(
      pendingLogoImage,
      zoom,
      topPercent,
      rightPercent,
      bottomPercent,
      leftPercent
    );
    drawCropToCanvas(previewCtx, previewCanvas, pendingLogoImage, srcX, srcY, cropWidth, cropHeight);
  }

  // Restores crop controls to centered defaults for a new upload.
  function resetCropControls() {
    const ui = getUi();
    if (ui.cropZoom) ui.cropZoom.value = '100';
    if (ui.cropTop) ui.cropTop.value = '0';
    if (ui.cropRight) ui.cropRight.value = '0';
    if (ui.cropBottom) ui.cropBottom.value = '0';
    if (ui.cropLeft) ui.cropLeft.value = '0';
    syncCropControlLabels();
    renderCropPreview();
  }

  // Applies control changes to both labels and the crop preview.
  function updateCropPreviewFromControls() {
    syncCropControlLabels();
    renderCropPreview();
  }

  // Receives worker results and applies brightness classes to queued images.
  brightnessWorker.onmessage = function (e) {
    const { src, result } = e.data;
    brightnessCache.set(src, result);
    const imgs = pendingAnalysis.get(src);
    if (imgs) {
      imgs.forEach((img) => {
        if (img.src === src) {
          img.classList.add(result === 'dark' ? 'is-dark' : 'is-light');
          img.classList.remove(result === 'dark' ? 'is-light' : 'is-dark');
        }
      });
      pendingAnalysis.delete(src);
      updateVisibilityHighlight();
    }
  };

  // Samples an image to determine whether its badge should be treated as light or dark.
  function analyzeBrightness(img) {
    const src = img.src;
    if (!img?.complete || img.naturalWidth === 0 || src.includes('data:image/svg+xml')) {
      return;
    }

    if (brightnessCache.has(src)) {
      const result = brightnessCache.get(src);
      img.classList.add(result === 'dark' ? 'is-dark' : 'is-light');
      img.classList.remove(result === 'dark' ? 'is-light' : 'is-dark');
      updateVisibilityHighlight();
      return;
    }

    if (!analysisCtx) return;

    if (!pendingAnalysis.has(src)) {
      pendingAnalysis.set(src, new Set());
      try {
        analysisCtx.clearRect(0, 0, canvasSampleSize, canvasSampleSize);
        analysisCtx.drawImage(img, 0, 0, canvasSampleSize, canvasSampleSize);
        const imageData = analysisCtx.getImageData(0, 0, canvasSampleSize, canvasSampleSize);
        brightnessWorker.postMessage({ imageData: imageData.data.buffer, src }, [imageData.data.buffer]);
      } catch (_e) {
        img.classList.remove('is-dark', 'is-light');
        pendingAnalysis.delete(src);
      }
    }
    pendingAnalysis.get(src).add(img);
  }

  // Updates the visible badge image for a side and triggers loading state UI.
  function setBadge(side, src) {
    const ui = getUi();
    const sideKey = capitalize(side);
    const badgeConfigs = [
      { img: ui[`${side}Badge`], wrap: ui[`${side}BadgeWrap`] },
      { img: ui[`mini${sideKey}Badge`], wrap: ui[`mini${sideKey}BadgeWrap`] }
    ];
    const targetSrc = src || placeholder;

    badgeConfigs.forEach(({ img, wrap }) => {
      if (!img || img.dataset.currentSrc === targetSrc) return;
      img.dataset.currentSrc = targetSrc;
      img.classList.remove('is-dark', 'is-light');
      img.style.opacity = '0';
      img.style.transform = 'scale(0.92)';
      img.setAttribute('aria-hidden', 'true');

      if (targetSrc.startsWith('http')) img.crossOrigin = 'anonymous';
      else img.removeAttribute('crossorigin');

      if (targetSrc === placeholder) {
        img.src = placeholder;
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
        img.removeAttribute('aria-hidden');
        if (wrap) {
          wrap.classList.remove('loading');
          wrap.removeAttribute('aria-busy');
        }
        updateVisibilityHighlight();
        return;
      }

      if (wrap) {
        wrap.classList.add('loading');
        wrap.setAttribute('aria-busy', 'true');
      }
      const finishLoading = () => {
        if (wrap) {
          wrap.classList.remove('loading');
          wrap.removeAttribute('aria-busy');
        }
        requestAnimationFrame(() => {
          img.style.opacity = '1';
          img.style.transform = 'scale(1)';
          img.removeAttribute('aria-hidden');
          analyzeBrightness(img);
        });
      };
      img.onload = finishLoading;
      img.onerror = () => {
        img.src = placeholder;
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
        img.removeAttribute('aria-hidden');
        if (wrap) {
          wrap.classList.remove('loading');
          wrap.removeAttribute('aria-busy');
        }
        updateVisibilityHighlight();
      };
      img.src = targetSrc;
      if (img.complete && img.naturalWidth !== 0) finishLoading();
    });
  }

  // Validates and stages an uploaded logo before the crop modal opens.
  function handleLogoUpload(side, input) {
    const file = input.files[0];
    if (!file) return;
    if (!allowedLogoTypes.has(file.type)) {
      alert('Please upload a valid image file (PNG, JPG, GIF, WebP, or SVG).');
      input.value = '';
      return;
    }
    const maxSizeMb = 2;
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`The selected image is too large. Please upload a file smaller than ${maxSizeMb}MB.`);
      input.value = '';
      return;
    }
    const label = input.closest('label');
    if (label) label.classList.add('uploading');
    const reader = new FileReader();
    reader.onload = (e) => {
      if (label) label.classList.remove('uploading');
      pendingLogoSide = side;
      pendingLogoSource = e.target.result;

      const sourceImg = new Image();
      sourceImg.onload = () => {
        pendingLogoImage = sourceImg;
        resetCropControls();

        const ui = getUi();
        const applyBtn = ui.cropModal.querySelector('.btn-primary');
        openModal(ui.cropModal, {
          initialFocus: applyBtn,
          onClose: () => {
            clearPendingLogoState();
            const previewCtx = ui.cropPreviewCanvas?.getContext('2d');
            if (previewCtx && ui.cropPreviewCanvas) {
              previewCtx.clearRect(0, 0, ui.cropPreviewCanvas.width, ui.cropPreviewCanvas.height);
            }
          }
        });
      };

      sourceImg.onerror = () => {
        alert('Could not load this image for cropping. Please try another file.');
        clearPendingLogoState();
      };

      sourceImg.src = pendingLogoSource;
      input.value = '';
    };
    reader.onerror = () => {
      if (label) label.classList.remove('uploading');
    };
    reader.readAsDataURL(file);
  }

  // Applies the staged cropped logo as the selected badge image.
  function confirmLogoUpload() {
    if (!pendingLogoSide || !pendingLogoImage) return;

    const { zoom, topPercent, rightPercent, bottomPercent, leftPercent } = getCropSettings();
    const { srcX, srcY, cropWidth, cropHeight } = getCropRect(
      pendingLogoImage,
      zoom,
      topPercent,
      rightPercent,
      bottomPercent,
      leftPercent
    );

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = 512;
    outputCanvas.height = 512;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    drawCropToCanvas(outputCtx, outputCanvas, pendingLogoImage, srcX, srcY, cropWidth, cropHeight);

    const croppedLogo = outputCanvas.toDataURL('image/png');

    applyTeamBadge(pendingLogoSide, croppedLogo);
    setBadge(pendingLogoSide, croppedLogo);
    closeActiveModal();
  }

  return {
    setBadge,
    handleLogoUpload,
    confirmLogoUpload,
    resetCropControls,
    updateCropPreviewFromControls
  };
}
