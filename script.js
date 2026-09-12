(() => {
  const frame = document.querySelector('.frame');
  const photoBtn = document.getElementById('photoBtn');
  const fileInput = document.getElementById('fileInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const carousel = document.getElementById('carousel');
  const sliceTabs = Array.from(document.querySelectorAll('.slice-tab'));

  let sliceCount = 3;
  let objectUrl = null;
  let naturalImg = null; // full-resolution Image for canvas work

  // representative "landscape photo" used only to shape the empty-state
  // placeholder tiles before a real photo is picked (2 slices -> squares,
  // 3 slices -> tall portrait strips), so the crop goal is visible up front.
  const REF_LANDSCAPE_W = 1200;
  const REF_LANDSCAPE_H = 600;

  function openFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      naturalImg = img;
      downloadBtn.hidden = false;
      renderCarousel();
    };
    img.src = objectUrl;
  }

  function renderCarousel() {
    carousel.innerHTML = '';

    const aspect = naturalImg
      ? `${naturalImg.naturalWidth / sliceCount} / ${naturalImg.naturalHeight}`
      : `${REF_LANDSCAPE_W / sliceCount} / ${REF_LANDSCAPE_H}`;

    for (let i = 0; i < sliceCount; i++) {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.style.position = 'relative';
      slide.style.aspectRatio = aspect;

      if (naturalImg) {
        slide.style.backgroundImage = `url(${objectUrl})`;
        slide.style.backgroundSize = `${sliceCount * 100}% auto`;
        slide.style.backgroundPosition = `${(i / (sliceCount - 1)) * 100}% center`;
      }

      if (i === 0) {
        const label = document.createElement('span');
        label.className = 'slide-placeholder-label';
        label.textContent = `1/${sliceCount}`;
        label.style.left = '0';
        label.style.bottom = '0';
        slide.appendChild(label);
      }

      carousel.appendChild(slide);
    }

    carousel.scrollLeft = 0;
  }

  function setSliceCount(n) {
    sliceCount = n;
    sliceTabs.forEach(tab => {
      const active = Number(tab.dataset.count) === n;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    renderCarousel();
  }

  async function sliceAndDownload() {
    if (!naturalImg) return;

    downloadBtn.disabled = true;

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
    }
  }

  photoBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => openFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach(evt =>
    frame.addEventListener(evt, e => e.preventDefault())
  );
  frame.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    openFile(file);
  });

  sliceTabs.forEach(tab =>
    tab.addEventListener('click', () => setSliceCount(Number(tab.dataset.count)))
  );

  downloadBtn.addEventListener('click', sliceAndDownload);

  renderCarousel();
})();
