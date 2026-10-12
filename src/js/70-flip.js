/* =========================================================
   ぱらぱら漫画（03-flipbook.md、WAVE-F-30〜F-39, F-50, F-51）
   写真 → マーカー検出 → 射影変換で作図範囲を切り出す → 白を基準に色を補正 → 赤を抜き出す
   コマは用紙のコマ番号の位置に置く（足りないコマは空きのまま）。
   ========================================================= */
(function(A){
'use strict';
var F = A.flip = {};
var PPM = 3;                 // 切り出した画像の 1 mm あたりの画素
var MAXLONG = 1600;          // 検出に使う写真の長辺
var preset = null, items = [], ghost = null, detector = null;
var queue = [], qBusy = false, forceN = null;

function P(){ return preset || A.sheet.get(A.$('#selFlipPreset').value); }
function dims(){ var a=A.sheet.area(P()); return {w:Math.round(a.w*PPM), h:Math.round(a.h*PPM), a:a}; }

/* ---------- 画像の読み込み ---------- */
function loadImage(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file), img=new Image();
    img.onload=function(){
      var s=Math.min(1, MAXLONG/Math.max(img.naturalWidth,img.naturalHeight));
      var w=Math.round(img.naturalWidth*s), h=Math.round(img.naturalHeight*s);
      var c=A.canvas(w,h), x=c.getContext('2d',{willReadFrequently:true});
      x.drawImage(img,0,0,w,h); URL.revokeObjectURL(url);
      res({w:w,h:h,data:x.getImageData(0,0,w,h),canvas:c});
    };
    img.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src=url;
  });
}

/* ---------- 射影変換（mm → 写真の画素） ---------- */
function solve(M, b){       // ガウスの消去法
  var n=b.length, i, j, k;
  for(i=0;i<n;i++){ M[i]=M[i].slice(); M[i].push(b[i]); }
  for(i=0;i<n;i++){
    var piv=i; for(j=i+1;j<n;j++) if(Math.abs(M[j][i])>Math.abs(M[piv][i])) piv=j;
    var t=M[i]; M[i]=M[piv]; M[piv]=t;
    if(Math.abs(M[i][i])<1e-12) return null;
    for(j=i+1;j<n;j++){ var f=M[j][i]/M[i][i]; for(k=i;k<=n;k++) M[j][k]-=f*M[i][k]; }
  }
  var x=new Array(n);
  for(i=n-1;i>=0;i--){ var s=M[i][n]; for(j=i+1;j<n;j++) s-=M[i][j]*x[j]; x[i]=s/M[i][i]; }
  return x;
}
/* src:[[X,Y]] (mm) → dst:[[x,y]] (px)。4点以上。最小二乗。 */
F.homography = function(src, dst){
  var SX=100, SY=1000, ATA=[], ATb=[], i, j, k;
  for(i=0;i<8;i++){ ATA.push([0,0,0,0,0,0,0,0]); ATb.push(0); }
  for(k=0;k<src.length;k++){
    var X=src[k][0]/SX, Y=src[k][1]/SX, x=dst[k][0]/SY, y=dst[k][1]/SY;
    var r1=[X,Y,1,0,0,0,-x*X,-x*Y], r2=[0,0,0,X,Y,1,-y*X,-y*Y];
    for(i=0;i<8;i++){ for(j=0;j<8;j++){ ATA[i][j]+=r1[i]*r1[j]+r2[i]*r2[j]; } ATb[i]+=r1[i]*x+r2[i]*y; }
  }
  var h=solve(ATA,ATb); if(!h) return null;
  return function(Xmm,Ymm){
    var X=Xmm/SX, Y=Ymm/SX, w=h[6]*X+h[7]*Y+1;
    return [SY*(h[0]*X+h[1]*Y+h[2])/w, SY*(h[3]*X+h[4]*Y+h[5])/w];
  };
};

