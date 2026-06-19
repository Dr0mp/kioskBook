// pdf-import.js — dev-mode PDF → page-NN.jpg converter (offline, via pdf.js)
// Renders a chosen page range of a PDF and writes page-NN.jpg files straight
// into a folder the user picks (File System Access API — Chrome/Edge).
(function () {
  'use strict';

  var pdfDoc = null;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function setProgress(msg) { var el = $('pdf-progress'); if (el) el.textContent = msg; }

  // pdf.js worker (local file — no CDN)
  if (window.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  }

  async function loadPdf(file) {
    setProgress('Loading PDF…');
    try {
      var buf = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
      var n = pdfDoc.numPages;
      $('pdf-info').textContent = file.name + ' — ' + n + ' pages';
      $('pdf-start').value = 1;   $('pdf-start').max = n;
      setProgress(' ');
    } catch (e) {
      pdfDoc = null;
      $('pdf-info').textContent = 'Failed to read PDF';
      setProgress('Error: ' + (e && e.message ? e.message : e));
    }
  }

  async function renderPageToBlob(num, scale, quality) {
    var page = await pdfDoc.getPage(num);
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';                       // PDFs can be transparent → white bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return await new Promise(function (res) { canvas.toBlob(res, 'image/jpeg', quality); });
  }

  async function convert() {
    if (!pdfDoc) { setProgress('Load a PDF first.'); return; }
    if (!window.showDirectoryPicker) {
      setProgress('This browser can’t save to a folder — use Chrome or Edge.');
      return;
    }

    var total   = pdfDoc.numPages;
    var start   = Math.max(1, Math.min(total, parseInt($('pdf-start').value, 10) || 1));
    var end     = total;   // always convert through the last page
    var outNum  = Math.max(1, parseInt($('pdf-outstart').value, 10) || 1);
    var scale   = Math.max(0.5, parseFloat($('pdf-scale').value)   || 1.5);
    var quality = Math.min(1, Math.max(0.3, parseFloat($('pdf-quality').value) || 0.85));

    var dir;
    try {
      dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) { return; }   // user cancelled the folder picker

    var firstOut = outNum;
    try {
      for (var p = start; p <= end; p++) {
        setProgress('Rendering page ' + p + ' / ' + end + ' → page-' + pad(outNum) + '.jpg');
        var blob = await renderPageToBlob(p, scale, quality);
        var handle = await dir.getFileHandle('page-' + pad(outNum) + '.jpg', { create: true });
        var w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        outNum++;
      }
      setProgress('Done — wrote ' + (end - start + 1) + ' pages (page-' +
                  pad(firstOut) + ' … page-' + pad(outNum - 1) + ').');
    } catch (e) {
      setProgress('Stopped: ' + (e && e.message ? e.message : e));
    }
  }

  function init() {
    var file = $('pdf-file');
    if (!file) return;                                 // dev panel not present
    if (!window.pdfjsLib) { setProgress('pdf.js not loaded.'); return; }
    file.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) loadPdf(e.target.files[0]);
    });
    $('pdf-convert').addEventListener('click', convert);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
