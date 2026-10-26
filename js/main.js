(function () {

  // -------- viewport height fix (mobile browser chrome) --------
  function setVH(){ document.documentElement.style.setProperty('--vh', (window.innerHeight*0.01)+'px'); }
  setVH();
  window.addEventListener('resize', setVH);

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ================= OPENING VIDEO =================
  var opening = document.getElementById('opening');
  var video = document.getElementById('opening-video');
  var tapBtn = document.getElementById('opening-tap');
  var enterPrompt = document.getElementById('enter-prompt');
  var site = document.getElementById('site');
  var revealed = false;

  function revealSite(){
    if(revealed) return;
    revealed = true;
    opening.classList.add('fading');
    site.classList.add('revealed');
    startCountdown();
    if(!reduceMotion){ spawnButterflies(); spawnBokeh(); }
    var bgAudio = document.getElementById('bgAudio');
    if(bgAudio && bgAudio.paused){
      bgAudio.play().catch(function(err){ console.log('Audio play error:', err); });
    }
    setTimeout(function(){
      opening.classList.add('hide');
    }, 1650);
  }

  // ---- Background video pre-download ----
  // Fetch the video as a Blob so it is fully in memory before playback.
  // This eliminates streaming/buffering lag when the user taps "Enter".
  video.loop = false;
  var videoStarted = false;
  var videoBlobReady = false;   // true once blob URL is assigned
  var tapPending    = false;    // true if user tapped before blob was ready

  // SVG ring progress injected into the tap button
  var TAP_BTN_LABEL = tapBtn ? tapBtn.textContent : 'Tap to Enter';
  var RING_SIZE = 36; // px – diameter of the progress ring drawn behind the button
  function setTapProgress(pct) {
    if (!tapBtn) return;
    var ring = document.getElementById('_vidRing');
    if (!ring) {
      // Build a tiny circular progress overlay the first time
      ring = document.createElement('span');
      ring.id = '_vidRing';
      ring.setAttribute('aria-hidden', 'true');
      ring.style.cssText = [
        'position:absolute','inset:0','display:flex',
        'align-items:center','justify-content:center',
        'pointer-events:none','border-radius:inherit'
      ].join(';');
      var r = (RING_SIZE / 2) - 3;
      var circ = 2 * Math.PI * r;
      ring.innerHTML = '<svg width="' + RING_SIZE + '" height="' + RING_SIZE + '" viewBox="0 0 ' + RING_SIZE + ' ' + RING_SIZE + '" style="position:absolute;inset:0;margin:auto;overflow:visible;">' +
        '<circle cx="' + (RING_SIZE/2) + '" cy="' + (RING_SIZE/2) + '" r="' + r + '" fill="none" stroke="rgba(207,177,118,0.25)" stroke-width="2"/>' +
        '<circle id="_vidRingArc" cx="' + (RING_SIZE/2) + '" cy="' + (RING_SIZE/2) + '" r="' + r + '" fill="none" stroke="#cfb176" stroke-width="2.5" stroke-linecap="round"' +
        ' stroke-dasharray="' + circ + '" stroke-dashoffset="' + circ + '" transform="rotate(-90 ' + (RING_SIZE/2) + ' ' + (RING_SIZE/2) + ')" style="transition:stroke-dashoffset .3s ease"/>' +
        '</svg>';
      // Ensure the button is a positioning context
      tapBtn.style.position = 'relative';
      tapBtn.appendChild(ring);
    }
    var arc = document.getElementById('_vidRingArc');
    if (arc) {
      var r2 = (RING_SIZE / 2) - 3;
      var circ2 = 2 * Math.PI * r2;
      arc.style.strokeDashoffset = circ2 * (1 - pct / 100);
    }
    if (pct >= 100) {
      // Remove ring and restore label once download is done
      setTimeout(function() {
        if (ring && ring.parentNode) ring.parentNode.removeChild(ring);
        if (tapBtn) tapBtn.textContent = TAP_BTN_LABEL;
      }, 350);
    }
  }

  function startVideoFetch() {
    var videoSrc = 'assets/walk5.mp4';
    if (!window.fetch || !window.URL || !window.URL.createObjectURL) {
      // Browser doesn't support fetch/Blob – mark ready and fall through to native streaming
      videoBlobReady = true;
      if (tapPending) { tapPending = false; playOpeningVideo(); }
      return;
    }

    fetch(videoSrc)
      .then(function(res) {
        if (!res.ok) throw new Error('Network response not ok');
        var contentLength = res.headers.get('Content-Length');
        var total = contentLength ? parseInt(contentLength, 10) : 0;
        var loaded = 0;
        var reader = res.body ? res.body.getReader() : null;

        if (!reader) {
          // No streaming reader – fall back to blob() directly
          return res.blob();
        }

        // Stream the response and track progress
        return new Promise(function(resolve, reject) {
          var chunks = [];
          function pump() {
            reader.read().then(function(result) {
              if (result.done) {
                resolve(new Blob(chunks, { type: 'video/mp4' }));
                return;
              }
              chunks.push(result.value);
              loaded += result.value.byteLength;
              if (total > 0) {
                setTapProgress(Math.min(99, Math.round(loaded / total * 100)));
              }
              pump();
            }).catch(reject);
          }
          pump();
        });
      })
      .then(function(blob) {
        var blobUrl = URL.createObjectURL(blob);
        // Replace the video source with the fully-downloaded blob URL
        video.src = blobUrl;
        video.load();
        videoBlobReady = true;
        setTapProgress(100);
        if (tapPending) { tapPending = false; playOpeningVideo(); }
      })
      .catch(function(err) {
        console.warn('Video pre-fetch failed, falling back to streaming:', err);
        // Leave the original src in place; native streaming will be used
        videoBlobReady = true;
        setTapProgress(100);
        if (tapPending) { tapPending = false; playOpeningVideo(); }
      });
  }

  // Kick off the background download immediately on page load
  startVideoFetch();

  function playOpeningVideo(){
    if(videoStarted) return;
    videoStarted = true;
    if(tapBtn){ tapBtn.disabled = true; }
    opening.classList.add('playing');

    // Start the background music when video starts
    var bgAudio = document.getElementById('bgAudio');
    if(bgAudio){
      bgAudio.play().catch(function(err){
        console.log('Audio autoplay blocked:', err);
      });
    }

    var revealAfterVideo = function(){ revealSite(); };
    video.addEventListener('ended', revealAfterVideo, { once:true });
    // Fallback in case 'ended' never fires (autoplay block, decode issue, etc.)
    var fallbackMs = (video.duration && !isNaN(video.duration)) ? Math.round((video.duration + 2.5) * 1000) : 12000;
    setTimeout(revealAfterVideo, fallbackMs);

    var p = video.play();
    if(p && p.catch){ p.catch(function(){ revealAfterVideo(); }); }
  }

  if(tapBtn){
    tapBtn.addEventListener('click', function(){
      if (!videoBlobReady) {
        // Still downloading – queue the play for when it's ready
        tapPending = true;
        if (tapBtn) {
          tapBtn.disabled = true;
          tapBtn.textContent = 'Loading...';
        }
      } else {
        playOpeningVideo();
      }
    });
  }

  // safety: if video errors, still let user in
  video.addEventListener('error', function(){
    videoBlobReady = true; // unblock tap
    if(enterPrompt) enterPrompt.classList.add('show');
  });

  // opening screen's own music icon just mirrors the main music toggle
  var openingMusicBtn = document.getElementById('openingMusicBtn');
  if(openingMusicBtn){
    openingMusicBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var mainMusicBtn = document.getElementById('musicToggle');
      if(mainMusicBtn){
        mainMusicBtn.click();
      }
    });
    
    // Sync visual state with main audio
    var syncOpeningBtn = function(){
      var mainAudio = document.getElementById('bgAudio');
      if(mainAudio && !mainAudio.paused){
        openingMusicBtn.classList.remove('is-muted');
      } else {
        openingMusicBtn.classList.add('is-muted');
      }
    };
    var mainAudio = document.getElementById('bgAudio');
    if(mainAudio){
      mainAudio.addEventListener('play', syncOpeningBtn);
      mainAudio.addEventListener('pause', syncOpeningBtn);
    }
  }

  // ================= SCROLL REVEAL =================
  var cards = document.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in-view'); }
      });
    }, { threshold:0.28 });
    cards.forEach(function(c){ io.observe(c); });
  } else {
    cards.forEach(function(c){ c.classList.add('in-view'); });
  }

  // ================= COUNTDOWN =================
  var target = new Date('2026-12-06T11:00:00+05:30').getTime();
  var cdDays = document.getElementById('cd-days');
  var cdHours = document.getElementById('cd-hours');
  var cdMins = document.getElementById('cd-mins');
  var cdSecs = document.getElementById('cd-secs');
  var cdInterval = null;

  function pad(n){ return String(n).padStart(2,'0'); }

  function tickCountdown(){
    var now = Date.now();
    var diff = target - now;
    if(diff <= 0){
      cdDays.textContent = '00'; cdHours.textContent='00'; cdMins.textContent='00'; cdSecs.textContent='00';
      clearInterval(cdInterval);
      return;
    }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    cdDays.textContent = pad(d);
    cdHours.textContent = pad(h);
    cdMins.textContent = pad(m);
    cdSecs.textContent = pad(s);
  }

  function startCountdown(){
    tickCountdown();
    cdInterval = setInterval(tickCountdown, 1000);
  }

  // ================= BUTTERFLIES =================
  var butterflyImgs = [
    'assets/butterfly-gold-white.png',
    'assets/butterfly-gold-white.png',
    'assets/butterfly-gold-white.png',
    'assets/butterfly-pink-gold.png'
  ];
  var paths = ['flyA','flyB','flyC','flyD'];
  var layer = document.getElementById('butterflyLayer');

  function rand(min,max){ return Math.random()*(max-min)+min; }

  function makeButterfly(delayBase){
    var el = document.createElement('div');
    el.className = 'butterfly';
    var img = document.createElement('img');
    img.src = butterflyImgs[Math.floor(rand(0,butterflyImgs.length))];
    img.alt = '';
    el.appendChild(img);

    var size = rand(34,64);
    var startX = rand(-4, 92);
    var startY = rand(6, 88);
    var dur = rand(16,26);
    var flap = rand(0.5,0.9);
    var path = paths[Math.floor(rand(0,paths.length))];
    var delay = (delayBase===undefined ? rand(0,20) : delayBase);

    el.style.setProperty('--size', size+'px');
    el.style.setProperty('--start-x', startX+'vw');
    el.style.setProperty('--start-y', startY+'vh');
    el.style.setProperty('--dur', dur+'s');
    el.style.setProperty('--flap', flap+'s');
    el.style.setProperty('--path', path);
    el.style.setProperty('--delay', delay+'s');

    layer.appendChild(el);
  }

  function spawnButterflies(){
    var count = window.innerWidth < 700 ? 8 : 12;
    for(var i=0;i<count;i++){ makeButterfly(); }
  }

  // ================= BOKEH PARTICLES =================
  var bokehLayer = document.getElementById('bokehLayer');
  function spawnBokeh(){
    var count = window.innerWidth < 700 ? 10 : 16;
    for(var i=0;i<count;i++){
      var b = document.createElement('div');
      b.className = 'bokeh';
      var size = rand(6,16);
      b.style.width = size+'px';
      b.style.height = size+'px';
      b.style.left = rand(2,98)+'vw';
      b.style.bottom = rand(-20,-2)+'vh';
      b.style.animationDuration = rand(14,26)+'s';
      b.style.animationDelay = rand(0,20)+'s';
      bokehLayer.appendChild(b);
    }
  }



  // ================= RSVP FORM =================
  var attendBtns = document.querySelectorAll('.attend-btn');
  var attendValue = '';
  attendBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      attendBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      attendValue = btn.getAttribute('data-value');
    });
  });

  var guestCountEl = document.getElementById('guestCount');
  var guestMinus = document.getElementById('guestMinus');
  var guestPlus = document.getElementById('guestPlus');
  var guestCount = 1;
  if(guestMinus && guestPlus && guestCountEl){
    guestMinus.addEventListener('click', function(){
      if(guestCount > 1){ guestCount--; guestCountEl.textContent = guestCount; }
    });
    guestPlus.addEventListener('click', function(){
      if(guestCount < 10){ guestCount++; guestCountEl.textContent = guestCount; }
    });
  }

  var RSVP_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxw7PgyXESDE6p_KOUsiMv6O7uqRahvwxTd58-3ATSAi7D9QDHhk2hNdfPLAECMefX5/exec';

  var rsvpForm = document.getElementById('rsvpForm');
  var rsvpFeedback = document.getElementById('rsvpFeedback');
  if(rsvpForm){
    rsvpForm.addEventListener('submit', function(e){
      e.preventDefault();
      var name = document.getElementById('rsvpName').value.trim();
      var country = document.getElementById('rsvpCountry').value;
      var phone = document.getElementById('rsvpPhone').value.trim();

      if(!name || !phone){
        alert('Please fill in your name and WhatsApp number.');
        return;
      }
      if(!attendValue){
        alert('Please let us know if you will be attending.');
        return;
      }

      var attendText = attendValue === 'accept' ? 'Joyfully Accept' : 'Regretfully Decline';
      var submitBtn = rsvpForm.querySelector('.btn-rsvp');
      var originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Send RSVP';

      if(submitBtn){
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending RSVP...';
      }
      if(rsvpFeedback){
        rsvpFeedback.style.display = 'none';
        rsvpFeedback.textContent = '';
      }

      var params = new URLSearchParams();
      params.append('name', name);
      params.append('phone', country + ' ' + phone);
      params.append('attending', attendText);
      params.append('guests', guestCount);

      fetch(RSVP_APP_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString()
      }).then(function(){
        if(submitBtn){
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        if(rsvpFeedback){
          rsvpFeedback.style.display = 'block';
          rsvpFeedback.style.color = 'var(--gold-light)';
          rsvpFeedback.textContent = 'âœ¨ Thank you! Your RSVP has been received.';
        }
        rsvpForm.reset();
        attendBtns.forEach(function(b){ b.classList.remove('active'); });
        attendValue = '';
        guestCount = 1;
        if(guestCountEl){ guestCountEl.textContent = '1'; }
      }).catch(function(err){
        console.error('Error submitting RSVP:', err);
        if(submitBtn){
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        if(rsvpFeedback){
          rsvpFeedback.style.display = 'block';
          rsvpFeedback.style.color = '#ff9999';
          rsvpFeedback.textContent = 'There was an issue sending your RSVP. Please try again.';
        }
      });
    });
  }

  // ================= ADD TO CALENDAR =================
  var addToCalendarBtn = document.getElementById('addToCalendarBtn');
  if(addToCalendarBtn){
    addToCalendarBtn.addEventListener('click', function(){
      var start = '20261206T110000';
      var end = '20261206T140000';
      var ics = [
        'BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',
        'SUMMARY:Afridi & Sahala — Nikkah Ceremony',
        'DTSTART;TZID=Asia/Kolkata:' + start,
        'DTEND;TZID=Asia/Kolkata:' + end,
        'LOCATION:https://share.google/1opghPwIJbe56JB4E',
        'DESCRIPTION:Nikkah Ceremony of Afridi Muhammed Zahid & Sahala Mumthaz',
        'END:VEVENT','END:VCALENDAR'
      ].join('\r\n');
      var blob = new Blob([ics], { type: 'text/calendar' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'afridi-sahala-nikkah.ics';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // ================= MUSIC TOGGLE =================
  var musicBtn = document.getElementById('musicToggle');
  var audio = document.getElementById('bgAudio');
  var playing = false;
  
  // Ensure audio is loaded
  audio.load();
  
  // Update playing state when audio actually starts/stops
  audio.addEventListener('play', function(){ 
    playing = true; 
    musicBtn.classList.remove('muted'); 
    musicBtn.setAttribute('aria-pressed', 'true');
  });
  audio.addEventListener('pause', function(){ 
    playing = false; 
    musicBtn.classList.add('muted'); 
    musicBtn.setAttribute('aria-pressed', 'false');
  });
  
  musicBtn.addEventListener('click', function(){
    if(playing){ 
      audio.pause(); 
    } else { 
      var playPromise = audio.play();
      if(playPromise !== undefined){
        playPromise.catch(function(err){
          console.error('Audio play failed:', err);
          alert('Unable to play music. Please check your browser settings or try again.');
        }); 
      }
    }
  });

  // ================= SCROLL DOWN BUTTON =================
  var scrollDownBtn = document.getElementById('scrollDownBtn');
  if(scrollDownBtn){
    scrollDownBtn.addEventListener('click', function(){
      var target = document.getElementById('verse') || document.getElementById('countdown');
      if(target){
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ================= PDF DOWNLOAD MODAL =================
  var openPdfModalBtn = document.getElementById('openPdfModalBtn');
  var closePdfModalBtn = document.getElementById('closePdfModalBtn');
  var pdfModal = document.getElementById('pdfModal');
  var printInviteBtn = document.getElementById('printInviteBtn');
  var directPdfLink = document.getElementById('directPdfLink');

  function openPdfModal(){
    if(pdfModal){
      pdfModal.classList.add('open');
      pdfModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closePdfModal(){
    if(pdfModal){
      pdfModal.classList.remove('open');
      pdfModal.setAttribute('aria-hidden', 'true');
    }
  }

  if(openPdfModalBtn){ openPdfModalBtn.addEventListener('click', openPdfModal); }
  if(closePdfModalBtn){ closePdfModalBtn.addEventListener('click', closePdfModal); }
  if(pdfModal){
    pdfModal.addEventListener('click', function(e){
      if(e.target === pdfModal){ closePdfModal(); }
    });
  }
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && pdfModal && pdfModal.classList.contains('open')){
      closePdfModal();
    }
  });

  function openInvitationPrintWindow(){
    var printWin = window.open('', '_blank', 'width=800,height=1000,scrollbars=yes');
    if(!printWin){
      alert('Please allow popups for this site to download the PDF.');
      return;
    }

    var html = [
      '<!DOCTYPE html><html lang="en"><head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
      '<title>Afridi &amp; Sahala - Wedding Invitation</title>',
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Cinzel:wght@400;500;600&family=Amiri:ital,wght@0,400;0,700;1,400&family=EB+Garamond:ital@1&display=swap" rel="stylesheet">',
      '<style>',
      '*{margin:0;padding:0;box-sizing:border-box;}',
      'html,body{width:210mm;height:297mm;background:linear-gradient(145deg,#092c20,#041912);font-family:"Cormorant Garamond",Georgia,serif;}',
      'body{display:flex;align-items:center;justify-content:center;}',
      '.page{width:210mm;height:297mm;background:linear-gradient(145deg,#092c20,#041912);display:flex;align-items:center;justify-content:center;padding:12mm;}',
      '.inv-card{width:100%;height:100%;background:linear-gradient(145deg,#092c20,#041912);border:2.5pt solid #cfb176;border-radius:8pt;display:flex;align-items:center;justify-content:center;color:#fdfaf5;text-align:center;box-shadow:0 8pt 24pt rgba(0,0,0,0.5);}',
      '.inv-inner{width:100%;height:100%;border:1pt solid rgba(207,177,118,0.5);border-radius:6pt;padding:10mm 12mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;}',
      '.bismi-ar{font-family:"Amiri",serif;font-size:22pt;color:#f7ecda;direction:rtl;margin-bottom:2pt;}',
      '.bismi-en{font-family:"Cinzel",serif;font-size:6pt;letter-spacing:1.5pt;text-transform:uppercase;color:#cfb176;margin-bottom:6pt;}',
      '.divider{display:flex;align-items:center;justify-content:center;gap:6pt;width:120pt;margin:4pt auto;}',
      '.divider .dl{flex:1;height:0.5pt;background:linear-gradient(90deg,transparent,#cfb176 50%,transparent);}',
      '.divider .dd{width:4pt;height:4pt;background:#cfb176;transform:rotate(45deg);flex-shrink:0;}',
      '.eyebrow{font-family:"Cinzel",serif;font-size:6.5pt;letter-spacing:2pt;text-transform:uppercase;color:#d8c6a3;display:block;margin:3pt 0 2pt;}',
      '.cname{font-family:"Cormorant Garamond",serif;font-size:24pt;font-weight:600;color:#efdcae;line-height:1.1;margin:1pt 0;}',
      '.camp{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:16pt;color:#cfb176;margin:0;display:block;}',
      '.tagline{font-size:9pt;font-style:italic;color:#fdfaf5;margin:3pt 0;}',
      '.family-box{width:100%;display:flex;flex-direction:column;gap:0;font-size:8pt;line-height:1.6;margin:4pt 0;}',
      '.family-role{font-family:"Cinzel",serif;font-size:5.5pt;letter-spacing:1.5pt;text-transform:uppercase;color:#cfb176;margin:0 0 1.5pt;}',
      '.parent-names{font-family:"Cormorant Garamond",serif;font-size:10.5pt;color:#fdfaf5;font-weight:600;margin:0 0 1pt;}',
      '.family-sub{font-size:7.5pt;color:#cfc5b4;margin:0.5pt 0;}',
      '.address{font-size:7pt;font-style:italic;color:#b8a892;margin:1.5pt 0 0;}',
      '.sep{height:0.5pt;background:rgba(207,177,118,0.3);margin:6pt 0;width:100%;}',
      '.date-box{background:rgba(207,177,118,0.12);border:0.75pt solid rgba(207,177,118,0.45);border-radius:5pt;padding:6pt 12pt;width:100%;}',
      '.date-main{font-family:"Cinzel",serif;font-size:11pt;letter-spacing:1.5pt;color:#efdcae;font-weight:600;margin:0 0 2pt;text-transform:uppercase;}',
      '.time-main{font-family:"Cinzel",serif;font-size:7pt;letter-spacing:1pt;color:#cfb176;margin:0;}',
      '.quran-ar{font-family:"Amiri",serif;font-size:10pt;color:#efdcae;direction:rtl;line-height:1.9;margin:3pt 0 1pt;}',
      '.quran-en{font-family:"EB Garamond",serif;font-style:italic;font-size:7.5pt;color:#cfc5b4;margin:0 0 4pt;}',
      '.dua-ar{font-family:"Amiri",serif;font-size:11pt;color:#efdcae;direction:rtl;line-height:1.7;margin:2pt 0 1pt;}',
      '.closing{font-family:"Cinzel",serif;font-size:5.5pt;letter-spacing:1.5pt;text-transform:uppercase;color:#cfb176;margin:2pt 0 0;}',
      '@media print{',
      '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
      '@page{margin:0;size:A4 portrait;}',
      'html,body{width:210mm;height:297mm;}',
      '.page{width:210mm;height:297mm;padding:10mm;}',
      '.inv-card{border:2pt solid #cfb176!important;background:linear-gradient(145deg,#092c20,#041912)!important;box-shadow:none!important;}',
      '}',
      '</style></head><body>',
      '<div class="page">',
      '<div class="inv-card"><div class="inv-inner">',

      '<div>',
      '<p class="bismi-ar">&#x628;&#x650;&#x633;&#x652;&#x645;&#x650; &#x627;&#x644;&#x644;&#x647;&#x650; &#x627;&#x644;&#x631;&#x64E;&#x651;&#x62D;&#x652;&#x645;&#x670;&#x646;&#x650; &#x627;&#x644;&#x631;&#x64E;&#x651;&#x62D;&#x650;&#x64A;&#x652;&#x645;&#x650;</p>',
      '<p class="bismi-en">In the name of Allah, the Most Beneficent and the Most Merciful</p>',
      '</div>',

      '<div class="divider"><span class="dl"></span><span class="dd"></span><span class="dl"></span></div>',

      '<div>',
      '<span class="eyebrow">The Nikkah Ceremony of</span>',
      '<p class="cname">Afridi Muhammed Zahid</p>',
      '<span class="camp">&amp;</span>',
      '<p class="cname">Sahala Mumthaz</p>',
      '</div>',

      '<div class="divider"><span class="dl"></span><span class="dd"></span><span class="dl"></span></div>',

      '<p class="tagline">A Celebration of Love, Family, and New Beginnings</p>',

      '<div class="family-box">',
      '<div>',
      '<p class="family-role">Groom</p>',
      '<p class="parent-names">Mr. Abdul Shukkur &amp; Khadeeja MK</p>',
      '<p class="family-sub">S/O Late Abdurehiman &nbsp;|&nbsp; Rtd. Forest Range Officer (Rose, Kuthuparamba)</p>',
      '<p class="family-sub">D/O Mr. A.P Khalid Haji (KK House, Kadachira)</p>',
      '<p class="address">&ldquo;KEF&rdquo; Near Siddique Juma Masjid, Poduvachery, Kannur</p>',
      '</div>',
      '<div class="sep"></div>',
      '<div>',
      '<p class="family-role">Bride</p>',
      '<p class="parent-names">Mr. Rafeeque Puthiya veetil &amp; Mrs. Thahira Rafeeque</p>',
      '<p class="family-sub">S/O Late Mr. Mammad Haji</p>',
      '<p class="family-sub">D/O Late Mr. Kunjimaayan Haji</p>',
      '<p class="address">Sal Sabeel, Paral, Kuthuparamba</p>',
      '</div>',
      '</div>',

      '<div class="date-box">',
      '<p class="date-main">Sunday, 6 December 2026</p>',
      '<p class="time-main">11:00 AM &middot; Nikkah Ceremony</p>',
      '</div>',

      '<div>',
      '<p class="quran-ar" dir="rtl">&#x648;&#x64E;&#x645;&#x650;&#x646;&#x652; &#x622;&#x64A;&#x627;&#x62A;&#x650;&#x647;&#x650; &#x623;&#x646;&#x652; &#x62E;&#x644;&#x64E;&#x642;&#x64E; &#x644;&#x64E;&#x643;&#x64F;&#x645; &#x645;&#x650;&#x651;&#x646;&#x652; &#x623;&#x646;&#x64F;&#x641;&#x64F;&#x633;&#x650;&#x643;&#x64F;&#x645;&#x652; &#x623;&#x632;&#x648;&#x627;&#x62C;&#x64B;&#x627; &#x644;&#x650;&#x651;&#x62A;&#x64E;&#x633;&#x652;&#x643;&#x64F;&#x646;&#x64F;&#x648;&#x627; &#x625;&#x650;&#x644;&#x64E;&#x64A;&#x652;&#x647;&#x627; &#x648;&#x64E;&#x62C;&#x64E;&#x639;&#x64E;&#x644;&#x64E; &#x628;&#x64E;&#x64A;&#x652;&#x646;&#x64E;&#x643;&#x64F;&#x645; &#x645;&#x64E;&#x651;&#x648;&#x64E;&#x62F;&#x64E;&#x651;&#x629;&#x64B; &#x648;&#x64E;&#x631;&#x64E;&#x62D;&#x652;&#x645;&#x64E;&#x629;&#x64B;</p>',
      '<p class="quran-en">&ldquo;And He placed between you love and mercy&rdquo; &middot; Surah Ar-Rum 30:21</p>',
      '</div>',

      '<div>',
      '<p class="dua-ar" dir="rtl">&#x627;&#x644;&#x644;&#x64E;&#x651;&#x647;&#x64F;&#x645;&#x64E;&#x651; &#x623;&#x64E;&#x644;&#x650;&#x651;&#x641;&#x652; &#x628;&#x64E;&#x64A;&#x652;&#x646;&#x64E; &#x642;&#x64F;&#x644;&#x64F;&#x648;&#x628;&#x650;&#x646;&#x64E;&#x627; &#x648;&#x64E;&#x623;&#x64E;&#x635;&#x652;&#x644;&#x650;&#x62D;&#x652; &#x630;&#x64E;&#x627;&#x62A;&#x64E; &#x628;&#x64E;&#x64A;&#x652;&#x646;&#x650;&#x646;&#x64E;&#x627;</p>',
      '<p class="closing">With love, from our families to yours</p>',
      '</div>',

      '</div></div>',
      '</div>',
      '<script>',
      'document.fonts.ready.then(function(){',
      '  setTimeout(function(){ window.print(); }, 1000);',
      '});',
      '<\/script>',
      '</body></html>'
    ].join('');

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }

  function downloadPdfAction(){
    openInvitationPrintWindow();
  }

  if(directPdfLink){ directPdfLink.addEventListener('click', downloadPdfAction); }

  if(printInviteBtn){
    printInviteBtn.addEventListener('click', function(){
      window.print();
    });
  }

})();
