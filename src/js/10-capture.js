/* =========================================================
   動画の取り込み（WAVE-F-01, F-06, F-07, N-10, N-11, F-14）
   解析区間を1回だけ再生し、requestVideoFrameCallback で全コマを縮小保存する。
   以後のコマ送り・y-t図・アニメーションは保存したコマから行う。
   ========================================================= */
(function(A){
'use strict';
var C = A.capture = {};
var BUDGET = 72e6;            // 保存に使うメモリの目安（バイト）
var STD_FPS = [24,25,30,48,50,60,90,100,120,240];

var video, fileName='', t0=0, t1=0, dur=0, busy=false;

function sizeFor(capLong, vw, vh){
  var w,h;
  if(vw>=vh){ w=capLong; h=Math.round(capLong*vh/vw); }
  else { h=capLong; w=Math.round(capLong*vw/vh); }
  return {w:w+(w%2), h:h+(h%2)};
}
C.maxFrames = function(w,h){ return Math.max(30, Math.min(600, Math.floor(BUDGET/(w*h*4)))); };

function median(a){ var b=a.slice().sort(function(x,y){return x-y;}); return b.length?b[b.length>>1]:0; }
function snapFps(f){
  for(var i=0;i<STD_FPS.length;i++){ if(Math.abs(f-STD_FPS[i])/STD_FPS[i]<0.03) return STD_FPS[i]; }
  return Math.round(f*100)/100;
}

function waitEvent(el, ev, ms){
  return new Promise(function(res){
    var done=false;
    function h(){ if(done)return; done=true; el.removeEventListener(ev,h); res(true); }
    el.addEventListener(ev,h);
    if(ms) setTimeout(function(){ if(!done){done=true; el.removeEventListener(ev,h); res(false);} }, ms);
  });
}
function seek(t){
  return new Promise(function(res){
    if(Math.abs(video.currentTime-t)<1e-4 && video.readyState>=2){ res(); return; }
    var h=function(){ video.removeEventListener('seeked',h); res(); };
    video.addEventListener('seeked',h);
    video.currentTime=t;
  });
}

/* 1枚描く（傾き補正 rot 度を打ち消す向きに回す） */
function drawer(w,h,rot){
  var cv=A.canvas(w,h), ctx=cv.getContext('2d',{willReadFrequently:true});
  return function(){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
    ctx.save();
    if(rot){ ctx.translate(w/2,h/2); ctx.rotate(-rot*Math.PI/180); ctx.translate(-w/2,-h/2); }
    ctx.drawImage(video,0,0,w,h);
    ctx.restore();
    return ctx.getImageData(0,0,w,h);
  };
}

/* rVFC で連続再生しながら取り込む */
function captureRVFC(w,h,rot,rate,maxF,onProg){
  return new Promise(function(resolve){
    var frames=[], times=[], draw=drawer(w,h,rot), last=-1, finished=false;
    function finish(){
      if(finished) return; finished=true;
      video.pause();
      resolve({frames:frames,times:times});
    }
    function cb(now, meta){
      if(finished) return;
      var mt=meta.mediaTime;
      if(mt>t1+1e-3 || frames.length>=maxF){ finish(); return; }
      if(mt>last+1e-5 && mt>=t0-1e-3){
        frames.push(draw()); times.push(mt); last=mt;
        onProg((mt-t0)/Math.max(1e-6,t1-t0));
      }
      video.requestVideoFrameCallback(cb);
    }
    seek(t0).then(function(){
      video.playbackRate=rate;
      video.requestVideoFrameCallback(cb);
      var p=video.play(); if(p&&p.catch) p.catch(function(){ finish(); });
      video.onended=finish;
    });
  });
}

/* rVFC が使えない端末：fps を仮定して1コマずつシークする（遅いがずれは少ない） */
async function captureSeek(w,h,rot,fps,maxF,onProg){
  var frames=[], times=[], draw=drawer(w,h,rot);
  var n=Math.min(maxF, Math.floor((t1-t0)*fps)+1);
  for(var i=0;i<n;i++){
    var t=t0+(i+0.5)/fps; if(t>dur) break;
    await seek(t);
    frames.push(draw()); times.push(t0+i/fps);
    onProg(i/n);
  }
  return {frames:frames,times:times};
}

C.hasRVFC = function(){ return !!(video && 'requestVideoFrameCallback' in video); };

/* 取り込み本体。取りこぼしが多ければ再生速度を落として取り直す */
C.run = async function(opt){
  if(busy) return null;
  busy=true;
  var capLong=opt.capLong||320, rot=opt.rot||0;
  var sz=sizeFor(capLong, video.videoWidth, video.videoHeight);
  var maxF=C.maxFrames(sz.w,sz.h);
  /* 再生中の映像が画面に出ていないと rVFC が呼ばれない端末があるため、
     取り込み中は映像を手前の小窓へ移して見せておく */
  var home=video.parentNode, next=video.nextSibling;
  var ov=document.createElement('div'); ov.className='capov';
  ov.innerHTML='<div class="small">取り込み中…</div><div class="progress"><div></div></div>';
  ov.insertBefore(video, ov.firstChild); document.body.appendChild(ov);
  var bar=ov.querySelector('.progress div');
  var onProg=function(r){ bar.style.width=Math.round(A.clamp(r,0,1)*100)+'%'; };
  var res=null, fps=0;
  try{
    if(C.hasRVFC()){
      var rates=[1,0.5,0.25];
      for(var k=0;k<rates.length;k++){
        res=await captureRVFC(sz.w,sz.h,rot,rates[k],maxF,onProg);
        var dts=[]; for(var i=1;i<res.times.length;i++) dts.push(res.times[i]-res.times[i-1]);
        var med=median(dts);
        fps = med>0 ? snapFps(1/med) : 30;
        var drops=dts.filter(function(d){return d>med*1.6;}).length;
        if(dts.length<2 || drops<=Math.max(1,dts.length*0.02)) break;
        A.toast('コマの取りこぼしがあったので、ゆっくり再生して取り直します');
      }
    } else {
      fps = parseFloat(A.$('#inpFps').value)||30;
      res=await captureSeek(sz.w,sz.h,rot,fps,maxF,onProg);
    }
  } finally {
    busy=false; video.playbackRate=1;
    home.insertBefore(video, next); document.body.removeChild(ov);
  }
  if(!res || res.frames.length<2){ A.toast('コマを取り込めませんでした。別の形式の動画を試してください'); return null; }
  if(res.frames.length>=maxF) A.toast('最大 '+maxF+' コマまでで止めました（区間を短くすると全体を取り込めます）',4000);
  return {frames:res.frames, times:res.times, fps:fps, W:sz.w, H:sz.h, capLong:capLong, rot:rot};
};

/* 取り込んだ結果を src にする */
function toSource(r){
  return {kind:'video', name:fileName, W:r.W, H:r.H, frames:r.frames, times:r.times,
    fps:r.fps, fpsAuto:C.hasRVFC(), slow:parseFloat(A.$('#selSlow').value)||1, pxPerM:null,
    light:A.isLight(r.frames[0]), unit:'s', capLong:r.capLong, rot:r.rot, range:[t0,t1]};
}

/* 傾き補正：同じ区間を回転をかけて取り込み直す（WAVE-F-14） */
C.recapture = async function(rot){
  var s=A.src; if(!s||s.kind!=='video'||!video) return;
  t0=s.range[0]; t1=s.range[1];
  var keep={lines:A.lines.slice(), cur:A.cur, pxPerM:s.pxPerM, slow:s.slow};
  A.toast('傾きを直して取り込み直しています…',2000);
  var r=await C.run({capLong:s.capLong, rot:rot});
  if(!r) return;
  var ns=toSource(r); ns.pxPerM=keep.pxPerM; ns.slow=keep.slow;
  A.setSource(ns);
  A.lines=keep.lines; A.goto(keep.cur); A.emit('lines');
};

/* ---------- 画面 ---------- */
function rangeText(){
  A.$('#rangeLabel').textContent=t0.toFixed(2)+' 〜 '+t1.toFixed(2)+' 秒（'+(t1-t0).toFixed(2)+' 秒）';
  var cl=parseInt(A.$('#selCapW').value,10);
  if(video && video.videoWidth){
    var sz=sizeFor(cl,video.videoWidth,video.videoHeight), mf=C.maxFrames(sz.w,sz.h);
    A.$('#capLimit').textContent='最大 '+mf+' コマまで取り込めます（30コマ/秒なら約 '+(mf/30).toFixed(0)+' 秒）。';
  }
}

C.openFile = function(file, label){
  fileName = label || file.name || '動画';
  video = A.$('#srcVideo');
  if(video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(file);
  A.show('#capBox',true);
  A.$('#rangeLabel').textContent='読み込み中…';
  video.onloadedmetadata=function(){
    dur=video.duration||0;
    if(!isFinite(dur)||dur<=0){ A.toast('この動画は長さが読めません。別の形式で保存し直してください'); return; }
    t0=0; t1=Math.min(dur, 10);
    A.$('#rngStart').value=0; A.$('#rngEnd').value=Math.round(t1/dur*1000);
    rangeText();
    seek(0.001);
  };
  video.onerror=function(){
    A.toast('この動画はこのブラウザで再生できません。iPhone なら「互換性優先」で撮り直すか、別のブラウザで開いてください',6000);
    A.$('#rangeLabel').textContent='再生できません';
  };
};

C.init = function(){
  video=A.$('#srcVideo');
  A.$('#fileVideo').addEventListener('change',function(e){
    var f=e.target.files&&e.target.files[0]; if(f) C.openFile(f);
    e.target.value='';
  });
  function onRange(which){
    var a=parseInt(A.$('#rngStart').value,10)/1000*dur, b=parseInt(A.$('#rngEnd').value,10)/1000*dur;
    if(which==='s' && a>b-0.2){ a=Math.max(0,b-0.2); }
    if(which==='e' && b<a+0.2){ b=Math.min(dur,a+0.2); }
    t0=a; t1=b; rangeText();
    seek(which==='s'?t0:Math.max(0,t1-0.01));
  }
  A.$('#rngStart').addEventListener('input',function(){onRange('s');});
  A.$('#rngEnd').addEventListener('input',function(){onRange('e');});
  A.$('#selCapW').addEventListener('change',rangeText);
  A.$('#btnCapture').addEventListener('click',async function(){
    if(!video||!dur) return;
    this.disabled=true;
    var r=await C.run({capLong:parseInt(A.$('#selCapW').value,10), rot:0});
    this.disabled=false;
    if(r){ A.setSource(toSource(r)); A.toast(r.frames.length+' コマを取り込みました'); }
  });
};

})(W);