/* 作図範囲を切り出す（双線形補間） */
function rectify(img, H){
  var d=dims(), a=d.a, out=new ImageData(d.w,d.h), O=out.data, S=img.data.data, sw=img.w, sh=img.h;
  for(var Y=0;Y<d.h;Y++){
    var ym=a.y0+(Y+0.5)/PPM;
    for(var X=0;X<d.w;X++){
      var q=H(a.x0+(X+0.5)/PPM, ym), x=q[0]-0.5, y=q[1]-0.5, p=(Y*d.w+X)*4;
      if(!(x>=0&&y>=0&&x<sw-1&&y<sh-1)){ O[p]=O[p+1]=O[p+2]=255; O[p+3]=255; continue; }
      var x0=x|0, y0=y|0, fx=x-x0, fy=y-y0, i00=(y0*sw+x0)*4, i10=i00+4, i01=i00+sw*4, i11=i01+4;
      for(var c=0;c<3;c++){
        O[p+c]=(S[i00+c]*(1-fx)+S[i10+c]*fx)*(1-fy)+(S[i01+c]*(1-fx)+S[i11+c]*fx)*fy;
      }
      O[p+3]=255;
    }
  }
  return out;
}

/* 用紙の白を基準に色を補正し（照明の色かぶりを減らす）、赤の画素を抜き出す（WAVE-F-34） */
function normalize(im){
  var D=im.data, n=D.length/4, lum=new Uint8Array(n), hist=new Uint32Array(256), i;
  for(i=0;i<n;i++){ lum[i]=0.299*D[i*4]+0.587*D[i*4+1]+0.114*D[i*4+2]; hist[lum[i]]++; }
  // 明るいほうから3割の画素を「紙の白」とみなす
  var th=255, acc=0; while(th>0 && acc<n*0.3){ acc+=hist[th]; th--; }
  var r=0,g=0,b=0,c=0;
  for(i=0;i<n;i++) if(lum[i]>=th){ r+=D[i*4]; g+=D[i*4+1]; b+=D[i*4+2]; c++; }
  r=Math.max(40,r/c); g=Math.max(40,g/c); b=Math.max(40,b/c);
  var mask=new Uint8Array(n);
  for(i=0;i<n;i++){
    var p=i*4, R=Math.min(255,D[p]*255/r), G=Math.min(255,D[p+1]*255/g), B=Math.min(255,D[p+2]*255/b);
    D[p]=R; D[p+1]=G; D[p+2]=B;
    var mx=Math.max(G,B);
    if(R>95 && R-mx>55 && (R-mx)/R>0.33) mask[i]=1;
  }
  // 孤立した点を除く
  var w=im.width, h=im.height, m2=new Uint8Array(n);
  for(var y=1;y<h-1;y++) for(var x=1;x<w-1;x++){
    var k=y*w+x; if(!mask[k]) continue;
    var s=mask[k-1]+mask[k+1]+mask[k-w]+mask[k+w]+mask[k-w-1]+mask[k-w+1]+mask[k+w-1]+mask[k+w+1];
    if(s>=2) m2[k]=1;
  }
  return m2;
}

/* ---------- マーカー検出 ---------- */
function detect(img){
  if(!detector) detector=new AR.Detector({dictionaryName:'ARUCO_MIP_36h12'});
  var ms=detector.detect(img.data), p=P(), votes={};
  ms=ms.filter(function(m){ return m.id<48; });
  ms.forEach(function(m){ var n=Math.floor(m.id/4); votes[n]=(votes[n]||0)+1; });
  var best=-1, bv=0; for(var k in votes){ if(votes[k]>bv){bv=votes[k];best=+k;} }
  if(best<0) return {n:null, markers:0};
  var use=ms.filter(function(m){ return Math.floor(m.id/4)===best; });
  var seen={}; use=use.filter(function(m){ if(seen[m.id]) return false; seen[m.id]=1; return true; });
  if(use.length<2) return {n:best, markers:use.length};
  var src=[], dst=[];
  use.forEach(function(m){
    var mm=A.sheet.markerCorners(m.id%4);
    for(var c=0;c<4;c++){ src.push(mm[c]); dst.push([m.corners[c].x, m.corners[c].y]); }
  });
  return {n:best, markers:use.length, H:F.homography(src,dst), tooBig: best>=p.n};
}

