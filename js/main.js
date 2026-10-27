(function () {
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

  // ---- Video: native browser streaming (no blob pre-fetch) ----
  // The old approach fetched the entire video as a Blob before allowing tap,
  // causing a long wait on slow/mobile connections. Native streaming starts
  // playback as soon as enough data is buffered — far faster in practice.
  video.loop = false;
  var videoStarted = false;

  function playOpeningVideo(){
    if(videoStarted) return;
    videoStarted = true;
    if(tapBtn){ tapBtn.disabled = true; }
    opening.classList.add('playing');

    var bgAudio = document.getElementById('bgAudio');
    if(bgAudio){
      bgAudio.play().catch(function(err){
        console.log('Audio autoplay blocked:', err);
      });
    }

    var revealAfterVideo = function(){ revealSite(); };
    video.addEventListener('ended', revealAfterVideo, { once:true });
    // Fallback: if ended never fires (decode issue, autoplay block, etc.)
    var fallbackMs = (video.duration && !isNaN(video.duration))
      ? Math.round((video.duration + 2.5) * 1000)
      : 12000;
    setTimeout(revealAfterVideo, fallbackMs);

    var p = video.play();
    if(p && p.catch){ p.catch(function(){ revealAfterVideo(); }); }
  }

  if(tapBtn){
    tapBtn.addEventListener('click', function(){
      playOpeningVideo();
    });
  }

  // If video fails to load at all, still let the user through
  video.addEventListener('error', function(){
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
      // 6 Dec 2026 11:00 AM IST (UTC+5:30) = 05:30 UTC to 08:30 UTC
      var startUTC = '20261206T053000Z';
      var endUTC   = '20261206T083000Z';
      var summary  = 'Afridi & Sahala \u2014 Nikkah Ceremony';
      var location = 'Vajra Convention Centre, Kannur';
      var details  = 'Nikkah Ceremony of Afridi Muhammed Zahid & Sahala Mumthaz\nSunday, 6 December 2026 \u00B7 11:00 AM IST\nVenue: Vajra Convention Centre, Kannur';

      var gcUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
        + '&text=' + encodeURIComponent(summary)
        + '&dates=' + startUTC + '/' + endUTC
        + '&details=' + encodeURIComponent(details)
        + '&location=' + encodeURIComponent(location);

      window.open(gcUrl, '_blank', 'noopener,noreferrer');
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

  // Stop music and video when tab/browser is closed, hidden, or navigated away
  function stopAllMedia(){
    if(audio && !audio.paused){
      audio.pause();
    }
    if(video && !video.paused){
      video.pause();
    }
  }

  // When tab becomes hidden (switch tab, minimize window, lock screen)
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      stopAllMedia();
    }
  });

  // When navigating away, closing tab or closing browser window
  window.addEventListener('pagehide', stopAllMedia);
  window.addEventListener('beforeunload', stopAllMedia);


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

})();

