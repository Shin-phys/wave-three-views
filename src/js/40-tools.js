/* =========================================================
   「調べる」タブ：線の幅、y-t図の横軸（WAVE-F-23, F-27）、
   長さの目盛り（F-11）、傾き補正（F-14）、時間（F-07, F-08）、保存
   ========================================================= */
(function(A){
'use strict';
var T = A.tools = {};

/* ---------- 2点を取る道具（目盛り・傾きで共用） ---------- */
function twoPointTool(color, done){
  var pts=[];
  return {
    pts:pts,
    vidDown:function(p){ if(pts.length>=2) pts.length=0; pts.push({x:p.x,y:p.y}); if(pts.length===2) done(pts); },
    drawVid:function(ctx,V){
      ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=2;
      pts.forEach(function(q){ ctx.beginPath(); ctx.arc(V.sx2c(q.x),V.sy2c(q.y),5,0,Math.PI*2); ctx.fill(); });
      if(pts.length===2){ ctx.beginPath(); ctx.moveTo(V.sx2c(pts[0].x),V.sy2c(pts[0].y)); ctx.lineTo(V.sx2c(pts[1].x),V.sy2c(pts[1].y)); ctx.stroke(); }
    }
  };
}
function endTool(){ A.tool=null; A.$('#btnScale').classList.remove('on'); A.$('#btnTilt').classList.remove('on'); A.view.renderOv(); A.show('#hint',false); }
function hint(msg){ var h=A.$('#hint'); h.textContent=msg; A.show(h,!!msg); }

/* 長さの目盛り */
function startScale(){
  if(!A.src) return;
  if(A.tool&&A.tool.kind==='scale'){ endTool(); return; }
  A.tool=twoPointTool('#ff8fd6',function(pts){
    var box=A.$('#scaleBox'); A.show(box,true);
    A.$('#inpLen').focus();
  });
  A.tool.kind='scale';
  A.$('#btnScale').classList.add('on');
  hint('長さが分かっている2点を、動画の上で順にタップしてください。');
}
function applyScale(){
  var t=A.tool; if(!t||t.kind!=='scale'||t.pts.length<2) return;
  var cm=parseFloat(A.$('#inpLen').value);
  if(!(cm>0)){ A.toast('長さを cm で入れてください'); return; }
  var dx=t.pts[1].x-t.pts[0].x, dy=t.pts[1].y-t.pts[0].y, px=Math.hypot(dx,dy);
  A.src.pxPerM=px/(cm/100);
  A.show('#scaleBox',false); endTool(); T.refresh();
  A.toast('目盛りを決めました');
}

/* 傾き補正：止まっている媒質に沿った2点が水平になるよう回す */
function startTilt(){
  var s=A.src; if(!s) return;
  if(s.kind!=='video'){ A.toast('傾きの補正は、取り込んだ動画で使えます'); return; }
  if(A.tool&&A.tool.kind==='tilt'){ endTool(); return; }
  A.tool=twoPointTool('#6fe3c1',function(pts){
    var ang=Math.atan2(pts[1].y-pts[0].y, pts[1].x-pts[0].x)*180/Math.PI;
    if(ang>90) ang-=180; if(ang<-90) ang+=180;
    endTool();
    if(Math.abs(ang)<0.2){ A.toast('ほぼ水平なので、そのままにします'); return; }
    A.capture.recapture((s.rot||0)+ang);
  });
  A.tool.kind='tilt';
  A.$('#btnTilt').classList.add('on');
  hint('止まっているときの媒質（または床などの水平な線）に沿った2点を、左右に離してタップしてください。');
}

/* y-t図の横軸を y-x図と同じ縮尺にそろえる：1コマで波が進む距離（画素）＝ 1コマの幅 */
function matchScale(){
  var s=A.src; if(!s) return;
  if(s.unit==='T'){ return; }
  var v=parseFloat(A.$('#inpV').value);
  if(!(v>0)){ A.toast('波の速さ（m/s）を入れてください'); return; }
  if(!s.pxPerM){ A.toast('先に「長さの目盛り」を決めてください'); return; }
  A.ppf = v*s.pxPerM*A.dtReal();
  A.ppf = A.clamp(A.ppf, 0.2, 60);
  T.refresh(); A.view.layout();
}

T.refresh = function(){
  var s=A.src;
  A.$('#rngBand').value=A.band; A.$('#bandLabel').textContent=A.band;
  A.$('#rngPpf').value=Math.round(A.ppf); A.$('#ppfLabel').textContent=(Math.round(A.ppf*100)/100);
  if(!s) return;
  var isT=s.unit==='T';
  A.$('#scaleLabel').textContent = s.pxPerM ? ('1 cm = '+(s.pxPerM/100).toFixed(2)+' 画素') : '未設定';
  A.$('#tiltLabel').textContent = (s.rot? s.rot.toFixed(1):'0')+'°';
  A.$('#inpFps').value = s.fps||'';
  A.$('#inpFps').disabled = isT;
  A.$('#selSlow').disabled = isT;
  A.$('#selSlow').value = String(s.slow||1);
  A.$('#fpsNote').textContent = isT ? '（ぱらぱら漫画では使いません）' : (s.fpsAuto?'動画から推定':(s.kind==='sample'?'サンプルの値':'入力した値'));
  if(s.v!=null && !A.$('#inpV').value) A.$('#inpV').value=(Math.round(s.v*1000)/1000);
  A.$('#btnMatch').disabled = isT;
  A.$('#matchHint').textContent = isT ? '' : (s.pxPerM ? '' : '「y-x図と同じ縮尺」には長さの目盛りが要ります。');
  A.$('#btnTilt').disabled = s.kind!=='video';
};

T.init = function(){
  // 目盛りの長さ入力欄（2点を取ったあとに出す）
  var box=document.createElement('div'); box.id='scaleBox'; box.className='row small hidden';
  box.innerHTML='<label>2点の間の長さ <input type="number" id="inpLen" class="num" min="0" step="0.1"> cm</label><button class="btn sm primary" id="btnLenOk">決める</button>';
  A.$('#btnScale').parentNode.insertAdjacentElement('afterend',box);
  A.$('#btnLenOk').addEventListener('click',applyScale);
  A.$('#inpLen').addEventListener('keydown',function(e){ if(e.key==='Enter') applyScale(); });

  A.$('#btnScale').addEventListener('click',startScale);
  A.$('#btnTilt').addEventListener('click',startTilt);
  A.$('#btnMatch').addEventListener('click',matchScale);
  A.$('#btnClearLines').addEventListener('click',function(){ A.lines=[]; A.emit('lines'); });
  A.$('#rngBand').addEventListener('input',function(){ A.band=parseInt(this.value,10); A.$('#bandLabel').textContent=A.band; A.emit('lines'); });
  A.$('#rngPpf').addEventListener('input',function(){ A.ppf=parseInt(this.value,10); A.$('#ppfLabel').textContent=A.ppf; A.view.layout(); });
  A.$('#inpFps').addEventListener('change',function(){
    var s=A.src, v=parseFloat(this.value); if(!s||!(v>0)) return;
    s.fps=v; s.times=null; s.fpsAuto=false; T.refresh(); A.emit('frame'); A.yt.renderOv();
  });
  A.$('#selSlow').addEventListener('change',function(){
    var s=A.src; if(!s) return; s.slow=parseFloat(this.value)||1; A.emit('frame'); A.yt.renderOv();
  });
  A.$('#btnSaveYt').addEventListener('click',function(){ A.yt.save(); });
  A.on('source',function(){ endTool(); A.$('#inpV').value=''; T.refresh(); });
  A.on('tab',function(t){ if(t!=='tools' && A.tool && (A.tool.kind==='scale'||A.tool.kind==='tilt')) endTool(); });
};

})(W);
