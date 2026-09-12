(() => {
  const frame = document.querySelector('.frame');
  const photoBtn = document.getElementById('photoBtn');
  const fileInput = document.getElementById('fileInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const carousel = document.getElementById('carousel');
  const sliceTabs = Array.from(document.querySelectorAll('.slice-tab'));
  const idxBadge = document.getElementById('idxBadge');

  let sliceCount = 3;
  let objectUrl = null;
  let naturalImg = null; // full-resolution Image for canvas work

  // A tap inside a horizontally-scrollable, scroll-snapping carousel can get
  // its click event silently suppressed by the browser once it decides the
  // touch is a swipe rather than a tap. Track the touch ourselves so a clean
  // tap (little movement) still toggles, regardless of that ambiguity.
  function attachTap(el, handler) {
    let startX = 0, startY = 0, moved = false;
    el.addEventListener('touchstart', e => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) moved = true;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!moved) {
        e.preventDefault(); // stop the trailing synthetic click from double-firing
        handler();
      }
    });
    el.addEventListener('click', handler);
  }

  function setImage(img, url) {
    if (objectUrl) URL.revokeObjectURL(objectUrl); // no-op if not a blob: URL
    naturalImg = img;
    objectUrl = url;
    renderCarousel();
  }

  function openFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img, url);
    img.src = url;
  }

  function renderCarousel() {
    carousel.innerHTML = '';
    if (!naturalImg) return;

    const aspect = `${naturalImg.naturalWidth / sliceCount} / ${naturalImg.naturalHeight}`;

    for (let i = 0; i < sliceCount; i++) {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.style.position = 'relative';
      slide.style.aspectRatio = aspect;
      slide.style.backgroundImage = `url(${objectUrl})`;
      slide.style.backgroundSize = `${sliceCount * 100}% auto`;
      slide.style.backgroundPosition = `${(i / (sliceCount - 1)) * 100}% center`;

      if (i === 0) {
        const label = document.createElement('span');
        label.className = 'slide-placeholder-label';
        label.textContent = `1/${sliceCount}`;
        label.style.left = '0';
        label.style.top = '0';
        slide.appendChild(label);
      }

      const slideDownload = document.createElement('button');
      slideDownload.type = 'button';
      slideDownload.className = 'slide-download';
      slideDownload.setAttribute('aria-label', `Download slice ${i + 1}`);
      slideDownload.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v12M12 16l5-5M12 16l-5-5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>';
      slideDownload.addEventListener('click', e => {
        e.stopPropagation();
        downloadSlice(i);
      });
      slide.appendChild(slideDownload);

      attachTap(slide, () => {
        const wasRevealed = slide.classList.contains('is-revealed');
        carousel.querySelectorAll('.slide.is-revealed').forEach(s => s.classList.remove('is-revealed'));
        if (!wasRevealed) slide.classList.add('is-revealed');
      });

      carousel.appendChild(slide);
    }

    carousel.scrollLeft = 0;
  }

  function sliceBounds() {
    const w = naturalImg.naturalWidth;
    const bounds = [0];
    for (let i = 1; i < sliceCount; i++) bounds.push(Math.round((w / sliceCount) * i));
    bounds.push(w);
    return bounds;
  }

  function renderSliceToBlob(left, right) {
    const h = naturalImg.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = right - left;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(naturalImg, left, 0, right - left, h, 0, 0, right - left, h);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function downloadSlice(i) {
    if (!naturalImg) return;

    const bounds = sliceBounds();
    const blob = await renderSliceToBlob(bounds[i], bounds[i + 1]);
    triggerDownload(blob, `slicey-slice-${i + 1}.png`);

    window.goatcounter?.count({
      path: 'slice-download-single',
      title: `Downloaded slice ${i + 1}/${sliceCount}`,
      event: true,
    });
  }

  function setSliceCount(n) {
    sliceCount = n;
    idxBadge.textContent = String(n).padStart(2, '0');
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
      const bounds = sliceBounds();

      for (let i = 0; i < sliceCount; i++) {
        const blob = await renderSliceToBlob(bounds[i], bounds[i + 1]);
        triggerDownload(blob, `slicey-slice-${i + 1}.png`);
        if (i < sliceCount - 1) await wait(150); // stagger so browsers don't block rapid-fire downloads
      }

      window.goatcounter?.count({
        path: 'slice-download',
        title: `Sliced into ${sliceCount}`,
        event: true,
      });
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

  // ships with a default image so the download stamp works immediately --
  // swap default-ad.jpg for your own file (same name) to replace it.
  const defaultImg = new Image();
  defaultImg.onload = () => setImage(defaultImg, 'default-ad.jpg');
  defaultImg.src = 'default-ad.jpg';
})();