/* ---------- コマの登録 ---------- */
function thumbOf(im){
  var c=A.canvas(im.width,im.height); c.getContext('2d').putImageData(im,0,0);
  var t=A.canvas(160,Math.round(160*im.height/im.width)); t.getContext('2d').drawImage(c,0,0,t.width,t.height);
  return t.toDataURL('image/jpeg',0.7);
}
function addItem(n, rect, how, name){
  var mask=normalize(rect);
  var it={n:n, rect:rect, mask:mask, how:how, name:name||'', thumb:thumbOf(rect)};
  var had=!!items[n] && !items[n].virtual;
  items[n]=it;
  return had;
}

async function processFile(file){
  var img;
  try{ img=await loadImage(file); }
  catch(e){ A.toast('「'+(file.name||'写真')+'」を読み込めませんでした（この形式はこのブラウザで開けません）',5000); return; }
  var r=detect(img), p=P();
  if(r.H && !r.tooBig && forceN==null){
    var had=addItem(r.n, rectify(img,r.H), '自動', file.name);
    if(had) A.toast('コマ '+(r.n+1)+'（'+A.sheet.label(p,r.n)+'）を差し替えました');
    return;
  }
  if(r.H && forceN!=null){ addItem(forceN, rectify(img,r.H), '自動', file.name); return; }
  if(r.tooBig) A.toast('用紙の種類が違うようです。「開く」の「用紙の種類」を確かめてください',5000);
  // 自動で見つからない → 手動で四隅を指定
  await manualCorners(img, file.name, forceN!=null?forceN:r.n);
}

F.addFiles = async function(files, n){
  files=Array.prototype.slice.call(files||[]);
  if(!files.length) return;
  preset=preset||A.sheet.get(A.$('#selFlipPreset').value);
  forceN = (n==null)?null:n;
  A.toast('写真を読み取っています…', 1500);
  for(var i=0;i<files.length;i++){ await A.raf(); await processFile(files[i]); }
  forceN=null;
  rebuild(true);
};

/* ---------- 手動で四隅を指定（WAVE-F-31） ---------- */
function manualCorners(img, name, nGuess){
  return new Promise(function(resolve){
    var p=P(), modal=A.$('#cornerModal'), cv=A.$('#cvCorner'), ctx=cv.getContext('2d');
    var pts=[], sc=1;
    var sel=A.$('#selCornerFrame');
    sel.innerHTML=''; for(var n=0;n<p.n;n++) sel.innerHTML+='<option value="'+n+'">'+A.sheet.label(p,n)+'</option>';
    var guess=nGuess; if(guess==null){ for(var k=0;k<p.n;k++){ if(!items[k]||items[k].virtual){ guess=k; break; } } }
    sel.value=String(guess==null?0:guess);
    A.$('#cornerMsg').textContent='「'+(name||'写真')+'」の黒い四角が見つかりませんでした。四隅の黒い四角の外側の角を、左上 → 右上 → 右下 → 左下 の順にタップしてください。';
    A.show(modal,true);
    function fit(){
      var maxW=Math.min(window.innerWidth-60, 900), maxH=window.innerHeight-230;
      sc=Math.min(maxW/img.w, maxH/img.h);
      cv.width=img.w; cv.height=img.h;
      cv.style.width=Math.round(img.w*sc)+'px'; cv.style.height=Math.round(img.h*sc)+'px';
      draw();
    }
    function draw(){
      ctx.drawImage(img.canvas,0,0);
      var names=['左上','右上','右下','左下'];
      ctx.lineWidth=3/sc; ctx.strokeStyle='#ff3b3b'; ctx.fillStyle='#ff3b3b'; ctx.font=(16/sc)+'px system-ui';
      pts.forEach(function(q,i){
        ctx.beginPath(); ctx.arc(q[0],q[1],7/sc,0,Math.PI*2); ctx.stroke();
        ctx.fillText(names[i], q[0]+10/sc, q[1]-10/sc);
      });
      if(pts.length===4){ ctx.beginPath(); pts.forEach(function(q,i){ if(i)ctx.lineTo(q[0],q[1]); else ctx.moveTo(q[0],q[1]); }); ctx.closePath(); ctx.stroke(); }
      A.$('#cornerOk').disabled=pts.length<4;
    }
    function tap(e){
      if(pts.length>=4) return;
      var r=cv.getBoundingClientRect();
      pts.push([(e.clientX-r.left)/sc,(e.clientY-r.top)/sc]); draw();
    }
    function close(result){
      cv.removeEventListener('pointerdown',tap);
      A.$('#cornerRedo').onclick=A.$('#cornerSkip').onclick=A.$('#cornerOk').onclick=null;
      A.show(modal,false);
      resolve(result);
    }
    cv.addEventListener('pointerdown',tap);
    A.$('#cornerRedo').onclick=function(){ pts=[]; draw(); };
    A.$('#cornerSkip').onclick=function(){ close(false); };
    A.$('#cornerOk').onclick=function(){
      var H=F.homography(A.sheet.outerCorners(), pts);
      if(!H){ A.toast('四隅の位置を確かめてください'); return; }
      addItem(parseInt(sel.value,10), rectify(img,H), '手動', name);
      close(true);
    };
    fit();
  });
}

