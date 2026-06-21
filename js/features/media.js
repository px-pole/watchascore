export function createMediaManager({
  getState,
  getUi,
  placeholder,
  allowedLogoTypes,
  canvasSampleSize,
  capitalize,
  saveState,
  closeActiveModal,
  updateVisibilityHighlight,
  setModalTriggerElement,
  getModalTriggerElement,
  clearModalTriggerElement
}) {
  const brightnessCache = new Map();
  const pendingAnalysis = new Map();
  let pendingLogoSide = null;
  let pendingLogoBase64 = null;

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
  brightnessWorker.onerror = (e) => {
    console.warn('WatchaScore: Brightness Worker error:', e.message);
  };

  const analysisCanvas = document.createElement('canvas');
  const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
  analysisCanvas.width = canvasSampleSize;
  analysisCanvas.height = canvasSampleSize;

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
      pendingLogoBase64 = e.target.result;
      const ui = getUi();
      ui.cropPreviewImg.src = pendingLogoBase64;
      setModalTriggerElement(document.activeElement);
      ui.cropModal.classList.add('active');
      ui.cropModal.removeAttribute('aria-hidden');
      const applyBtn = ui.cropModal.querySelector('.btn-primary');
      if (applyBtn) applyBtn.focus();
      input.value = '';
    };
    reader.onerror = () => {
      if (label) label.classList.remove('uploading');
    };
    reader.readAsDataURL(file);
  }

  function confirmLogoUpload() {
    if (!pendingLogoSide || !pendingLogoBase64) return;
    const state = getState();
    if (!state[`${pendingLogoSide}Team`]) {
      state[`${pendingLogoSide}Team`] = {
        id: `custom-${pendingLogoSide}`,
        name: pendingLogoSide === 'home' ? 'Home' : 'Away'
      };
    }
    state[`${pendingLogoSide}Team`].badge = pendingLogoBase64;
    setBadge(pendingLogoSide, pendingLogoBase64);
    saveState();
    closeActiveModal();
  }

  return {
    setBadge,
    handleLogoUpload,
    confirmLogoUpload
  };
}
