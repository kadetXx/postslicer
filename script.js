(() => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewImg = document.getElementById('previewImg');
  const cutsOverlay = document.getElementById('cutsOverlay');
  const segButtons = Array.from(document.querySelectorAll('.seg-btn'));
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const tweetTrack = document.getElementById('tweetTrack');
  const placeholderTrack = document.getElementById('placeholderTrack');
  const themeToggle = document.getElementById('themeToggle');
  const tweetCard = document.getElementById('tweetCard');
  const modeSwatches = Array.from(document.querySelectorAll('.tweet-mode-swatch'));
  const statusBox = document.querySelector('.status');
  const statusText = document.getElementById('statusText');

  let sliceCount = 3;
  let objectUrl = null;
  let naturalImg = null; // full-resolution Image for canvas work

  // a representative "landscape photo" used only to size the empty-state
  // placeholder boxes before a real photo is uploaded, so the crop shape
  // (2 slices -> squares, 3 slices -> tall portrait strips) is visible
  // immediately.
  const REF_LANDSCAPE_W = 1200;
  const REF_LANDSCAPE_H = 600;

  function openFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      naturalImg = img;
      previewImg.src = objectUrl;
      previewImg.hidden = false;
      dropzone.hidden = true;
      resetBtn.hidden = false;
      downloadBtn.disabled = false;
      statusBox.classList.add('is-loaded');
      renderCuts();
      renderTweetPreview();
      updateStatus();
    };
    img.src = objectUrl;
  }

  function renderCuts() {
    cutsOverlay.innerHTML = '';
    if (!naturalImg) return;

    for (let i = 1; i < sliceCount; i++) {
      const line = document.createElement('div');
      line.className = 'cut-line';
      line.style.left = (i / sliceCount) * 100 + '%';
      cutsOverlay.appendChild(line);
    }
    for (let i = 0; i < sliceCount; i++) {
      const tab = document.createElement('div');
      tab.className = 'cut-tab';
      tab.style.left = ((i + 0.5) / sliceCount) * 100 + '%';
      tab.textContent = String(i + 1).padStart(2, '0');
      cutsOverlay.appendChild(tab);
    }
  }

  function renderTweetPreview() {
    tweetTrack.innerHTML = '';
    placeholderTrack.innerHTML = '';

    if (!naturalImg) {
      tweetTrack.hidden = true;
      placeholderTrack.hidden = false;

      const aspect = `${REF_LANDSCAPE_W / sliceCount} / ${REF_LANDSCAPE_H}`;
      for (let i = 0; i < sliceCount; i++) {
        const box = document.createElement('div');
        box.className = 'placeholder-box';
        box.style.aspectRatio = aspect;
        placeholderTrack.appendChild(box);
      }
      placeholderTrack.scrollLeft = 0;
      return;
    }

    tweetTrack.hidden = false;
    placeholderTrack.hidden = true;

    const aspect = `${naturalImg.naturalWidth / sliceCount} / ${naturalImg.naturalHeight}`;

    for (let i = 0; i < sliceCount; i++) {
      const card = document.createElement('div');
      card.className = 'slide-card';
      card.style.aspectRatio = aspect;
      card.style.backgroundImage = `url(${objectUrl})`;
      // width scales to select the right horizontal slice; height stays
      // "auto" (true aspect ratio, no stretching) and just center-crops
      // if the card hits its max-height clamp on a very tall source.
      card.style.backgroundSize = `${sliceCount * 100}% auto`;
      card.style.backgroundPosition = `${(i / (sliceCount - 1)) * 100}% center`;
      tweetTrack.appendChild(card);
    }

    tweetTrack.scrollLeft = 0;
  }

  function updateStatus() {
    statusText.hidden = !naturalImg;
    statusText.textContent = naturalImg ? `${sliceCount}-SLICE` : '';
  }

  function setSliceCount(n) {
    sliceCount = n;
    segButtons.forEach(btn => {
      const active = Number(btn.dataset.count) === n;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    renderCuts();
    renderTweetPreview();
    updateStatus();
  }

  function reset() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    naturalImg = null;
    previewImg.src = '';
    previewImg.hidden = true;
    fileInput.value = '';
    resetBtn.hidden = true;
    downloadBtn.disabled = true;
    dropzone.hidden = false;
    statusBox.classList.remove('is-loaded');
    renderCuts();
    renderTweetPreview();
    updateStatus();
  }

  async function sliceAndDownload() {
    if (!naturalImg) return;

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'SLICING…';

    try {
      const w = naturalImg.naturalWidth;
      const h = naturalImg.naturalHeight;
      const bounds = [0];
      for (let i = 1; i < sliceCount; i++) bounds.push(Math.round((w / sliceCount) * i));
      bounds.push(w);

      const zip = new JSZip();

      for (let i = 0; i < sliceCount; i++) {
        const left = bounds[i];
        const right = bounds[i + 1];
        const sliceWidth = right - left;

        const canvas = document.createElement('canvas');
        canvas.width = sliceWidth;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(naturalImg, left, 0, sliceWidth, h, 0, 0, sliceWidth, h);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        zip.file(`slice-${i + 1}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `slicey-${sliceCount}-slices.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(zipUrl);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'SLICE & DOWNLOAD';
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(evt =>
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    })
  );
  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    openFile(file);
  });

  fileInput.addEventListener('change', () => openFile(fileInput.files[0]));

  segButtons.forEach(btn =>
    btn.addEventListener('click', () => setSliceCount(Number(btn.dataset.count)))
  );

  downloadBtn.addEventListener('click', sliceAndDownload);
  resetBtn.addEventListener('click', reset);

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  let storedTheme = null;
  try { storedTheme = localStorage.getItem('slicey-theme'); } catch (_) { /* private mode etc. */ }
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme || (systemPrefersDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('slicey-theme', next); } catch (_) { /* private mode etc. */ }
  });

  modeSwatches.forEach(btn =>
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      tweetCard.dataset.mode = mode;
      modeSwatches.forEach(s => {
        const active = s === btn;
        s.classList.toggle('is-active', active);
        s.setAttribute('aria-checked', String(active));
      });
    })
  );

  renderTweetPreview();
})();