/* ---------- 表示用のコマを作る ---------- */
function opts(){
  return { red:A.$('#chkRed').checked, inc:A.$('#chkInc').checked, ghost:A.$('#chkGhost').checked,
           theory:A.$('#chkTheory').checked, complete:A.$('#chkComplete').checked };
}
/* 補完：t + T/2 のコマは、t のコマを横軸について上下反転したもの（WAVE-F-39） */
function withVirtual(){
  var p=P(), o=opts(), half=p.n/2, list=items.slice(0,p.n);
  for(var n=0;n<p.n;n++){ if(list[n]&&list[n].virtual) list[n]=null; }
  if(o.complete){
    for(var m=half;m<p.n;m++){
      var src=list[m-half];
      if(!list[m] && src && !src.virtual) list[m]=flipItem(src, m);
    }
  }
  return list;
}
var flipCache={};
function flipItem(src, m){
  var key=m+'|'+src.thumb.length+'|'+src.how+'|'+src.name;
  if(flipCache[m] && flipCache[m].key===key) return flipCache[m].it;
  var w=src.rect.width, h=src.rect.height, r=new ImageData(w,h), mk=new Uint8Array(w*h);
  for(var y=0;y<h;y++){
    var sy=h-1-y;
    r.data.set(src.rect.data.subarray(sy*w*4,(sy+1)*w*4), y*w*4);
    mk.set(src.mask.subarray(sy*w,(sy+1)*w), y*w);
  }
  var it={n:m, rect:r, mask:mk, how:'補完', virtual:true, name:'', thumb:thumbOf(r)};
  flipCache[m]={key:key,it:it};
  return it;
}

