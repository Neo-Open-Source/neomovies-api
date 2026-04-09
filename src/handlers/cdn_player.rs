use crate::{internal_error, not_found, with_cors};
use crate::services::cdn::{get_player_data, resolve_cdn_id_by_kp};
use vercel_runtime::{Response, ResponseBody};

fn html_response(html: String) -> Response<ResponseBody> {
    Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(ResponseBody::from(html))
        .unwrap()
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
}

fn extract_base(url: &str) -> String {
    if let Some(pos) = url.find("://") {
        let after = &url[pos + 3..];
        if let Some(slash) = after.find('/') {
            return format!("https://{}", &after[..slash]);
        }
    }
    url.to_string()
}

pub async fn handle(cdn_id: u64, season: Option<u32>, episode: Option<u32>) -> Response<ResponseBody> {
    let data = match get_player_data(cdn_id, season, episode).await {
        Ok(d) => d,
        Err(e) if e.contains("not found") || e.contains("no episodes") || e.contains("no video") => {
            return with_cors(not_found("video not found"));
        }
        Err(_) => return with_cors(internal_error()),
    };

    let base = extract_base(&data.initial_m3u8);
    let episodes_json = serde_json::to_string(&data.episodes).unwrap_or_else(|_| "[]".to_string());

    let html = build_html(
        &html_escape(&data.title),
        &data.initial_m3u8,
        &base,
        data.initial_season,
        data.initial_episode,
        &episodes_json,
        data.is_series,
        cdn_id,
    );

    with_cors(html_response(html))
}

pub async fn handle_by_kp(kp_id: u64, season: Option<u32>, episode: Option<u32>) -> Response<ResponseBody> {
    let cdn_id = match resolve_cdn_id_by_kp(kp_id).await {
        Ok(id) => id,
        Err(_) => return with_cors(not_found("video not found")),
    };
    handle(cdn_id, season, episode).await
}

fn build_html(
    title: &str,
    initial_m3u8: &str,
    _base: &str,
    initial_season: u32,
    initial_episode: u32,
    episodes_json: &str,
    is_series: bool,
    cdn_id: u64,
) -> String {
    let bar_html = if is_series {
        format!(
            r#"<div class="sw"><button class="sb" id="sel-season">Сезон {is} <span class="sa">▾</span></button><div class="sd" id="drop-season"></div></div><div class="sw"><button class="sb" id="sel-episode">Серия {ie} <span class="sa">▾</span></button><div class="sd" id="drop-episode"></div></div>"#,
            is = initial_season, ie = initial_episode
        )
    } else { String::new() };

    let m3u8_js = serde_json::to_string(initial_m3u8).unwrap();
    let is_series_js = if is_series { "true" } else { "false" };

    // CSS accent: #1a6fc4 blue, dark bg #111214, menu #1c1c1e
    // Custom settings menu replaces Plyr's broken settings entirely
    let p1 = format!(r###"<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{title}</title>
<link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css"/>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:100%;height:100%;background:#000;overflow:hidden;font-family:-apple-system,system-ui,sans-serif}}
:root{{
  --plyr-color-main:#1a6fc4;
  --plyr-video-background:#000;
  --plyr-range-fill-background:#1a6fc4;
  --plyr-video-controls-background:linear-gradient(transparent,rgba(0,0,0,.75));
  --plyr-control-icon-size:15px;
  --plyr-font-size-base:13px;
  --plyr-tooltip-background:#1c1c1e;
  --plyr-tooltip-color:#e5e5e7;
}}
#pw{{position:relative;width:100%;height:100dvh;height:100vh}}
#pw video{{width:100%;height:100%;object-fit:contain}}
.plyr--video{{width:100%;height:100%}}
.plyr__video-wrapper{{height:100%!important}}
/* Fullscreen on #pw */
#pw:fullscreen,#pw:-webkit-full-screen,#pw:-moz-full-screen{{
  width:100vw;height:100vh;background:#000;
}}
#pw:fullscreen #bar,#pw:-webkit-full-screen #bar{{
  position:absolute;top:0;left:0;right:0;z-index:50;
}}
/* ── top bar ── */
#bar{{position:absolute;top:0;left:0;right:0;display:flex;gap:6px;padding:10px 12px;
  background:linear-gradient(rgba(0,0,0,.6),transparent);z-index:50;
  transition:opacity .3s;}}