function blank(w,h,text){
  var c=A.canvas(w,h), x=c.getContext('2d');
  x.fillStyle='#e9ecf1'; x.fillRect(0,0,w,h);
  x.fillStyle='#8a93a3'; x.font='bold 28px system-ui'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(text,w/2,h/2);
  return x.getImageData(0,0,w,h);
}
/* 赤だけ表示：白地にうすい横の目盛り線と赤い線 */
function redOnly(it, d){
  var p=P(), out=new ImageData(d.w,d.h), O=out.data, M=it.mask;
  for(var i=0;i<M.length;i++){
    var q=i*4;
    if(M[i]){ O[q]=214; O[q+1]=32; O[q+2]=32; } else { O[q]=O[q+1]=O[q+2]=255; }
    O[q+3]=255;
  }
  for(var r=-(2*p.amp+1); r<=2*p.amp+1; r++){
    var y=Math.round((A.sheet.AXIS_Y-r*p.rowMM-d.a.y0)*PPM); if(y<0||y>=d.h) continue;
    for(var x=0;x<d.w;x++){
      var k=(y*d.w+x); if(M[k]) continue;
      var q2=k*4, v=r===0?190:228; O[q2]=v; O[q2+1]=v+14>255?255:v+14; O[q2+2]=255;
    }
  }
  return out;
}
function buildGhost(list, d){
  var c=A.canvas(d.w,d.h), x=c.getContext('2d'), im=x.createImageData(d.w,d.h), D=im.data;
  var cnt=new Uint8Array(d.w*d.h), k=0;
  list.forEach(function(it){ if(!it) return; k++; for(var i=0;i<cnt.length;i++) if(it.mask[i]) cnt[i]++; });
  for(var i=0;i<cnt.length;i++){
    if(!cnt[i]) continue;
    var q=i*4; D[q]=150; D[q+1]=60; D[q+2]=230; D[q+3]=Math.min(255, 70+cnt[i]*30);
  }
  x.putImageData(im,0,0);
  return c;
}

function rebuild(isNew){
  var p=P(), d=dims(), o=opts(), list=withVirtual();
  var any=list.some(function(it){return !!it;});
  A.show('#flipEmpty',!any); A.show('#flipCtl',any);
  A.$('#chkInc').disabled=!o.red;
  if(!any){ renderThumbs(list); return; }
  var frames=[];
  for(var n=0;n<p.n;n++){
    var it=list[n];
    if(!it){ frames.push(blank(d.w,d.h,'コマ '+(n+1)+'（'+A.sheet.label(p,n)+'）がありません')); continue; }
    frames.push(o.red ? redOnly(it,d) : new ImageData(new Uint8ClampedArray(it.rect.data), d.w, d.h));
  }
  ghost = o.ghost ? buildGhost(list,d) : null;
  if(isNew || !A.src || A.src.kind!=='flip'){
    var cur = (A.src && A.src.kind==='flip') ? A.cur : 0, lines=(A.src&&A.src.kind==='flip')?A.lines.slice():[];
    A.setSource({kind:'flip', name:'ぱらぱら漫画（'+p.name+'）', W:d.w, H:d.h, frames:frames, times:null,
      fps:4, slow:1, pxPerM:PPM*1000, light:true, unit:'T', perPeriod:p.n, preset:p.id});
    // y-t図が1周期ぶん横に収まるように、1コマの幅を決める
    A.ppf=Math.max(16, Math.floor((A.$('#ytPane').clientWidth-4)/(A.view.s*p.n)));
    A.view.layout(); if(A.tools) A.tools.refresh();
    if(lines.length){ A.lines=lines; A.emit('lines'); }
    A.goto(cur);
    if(A.ui) A.ui.tab('flip');
  } else {
    A.src._ver=(A.src._ver||0)+1;
    A.replaceFrames(frames);
  }
  renderThumbs(list);
}

/* ---------- 重ね描き：残像・印刷された波・答え合わせ ---------- */
function drawOv(ctx, V){
  var s=A.src; if(!s||s.kind!=='flip') return;
  var p=P(), d=dims(), o=opts();
  if(ghost){ ctx.globalAlpha=0.9; ctx.drawImage(ghost, V.crop.x0, 0, V.crop.w, s.H, 0, 0, V.cssW, V.dispH); ctx.globalAlpha=1; }
  function X(u){ return V.sx2c(u*p.colMM*PPM); }
  function Y(r){ return V.sy2c((A.sheet.AXIS_Y-r*p.rowMM-d.a.y0)*PPM); }
  function curve(fn, col, dash, lw){
    ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.setLineDash(dash||[]);
    ctx.beginPath();
    for(var i=0;i<=d.a.cols*10;i++){ var u=i/10; var x=X(u), y=Y(fn(p,u,A.cur)); if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  if(o.red && o.inc){ curve(A.sheet.right,'rgba(30,30,30,.7)',null,1.2); curve(A.sheet.left,'rgba(100,100,100,.7)',[6,4],1.2); }
  if(o.theory){ curve(A.sheet.sum,'#1f8a5b',[3,3],2); }
}

/* ---------- コマ一覧（WAVE-F-36） ---------- */
function renderThumbs(list){
  var p=P(), box=A.$('#thumbs'); box.innerHTML='';
  for(var n=0;n<p.n;n++){
    var it=list[n], el=document.createElement('div');
    if(!it){
      el.className='thumb missing';
      el.innerHTML='<div>'+A.sheet.label(p,n)+'<br>まだありません<br><label class="btn sm filebtn" style="margin-top:4px">追加<input type="file" accept="image/*" hidden data-n="'+n+'"></label></div>';
    } else {
      el.className='thumb'+(A.src&&A.src.kind==='flip'&&A.cur===n?' cur':'');
      el.innerHTML='<img alt=""><div class="tt"><span>'+A.sheet.label(p,n)+'</span><span class="tag'+(it.virtual?' warn':'')+'">'+it.how+'</span></div>'+
        (it.virtual?'':'<div class="acts"><label class="btn sm filebtn" style="min-height:28px;padding:1px 6px;font-size:.75rem">差し替え<input type="file" accept="image/*" hidden data-n="'+n+'"></label><button data-del="'+n+'">削除</button></div>');
      el.querySelector('img').src=it.thumb;
      (function(nn){ el.addEventListener('click',function(e){ if(e.target.closest('.acts')) return; A.stop(); A.goto(nn); }); })(n);
    }
    box.appendChild(el);
  }
  A.$$('input[type=file][data-n]',box).forEach(function(inp){
    inp.addEventListener('click',function(e){ e.stopPropagation(); });
    inp.addEventListener('change',function(e){ var n=parseInt(this.dataset.n,10); F.addFiles(e.target.files,n); e.target.value=''; });
  });
  A.$$('button[data-del]',box).forEach(function(b){
    b.addEventListener('click',function(e){ e.stopPropagation(); var n=parseInt(this.dataset.del,10); items[n]=null; rebuild(false); });
  });
}

/* ---------- 保存 ---------- */
function saveGhost(){
  var s=A.src; if(!s||s.kind!=='flip') return;
  var list=withVirtual(), d=dims(), g=buildGhost(list,d);
  var c=A.canvas(d.w,d.h), x=c.getContext('2d');
  x.putImageData(s.frames[A.cur],0,0); x.drawImage(g,0,0);
  A.saveCanvas(c,'ぱらぱら漫画_重ね.png');
}
/* ぱらぱら漫画を動画で保存（WAVE-F-51）：いまの見え方で3周ぶん */
async function saveVideo(){
  var s=A.src; if(!s||s.kind!=='flip') return;
  if(!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream){ A.toast('このブラウザでは動画で保存できません'); return; }
  var types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'], type='';
  for(var i=0;i<types.length;i++){ if(MediaRecorder.isTypeSupported(types[i])){ type=types[i]; break; } }
  var d=dims(), c=A.canvas(d.w,d.h), x=c.getContext('2d');
  var stream=c.captureStream(30), rec=new MediaRecorder(stream, type?{mimeType:type}:undefined), chunks=[];
  rec.ondataavailable=function(e){ if(e.data.size) chunks.push(e.data); };
  var fps=parseFloat(A.$('#selRate').value)||4, btn=A.$('#btnSaveFlipVid'); btn.disabled=true;
  rec.start();
  for(var loop=0;loop<3;loop++) for(var n=0;n<s.frames.length;n++){
    x.putImageData(s.frames[n],0,0); if(ghost) x.drawImage(ghost,0,0);
    await A.sleep(1000/fps);
  }
  rec.onstop=function(){
    btn.disabled=false;
    var mt=(rec.mimeType||type||'video/webm'), blob=new Blob(chunks,{type:mt});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='ぱらぱら漫画.'+(mt.indexOf('mp4')>=0?'mp4':'webm');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); },3000);
  };
  rec.stop();
}