.sw{{position:relative}}
.sb{{background:rgba(20,20,22,.85);color:#e5e5e7;border:1px solid rgba(255,255,255,.1);
  border-radius:7px;padding:5px 12px;font-size:12.5px;cursor:pointer;
  display:flex;align-items:center;gap:5px;white-space:nowrap;
  backdrop-filter:blur(8px);transition:background .15s}}
.sb:hover{{background:rgba(26,111,196,.85)}}
.sa{{font-size:9px;opacity:.6}}
.sd{{position:absolute;top:calc(100% + 5px);left:0;background:#1c1c1e;
  border:1px solid #2c2c2e;border-radius:10px;min-width:160px;
  box-shadow:0 8px 24px rgba(0,0,0,.8);display:none;z-index:200;
  max-height:280px;overflow-y:auto;padding:4px 0}}
.sd.open{{display:block}}
.sd::-webkit-scrollbar{{width:3px}}
.sd::-webkit-scrollbar-thumb{{background:#3a3a3c;border-radius:2px}}
.di{{padding:9px 14px;color:#aeaeb2;cursor:pointer;font-size:13px;white-space:nowrap;transition:background .1s,color .1s}}
.di:hover{{background:#2c2c2e;color:#fff}}
.di.active{{color:#1a6fc4;font-weight:600}}
/* ── custom settings menu ── */
#cmenu{{position:absolute;z-index:2147483647;
  background:#1c1c1e;border:1px solid #2c2c2e;border-radius:12px;
  box-shadow:0 8px 32px rgba(0,0,0,.85);min-width:260px;max-width:320px;
  display:none;overflow:hidden}}
#cmenu.open{{display:flex;flex-direction:column}}
.cm-panel{{display:none;flex-direction:column;overflow:hidden}}
.cm-panel.active{{display:flex;flex-direction:column}}
.cm-panel.active>[id$="-list"],.cm-panel.active>[role=menu]{{overflow-y:auto;flex:1;max-height:400px}}
.cm-panel.active>[id$="-list"]::-webkit-scrollbar,.cm-panel.active>[role=menu]::-webkit-scrollbar{{width:4px}}
.cm-panel.active>[id$="-list"]::-webkit-scrollbar-thumb,.cm-panel.active>[role=menu]::-webkit-scrollbar-thumb{{background:#3a3a3c;border-radius:2px}}
/* home panel rows */
.cm-row{{display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;cursor:pointer;transition:background .1s;border:none;
  background:none;width:100%;color:#e5e5e7;font-size:13.5px;text-align:left}}
.cm-row:hover{{background:#2c2c2e}}
.cm-row-label{{color:#e5e5e7}}
.cm-row-value{{color:#8e8e93;display:flex;align-items:center;gap:4px;font-size:13px}}
.cm-row-value svg{{width:10px;height:10px;fill:#8e8e93}}
/* sub panel */
.cm-back{{display:flex;align-items:center;gap:8px;padding:12px 16px;
  cursor:pointer;border:none;background:none;width:100%;color:#e5e5e7;
  font-size:13.5px;font-weight:600;border-bottom:1px solid #2c2c2e}}
.cm-back:hover{{background:#2c2c2e}}
.cm-back svg{{width:14px;height:14px;fill:#8e8e93}}
.cm-item{{display:flex;align-items:center;gap:10px;padding:10px 16px;
  cursor:pointer;border:none;background:none;width:100%;color:#aeaeb2;font-size:13px}}
.cm-item:hover{{background:#2c2c2e;color:#fff}}
.cm-item.active{{color:#e5e5e7}}
.cm-radio{{width:18px;height:18px;border-radius:50%;border:2px solid #3a3a3c;
  flex-shrink:0;display:flex;align-items:center;justify-content:center}}
.cm-item.active .cm-radio{{border-color:#1a6fc4;background:#1a6fc4}}
.cm-item.active .cm-radio::after{{content:'';width:6px;height:6px;border-radius:50%;background:#fff}}
/* ── resume overlay ── */
#resume{{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  background:#1c1c1e;border:1px solid #2c2c2e;border-radius:16px;
  padding:24px 28px;z-index:100;text-align:center;min-width:280px;
  box-shadow:0 16px 48px rgba(0,0,0,.9);display:none}}
#resume.show{{display:block}}
#resume-title{{color:#fff;font-size:16px;font-weight:700;margin-bottom:4px}}
#resume-sub{{color:#8e8e93;font-size:13px;margin-bottom:18px}}
#btn-resume{{display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;padding:12px;background:#1a6fc4;color:#fff;border:none;
  border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;
  margin-bottom:8px;transition:background .15s}}
#btn-resume:hover{{background:#1558a0}}
#btn-restart{{display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;padding:11px;background:transparent;color:#aeaeb2;
  border:1px solid #2c2c2e;border-radius:10px;font-size:13px;cursor:pointer;
  transition:background .15s,color .15s}}
#btn-restart:hover{{background:#2c2c2e;color:#fff}}
/* ── ep nav buttons ── */
.plyr__controls .ep-btn{{display:flex;align-items:center;justify-content:center;
  width:28px;height:28px;padding:0;background:none;border:none;
  color:rgba(255,255,255,.8);cursor:pointer;border-radius:4px;flex-shrink:0}}
.plyr__controls .ep-btn:hover{{color:#fff;background:rgba(255,255,255,.1)}}
.plyr__controls .ep-btn svg{{width:16px;height:16px;fill:currentColor}}
/* hide Plyr's own settings menu popup — we replace it with #cmenu */
.plyr__menu__container{{display:none!important}}
[data-plyr="settings"]{{display:flex!important}}
</style></head><body>
<div id="pw">
  <div id="bar">{bar_html}</div>
  <div id="resume">
    <div id="resume-title"></div>
    <div id="resume-sub"></div>
    <button id="btn-resume">▶ Продолжить просмотр</button>
    <button id="btn-restart">⟫ Начать сначала</button>
  </div>
  <!-- Custom settings menu -->
  <div id="cmenu">
    <div class="cm-panel active" id="cm-home"></div>
    <div class="cm-panel" id="cm-quality">
      <button class="cm-back" id="cm-back-quality"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>Качество</button>
      <div id="cm-quality-list"></div>
    </div>
    <div class="cm-panel" id="cm-audio">
      <button class="cm-back" id="cm-back-audio"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>Озвучка</button>
      <div id="cm-audio-list"></div>
    </div>
    <div class="cm-panel" id="cm-sub">
      <button class="cm-back" id="cm-back-sub"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>Субтитры</button>
      <div id="cm-sub-list"></div>
    </div>
    <div class="cm-panel" id="cm-speed">
      <button class="cm-back" id="cm-back-speed"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>Скорость</button>
      <div id="cm-speed-list"></div>
    </div>
  </div>
  <video id="player" playsinline crossorigin="anonymous"></video>
</div>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"></script>
<script src="https://cdn.plyr.io/3.7.8/plyr.js"></script>
<script>
(function(){{
  const CDN_ID={cdn_id_js},IS_SERIES={is_series_js},EPISODES={episodes_json};
  const INIT_M3U8={initial_m3u8_js};
  const INIT_S={initial_season},INIT_E={initial_episode};
  const LS_KEY='neo_player_'+CDN_ID;
  const video=document.getElementById('player');
  let hls=null,curSeason=INIT_S,curEpisode=INIT_E,curAudio=0,curSub=-1,curQuality=-1,curSpeed=1;
  let saveTimer=null,pendingSeek=null;
"###,
        title = title,
        bar_html = bar_html,
        cdn_id_js = cdn_id,
        is_series_js = is_series_js,
        episodes_json = episodes_json,
        initial_m3u8_js = m3u8_js,
        initial_season = initial_season,
        initial_episode = initial_episode,
    );

    let p2 = r###"
  // ── Plyr (no settings — we handle it ourselves) ──────────────────────────────
  const plyr=new Plyr(video,{
    controls:['play-large','play','progress','current-time','duration','mute','volume','captions','settings','fullscreen'],
    settings:['speed'],
    captions:{active:false,language:'ru',update:true},
    speed:{selected:1,options:[0.5,0.75,1,1.25,1.5,2]},
    i18n:{quality:'Качество',speed:'Скорость',normal:'Обычная'},
    fullscreen:{enabled:true,fallback:true,iosNative:false,container:'#pw'},
  });

  // Intercept Plyr settings button → open our custom menu
  plyr.on('ready',()=>{
    const settingsBtn=document.querySelector('[data-plyr="settings"]');
    if(settingsBtn){
      settingsBtn.addEventListener('click',e=>{
        e.stopPropagation();
        toggleCMenu();
      });
    }
    // Inject prev/next episode buttons
    if(IS_SERIES){
      const controls=document.querySelector('.plyr__controls');
      const playBtn=controls?.querySelector('[data-plyr="play"]');
      if(playBtn){
        const prev=document.createElement('button');
        prev.className='ep-btn';prev.title='Предыдущая серия';
        prev.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>';
        prev.addEventListener('click',e=>{e.stopPropagation();goPrev();});
        const next=document.createElement('button');
        next.className='ep-btn';next.title='Следующая серия';
        next.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z"/></svg>';
        next.addEventListener('click',e=>{e.stopPropagation();goNext();});
        playBtn.after(next);playBtn.after(prev);
      }
    }
    setTimeout(()=>{if(!checkResume())plyr.play();},400);
  });

  // ── Custom settings menu ──────────────────────────────────────────────────────
  const cmenu=document.getElementById('cmenu');
  let cmenuOpen=false;

  function toggleCMenu(){
    cmenuOpen=!cmenuOpen;
    cmenu.classList.toggle('open',cmenuOpen);
    if(cmenuOpen){
      showPanel('cm-home');buildHomePanel();
      // Position above the settings button
      const btn=document.querySelector('[data-plyr="settings"]');
      if(btn){
        const pw=document.getElementById('pw');
        const pwRect=pw.getBoundingClientRect();
        const r=btn.getBoundingClientRect();
        // Reset positioning
        cmenu.style.top='';cmenu.style.bottom='';cmenu.style.right='';cmenu.style.left='';
        cmenu.style.maxHeight='';
        // Force layout to get actual dimensions
        requestAnimationFrame(()=>{
          const mw=cmenu.offsetWidth||260;
          let mh=cmenu.scrollHeight||300;
          // Calculate available space above and below button
          const spaceAbove=r.top-pwRect.top;
          const spaceBelow=pwRect.bottom-r.bottom;
          const padding=16; // padding from edges
          // Determine max height based on available space
          let maxHeight=Math.min(400,pwRect.height-padding*2);
          let showAbove=true;
          // Prefer showing above if there's enough space
          if(spaceAbove>=mh+padding){
            showAbove=true;
            maxHeight=Math.min(maxHeight,spaceAbove-padding);
          }else if(spaceBelow>=mh+padding){
            showAbove=false;
            maxHeight=Math.min(maxHeight,spaceBelow-padding);
          }else{
            // Not enough space either way, use the larger space
            if(spaceAbove>spaceBelow){
              showAbove=true;
              maxHeight=Math.min(maxHeight,spaceAbove-padding);
            }else{
              showAbove=false;
              maxHeight=Math.min(maxHeight,spaceBelow-padding);
            }
          }
          // Apply max height to menu
          cmenu.style.maxHeight=maxHeight+'px';
          // Recalculate height after applying maxHeight
          mh=Math.min(mh,maxHeight);
          // Calculate horizontal position (align right edge with button)
          let right=pwRect.right-r.right;
          if(right+mw>pwRect.width-padding)right=padding;
          // Calculate vertical position
          let top;
          if(showAbove){
            top=r.top-pwRect.top-mh-8;
            if(top<padding)top=padding;
          }else{
            top=r.bottom-pwRect.top+8;
            if(top+mh>pwRect.height-padding)top=pwRect.height-mh-padding;
          }
          cmenu.style.top=top+'px';
          cmenu.style.right=right+'px';
          cmenu.style.bottom='auto';
          cmenu.style.left='auto';
        });
      }
    }
  }
  function closeCMenu(){cmenuOpen=false;cmenu.classList.remove('open');}
  document.addEventListener('click',e=>{
    if(!cmenu.contains(e.target)&&!e.target.closest('[data-plyr="settings"]'))closeCMenu();
  });

  function showPanel(id){
    document.querySelectorAll('.cm-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // Back buttons
  ['quality','audio','sub','speed'].forEach(id=>{
    document.getElementById('cm-back-'+id).addEventListener('click',e=>{
      e.stopPropagation();showPanel('cm-home');buildHomePanel();
    });
  });

  function chevronSvg(){return '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';}

  function buildHomePanel(){
    const home=document.getElementById('cm-home');
    home.innerHTML='';
    // Quality
    const qLabel=curQuality===-1?'Авто':(hls?.levels[curQuality]?.height?snapQuality(hls.levels[curQuality].height)+'p':'Авто');
    home.appendChild(mkRow('Качество',qLabel,()=>{buildQualityPanel();showPanel('cm-quality');}));
    // Audio
    if(hls&&hls.audioTracks.length>0){
      const aLabel=(hls.audioTracks[curAudio]?.name||'Авто').replace(/^\d+\.\s*/,'');
      home.appendChild(mkRow('Озвучка',aLabel,()=>{buildAudioPanel();showPanel('cm-audio');}));
    }
    // Subtitles
    const sLabel=curSub===-1?'Отключить':(hls?.subtitleTracks[curSub]?.name||'Вкл');
    home.appendChild(mkRow('Субтитры',sLabel,()=>{buildSubPanel();showPanel('cm-sub');}));
    // Speed
    const spLabel=curSpeed===1?'Обычная':curSpeed+'×';
    home.appendChild(mkRow('Скорость',spLabel,()=>{buildSpeedPanel();showPanel('cm-speed');}));
  }

  function mkRow(label,value,onclick){
    const btn=document.createElement('button');
    btn.className='cm-row';
    btn.innerHTML=`<span class="cm-row-label">${label}</span><span class="cm-row-value">${value} ${chevronSvg()}</span>`;
    btn.addEventListener('click',e=>{e.stopPropagation();onclick();});
    return btn;
  }

  function mkItem(label,active,onclick){
    const btn=document.createElement('button');
    btn.className='cm-item'+(active?' active':'');
    btn.innerHTML=`<span class="cm-radio"></span><span>${label}</span>`;
    btn.addEventListener('click',e=>{e.stopPropagation();onclick();buildHomePanel();showPanel('cm-home');});
    return btn;
  }

  function snapQuality(h){
    const std=[2160,1440,1080,720,480,360,240];
    // find closest standard that is >= actual height
    for(const s of std){if(h>=s*0.9)return s;}
    return h;
  }

  function buildQualityPanel(){
    const list=document.getElementById('cm-quality-list');list.innerHTML='';
    if(!hls)return;
    // Auto first
    list.appendChild(mkItem('Авто',curQuality===-1,()=>{hls.currentLevel=-1;curQuality=-1;}));
    // Deduplicate levels by snapped label, keep highest-bandwidth per label, sort descending
    const byLabel=new Map();
    hls.levels.forEach((l,i)=>{
      const label=snapQuality(l.height||0)+'p';
      if(!byLabel.has(label)||l.bitrate>(byLabel.get(label).bitrate||0)){
        byLabel.set(label,{idx:i,bitrate:l.bitrate||0,height:l.height||0});
      }
    });
    // Sort by height descending
    [...byLabel.entries()]
      .sort((a,b)=>b[1].height-a[1].height)
      .forEach(([label,{idx}])=>{
        list.appendChild(mkItem(label,curQuality===idx,()=>{hls.currentLevel=idx;curQuality=idx;}));
      });
  }

  function isSupportedAudio(name){
    if(!name)return true;
    const n=name.toUpperCase();
    if(n.includes('AC3')||n.includes('EAC3')||n.includes('DTS')){
      if(n.includes('EAC3'))return MediaSource.isTypeSupported('audio/mp4;codecs="ec-3"');
      return MediaSource.isTypeSupported('audio/mp4;codecs="ac-3"');
    }
    return true;
  }

  function buildAudioPanel(){
    const list=document.getElementById('cm-audio-list');list.innerHTML='';
    if(!hls)return;
    hls.audioTracks.forEach((t,i)=>{
      if(!isSupportedAudio(t.name))return;
      // Strip leading "NN. " prefix from track names
      const label=(t.name||('Дорожка '+(i+1))).replace(/^\d+\.\s*/,'');
      list.appendChild(mkItem(label,curAudio===i,()=>{
        hls.audioTrack=i;curAudio=i;
      }));
    });
  }

  function buildSubPanel(){
    const list=document.getElementById('cm-sub-list');list.innerHTML='';
    list.appendChild(mkItem('Отключить',curSub===-1,()=>{if(hls)hls.subtitleTrack=-1;curSub=-1;}));
    if(!hls)return;
    hls.subtitleTracks.forEach((t,i)=>{
      list.appendChild(mkItem(t.name||('Субтитры '+(i+1)),curSub===i,()=>{
        hls.subtitleTrack=i;curSub=i;
      }));
    });
  }

  function buildSpeedPanel(){
    const list=document.getElementById('cm-speed-list');list.innerHTML='';
    [0.5,0.75,1,1.25,1.5,2].forEach(s=>{
      const label=s===1?'Обычная':s+'×';
      list.appendChild(mkItem(label,curSpeed===s,()=>{plyr.speed=s;curSpeed=s;}));
    });
  }

  // ── HLS ───────────────────────────────────────────────────────────────────────
  function loadM3u8(url,seekTo){
    if(hls){hls.destroy();hls=null;}
    // Reset Plyr progress bar
    try{plyr.currentTime=0;}catch{}
    pendingSeek=(seekTo&&seekTo>5)?seekTo:null;
    if(!Hls.isSupported()){
      if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;if(pendingSeek)video.currentTime=pendingSeek;}
      return;
    }
    hls=new Hls({enableWorker:true});
    hls.loadSource(url);hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{
      // Use auto quality — hls.js ABR picks best based on bandwidth
      curQuality=-1;
      curAudio=hls.audioTrack>=0?hls.audioTrack:0;curSub=-1;
      if(pendingSeek){video.currentTime=pendingSeek;pendingSeek=null;}
    });
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED,(_,d)=>{curAudio=d.id;});
    hls.on(Hls.Events.LEVEL_SWITCHED,(_,d)=>{
      // Only update curQuality if user manually selected a level
      // In auto mode, hls.js switches levels itself — keep curQuality=-1
      if(!hls.autoLevelEnabled){curQuality=d.level;}
    });
    hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH,(_,d)=>{curSub=d.id;});
  }

  const HLS_PROXY='/api/v1/hls/proxy';

  function proxyUrl(filepath){
    return HLS_PROXY+'?url='+encodeURIComponent(filepath);
  }

  function resolveAndLoad(filepath,seekTo){
    video.currentTime=0;
    // Route through our proxy — avoids uBlock/CORS issues with content-router
    loadM3u8(proxyUrl(filepath),seekTo);
  }

  // ── localStorage ──────────────────────────────────────────────────────────────
  function lsGet(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'null');}catch{return null;}}
  function lsSave(){
    if(!video.currentTime||video.currentTime<5)return;
    try{localStorage.setItem(LS_KEY,JSON.stringify({s:playingSeason,e:playingEpisode,t:Math.floor(video.currentTime)}));}catch{}
  }
  video.addEventListener('timeupdate',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(lsSave,5000);});
  function fmtTime(sec){
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  }

  // ── Resume ────────────────────────────────────────────────────────────────────
  function checkResume(){
    const sv=lsGet();if(!sv||!sv.t||sv.t<5)return false;
    const lbl=IS_SERIES?`С${sv.s} Е${sv.e}`:'';
    document.getElementById('resume-title').textContent=lbl;
    document.getElementById('resume-sub').textContent='Вы остановились на '+fmtTime(sv.t);
    document.getElementById('resume').classList.add('show');
    document.getElementById('btn-resume').onclick=()=>{
      document.getElementById('resume').classList.remove('show');
      if(IS_SERIES&&(sv.s!==curSeason||sv.e!==curEpisode)){
        curSeason=sv.s;curEpisode=sv.e;
        updateSeasonBtn();renderEpisodeDrop();updateEpisodeBtn();
        const ep=EPISODES.find(e=>e.season===curSeason&&e.episode===curEpisode);
        if(ep)resolveAndLoad(ep.filepath,sv.t);
      }else{video.currentTime=sv.t;plyr.play();}
    };
    document.getElementById('btn-restart').onclick=()=>{
      document.getElementById('resume').classList.remove('show');
      try{localStorage.removeItem(LS_KEY);}catch{}
      plyr.play();
    };
    return true;
  }

  // ── Episode nav ───────────────────────────────────────────────────────────────
  function epsForSeason(s){return EPISODES.filter(e=>e.season===s).sort((a,b)=>a.episode-b.episode);}
  function allSeasons(){return[...new Set(EPISODES.map(e=>e.season))].sort((a,b)=>a-b);}
  // Track what's currently playing (separate from cur* which update before load)
  let playingSeason=INIT_S, playingEpisode=INIT_E;

  function playCurrentEp(seekTo){
    // Save progress of the episode that was playing before switching
    if(video.currentTime>5){
      try{localStorage.setItem(LS_KEY,JSON.stringify({s:playingSeason,e:playingEpisode,t:Math.floor(video.currentTime)}));}catch{}
    }
    clearTimeout(saveTimer);
    playingSeason=curSeason; playingEpisode=curEpisode;
    const ep=EPISODES.find(e=>e.season===curSeason&&e.episode===curEpisode);
    if(ep)resolveAndLoad(ep.filepath,seekTo);
  }

  function goNext(){
    const eps=epsForSeason(curSeason),idx=eps.findIndex(e=>e.episode===curEpisode);
    if(idx<eps.length-1){curEpisode=eps[idx+1].episode;}
    else{const ss=allSeasons(),si=ss.indexOf(curSeason);if(si<ss.length-1){curSeason=ss[si+1];curEpisode=epsForSeason(curSeason)[0]?.episode??1;updateSeasonBtn();renderSeasonDrop();}else return;}
    updateEpisodeBtn();renderEpisodeDrop();playCurrentEp();
  }
  function goPrev(){
    const eps=epsForSeason(curSeason),idx=eps.findIndex(e=>e.episode===curEpisode);
    if(idx>0){curEpisode=eps[idx-1].episode;}
    else{const ss=allSeasons(),si=ss.indexOf(curSeason);if(si>0){curSeason=ss[si-1];const pe=epsForSeason(curSeason);curEpisode=pe[pe.length-1]?.episode??1;updateSeasonBtn();renderSeasonDrop();}else return;}
    updateEpisodeBtn();renderEpisodeDrop();playCurrentEp();
  }

  // ── Season/Episode dropdowns ──────────────────────────────────────────────────
  function renderSeasonDrop(){
    const drop=document.getElementById('drop-season');if(!drop)return;drop.innerHTML='';
    allSeasons().forEach(s=>{
      const el=document.createElement('div');el.className='di'+(s===curSeason?' active':'');
      el.textContent='Сезон '+s;
      el.onclick=()=>{curSeason=s;curEpisode=epsForSeason(s)[0]?.episode??1;closeDrops();updateSeasonBtn();renderEpisodeDrop();updateEpisodeBtn();playCurrentEp();};
      drop.appendChild(el);
    });
  }
  function renderEpisodeDrop(){
    const drop=document.getElementById('drop-episode');if(!drop)return;drop.innerHTML='';
    epsForSeason(curSeason).forEach(ep=>{
      const el=document.createElement('div');el.className='di'+(ep.episode===curEpisode?' active':'');
      el.textContent='Серия '+ep.episode;
      el.onclick=()=>{curEpisode=ep.episode;closeDrops();updateEpisodeBtn();playCurrentEp();};
      drop.appendChild(el);
    });
  }
  function updateSeasonBtn(){const b=document.getElementById('sel-season');if(b)b.innerHTML='Сезон '+curSeason+' <span class="sa">▾</span>';}
  function updateEpisodeBtn(){const b=document.getElementById('sel-episode');if(b)b.innerHTML='Серия '+curEpisode+' <span class="sa">▾</span>';}
  function closeDrops(){document.querySelectorAll('.sd').forEach(d=>d.classList.remove('open'));}
  document.addEventListener('click',closeDrops);
  ['season','episode'].forEach(id=>{
    const btn=document.getElementById('sel-'+id);if(!btn)return;
    btn.addEventListener('click',e=>{e.stopPropagation();const drop=document.getElementById('drop-'+id);const was=drop.classList.contains('open');closeDrops();if(!was)drop.classList.add('open');});
  });

  // ── Init ──────────────────────────────────────────────────────────────────────
  if(IS_SERIES){renderSeasonDrop();renderEpisodeDrop();updateSeasonBtn();updateEpisodeBtn();}
  resolveAndLoad(INIT_M3U8,null);

  // ── Sync bar visibility with Plyr controls ────────────────────────────────────
  plyr.on('ready',()=>{
    const plyrEl=document.querySelector('.plyr');
    if(!plyrEl)return;
    const bar=document.getElementById('bar');
    if(!bar)return;
    const obs=new MutationObserver(()=>{
      const hidden=plyrEl.classList.contains('plyr--hide-controls');
      bar.style.opacity=hidden?'0':'1';
      bar.style.pointerEvents=hidden?'none':'auto';
    });
    obs.observe(plyrEl,{attributes:true,attributeFilter:['class']});
    bar.addEventListener('click',()=>{
      bar.style.opacity='1';
      bar.style.pointerEvents='auto';
    });
  });

  // ── Fullscreen: #pw is the container, all overlays stay inside ───────────────
  // Plyr uses #pw as fullscreen container via fullscreen.container option above.
  // No DOM manipulation needed — #bar, #cmenu, #resume are already inside #pw.
})();
</script></body></html>"###.to_string();

    format!("{}{}", p1, p2)
}