/* ---------- 見本（サンプル4） ---------- */
F.openSample = function(){
  A.$('#selFlipPreset').value='t8'; A.$('#selSheetPreset').value='t8';
  preset=A.sheet.get('t8'); items=[]; flipCache={};
  var p=preset, d=dims(), seed=7;
  function rnd(){ seed=(seed*16807)%2147483647; return seed/2147483647-0.5; }
  for(var n=0;n<p.n;n++){
    var c=A.canvas(d.w,d.h), x=c.getContext('2d');
    A.sheet.drawArea(x,p,n,PPM);
    // 生徒が描いたような赤い線：縦線の上で足した値に点を打ち、なめらかにつなぐ
    var pts=[];
    for(var u=0;u<=d.a.cols;u++) pts.push([u*p.colMM*PPM+rnd()*2, (A.sheet.AXIS_Y-Math.round(A.sheet.sum(p,u,n))*p.rowMM-d.a.y0)*PPM+rnd()*3]);
    x.strokeStyle='#e0262b'; x.lineWidth=0.8*PPM; x.lineJoin='round'; x.lineCap='round';
    x.beginPath(); x.moveTo(pts[0][0],pts[0][1]);
    for(var i=0;i<pts.length-1;i++){
      var p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
      x.bezierCurveTo(p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6, p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6, p2[0], p2[1]);
    }
    x.stroke();
    x.fillStyle='#e0262b'; pts.forEach(function(q){ x.beginPath(); x.arc(q[0],q[1],1.1*PPM,0,Math.PI*2); x.fill(); });
    // 紙のむら（照明）
    var gr=x.createLinearGradient(0,0,d.w,d.h); gr.addColorStop(0,'rgba(255,240,210,0.0)'); gr.addColorStop(1,'rgba(120,110,90,0.18)');
    x.fillStyle=gr; x.fillRect(0,0,d.w,d.h);
    addItem(n, x.getImageData(0,0,d.w,d.h), '見本', '');
  }
  rebuild(true);
};

F.init = function(){
  A.vidOverlays.push(drawOv);
  A.$('#filePhotos').addEventListener('change',function(e){
    preset=A.sheet.get(A.$('#selFlipPreset').value);
    if(!A.src || A.src.kind!=='flip'){ items=[]; flipCache={}; }
    F.addFiles(e.target.files); e.target.value='';
  });
  A.$('#filePhotosAdd').addEventListener('change',function(e){ F.addFiles(e.target.files); e.target.value=''; });
  A.$('#selFlipPreset').addEventListener('change',function(){
    if(A.src && A.src.kind==='flip' && items.some(function(x){return x;})) A.toast('用紙の種類は、新しく写真を読み込むときに使われます');
  });
  ['chkRed','chkInc','chkGhost','chkComplete'].forEach(function(id){ A.$('#'+id).addEventListener('change',function(){ rebuild(false); }); });
  A.$('#chkTheory').addEventListener('change',function(){ A.view.renderOv(); });
  A.$('#btnSaveGhost').addEventListener('click',saveGhost);
  var b=document.createElement('button'); b.className='btn sm'; b.id='btnSaveFlipVid'; b.textContent='ぱらぱら漫画を動画で保存';
  A.$('#btnSaveGhost').insertAdjacentElement('afterend',b);
  b.addEventListener('click',saveVideo);
  A.on('frame',function(){
    if(!A.src||A.src.kind!=='flip') return;
    A.$$('#thumbs .thumb').forEach(function(el,i){ el.classList.toggle('cur', i===A.cur && !el.classList.contains('missing')); });
  });
  A.on('source',function(s){ if(s.kind!=='flip'){ ghost=null; } });
};

})(W);
