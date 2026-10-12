/* =========================================================
   ぱらぱら漫画の用紙（03-flipbook.md §3〜§4、WAVE-F-60〜F-63）
   用紙の寸法はすべて mm で持つ。A4 横（297×210 mm）。
   四隅に ArUco マーカー（ARUCO_MIP_36h12）。コマ番号 n の用紙は ID 4n〜4n+3
   （4n＝左上、4n+1＝右上、4n+2＝右下、4n+3＝左下）。
   方眼はうすい水色、入射波は右向き＝黒の実線、左向き＝灰の破線。
   ========================================================= */
(function(A){
'use strict';
var S = A.sheet = {};

S.PAGE = {w:297, h:210};
S.MK = {size:20, cell:2.5};          // マーカーの黒い四角の一辺、1マス（白い縁＝1マス）
/* マーカーの黒い四角の左上（mm）。0:左上 1:右上 2:右下 3:左下 */
S.MK_POS = [[10,10],[267,10],[267,180],[10,180]];
S.AXIS_Y = 105;                      // 横軸（つりあいの位置）の y（mm）

S.PRESETS = [
  {id:'t8',  name:'標準：8コマ（T/8 ごと）',   n:8,  cpl:8,  amp:7, colMM:15, rowMM:5, lams:2,
   vals:'0、±5、±7'},
  {id:'t12', name:'代案：12コマ（T/12 ごと）', n:12, cpl:12, amp:8, colMM:10, rowMM:4, lams:2,
   vals:'0、±4、±7、±8'}
];
S.get = function(id){ return S.PRESETS.filter(function(p){return p.id===id;})[0] || S.PRESETS[0]; };

/* 作図範囲（mm）：方眼の左端〜右端、縦は合成波の最大（2A）より1目盛り広く */
S.area = function(p){
  var cols=p.cpl*p.lams, w=cols*p.colMM, x0=(S.PAGE.w-w)/2;
  var half=(2*p.amp+1)*p.rowMM;
  return {x0:x0, y0:S.AXIS_Y-half, w:w, h:2*half, cols:cols, half:half};
};

/* 入射波・合成波（縦の目盛り数で返す）。u は横の目盛り（0〜cols）、n はコマ番号 */
S.right = function(p,u,n){ return p.amp*Math.sin(2*Math.PI*(u/p.cpl - n/p.n)); };
S.left  = function(p,u,n){ return p.amp*Math.sin(2*Math.PI*(u/p.cpl + n/p.n)); };
S.sum   = function(p,u,n){ return S.right(p,u,n)+S.left(p,u,n); };

/* マーカーの4つの角（mm）。検出器の角の順（左上→右上→右下→左下）と同じ */
S.markerCorners = function(k){
  var x=S.MK_POS[k][0], y=S.MK_POS[k][1], s=S.MK.size;
  return [[x,y],[x+s,y],[x+s,y+s],[x,y+s]];
};
/* 手動指定で使う「外側の角」（左上の左上、右上の右上、…） */
S.outerCorners = function(){
  return [0,1,2,3].map(function(k){ return S.markerCorners(k)[k]; });
};

S.label = function(p,n){ return 't = '+(n===0?'0':(n+'T/'+p.n)); };

/* ---------- SVG（印刷用） ---------- */
var dict=null;
function markerSVG(id, x, y){
  if(!dict) dict=new AR.Dictionary('ARUCO_MIP_36h12');
  var code=dict.codeList[id], n=dict.markSize-2, c=S.MK.cell;   // n=6
  var out='<g transform="translate('+(x-c)+','+(y-c)+')">';
  out+='<rect width="'+(c*(n+4))+'" height="'+(c*(n+4))+'" fill="#fff"/>';
  out+='<rect x="'+c+'" y="'+c+'" width="'+(c*(n+2))+'" height="'+(c*(n+2))+'" fill="#000"/>';
  for(var yy=0;yy<n;yy++) for(var xx=0;xx<n;xx++){
    if(code[yy*n+xx]==='1') out+='<rect x="'+(c*(xx+2))+'" y="'+(c*(yy+2))+'" width="'+(c+0.02)+'" height="'+(c+0.02)+'" fill="#fff"/>';
  }
  return out+'</g>';
}
function wavePath(p, fn, n){
  var a=S.area(p), d='', steps=a.cols*12;
  for(var i=0;i<=steps;i++){
    var u=i/12, x=a.x0+u*p.colMM, y=S.AXIS_Y-fn(p,u,n)*p.rowMM;
    d+=(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2);
  }
  return d;
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

S.pageSVG = function(p, n){
  var a=S.area(p), W=S.PAGE.w, H=S.PAGE.h;
  var o='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'mm" height="'+H+'mm" font-family="sans-serif">';
  o+='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
  // 方眼（うすい水色。読み取りのときに色で消せる）
  var g='';
  for(var r=-(2*p.amp+1); r<=2*p.amp+1; r++){
    var y=S.AXIS_Y-r*p.rowMM;
    g+='<line x1="'+a.x0+'" y1="'+y+'" x2="'+(a.x0+a.w)+'" y2="'+y+'" stroke="'+(r===0?'#5cb8e0':'#b8e2f4')+'" stroke-width="'+(r===0?0.45:0.25)+'"/>';
  }
  for(var u=0; u<=a.cols; u++){
    var x=a.x0+u*p.colMM;
    g+='<line x1="'+x+'" y1="'+a.y0+'" x2="'+x+'" y2="'+(a.y0+a.h)+'" stroke="#9fd6ee" stroke-width="0.3"/>';
  }
  o+=g;
  // 縦の目盛りの数字（5ごと）
  for(var q=-2*p.amp; q<=2*p.amp; q++){
    if(q%5) continue;
    o+='<text x="'+(a.x0-1.5)+'" y="'+(S.AXIS_Y-q*p.rowMM+1.1)+'" font-size="3" fill="#5cb8e0" text-anchor="end">'+q+'</text>';
  }
  // 入射波
  o+='<path d="'+wavePath(p,S.right,n)+'" fill="none" stroke="#111" stroke-width="0.55"/>';
  o+='<path d="'+wavePath(p,S.left,n)+'" fill="none" stroke="#666" stroke-width="0.55" stroke-dasharray="2.4 1.6"/>';
  // マーカー
  for(var k=0;k<4;k++) o+=markerSVG(4*n+k, S.MK_POS[k][0], S.MK_POS[k][1]);
  // 文字
  o+='<text x="'+(W/2)+'" y="20" font-size="6.5" text-anchor="middle" font-weight="bold">'+esc(S.label(p,n))+'</text>';
  o+='<text x="'+(W/2)+'" y="27" font-size="3.4" text-anchor="middle" fill="#333">向かい合う2つの波　　コマ '+(n+1)+' / '+p.n+'</text>';
  o+='<text x="190" y="17" font-size="3.4" fill="#333">班・名前</text><line x1="205" y1="18" x2="258" y2="18" stroke="#999" stroke-width="0.3"/>';
  // 凡例
  var ly=193;
  o+='<line x1="70" y1="'+ly+'" x2="88" y2="'+ly+'" stroke="#111" stroke-width="0.55"/><path d="M88 '+ly+' l-2.4 -1.3 v2.6z" fill="#111"/>';
  o+='<text x="91" y="'+(ly+1.2)+'" font-size="3.4" fill="#333">右へ進む波</text>';
  o+='<line x1="130" y1="'+ly+'" x2="148" y2="'+ly+'" stroke="#666" stroke-width="0.55" stroke-dasharray="2.4 1.6"/><path d="M130 '+ly+' l2.4 -1.3 v2.6z" fill="#666"/>';
  o+='<text x="151" y="'+(ly+1.2)+'" font-size="3.4" fill="#333">左へ進む波</text>';
  o+='<text x="190" y="'+(ly+1.2)+'" font-size="3.4" fill="#c00">2つを足した波は赤で描く</text>';
  return o+'</svg>';
};

/* 教師用の表紙（§3.1、§4.3） */
S.coverSVG = function(p){
  var W=S.PAGE.w, H=S.PAGE.h, o='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'mm" height="'+H+'mm" font-family="sans-serif">';
  o+='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
  o+='<text x="20" y="24" font-size="7" font-weight="bold">ぱらぱら漫画の用紙　教師用（この紙は配らない）</text>';
  var lines=[
    '種類：'+p.name+'（'+p.n+'枚）。横の1目盛り = λ/'+p.cpl+'、振幅 A = 縦'+p.amp+'目盛り。',
    '入射波は1コマで横1目盛りずつ進む。作図する値（縦の目盛り）は '+p.vals+'。',
    '生徒は縦線の上で2つの波の高さを足し、赤で点を打ってなめらかにつなぐ。',
    '・t = '+(p.n/4)+'T/'+p.n+'（T/4）のコマでは、合成波が全面で0になる。描き間違いと思いやすいので声をかける。',
    '・人数が少ないときは、前半の'+(p.n/2)+'枚だけ描き、アプリの教師用の設定「残りのコマを補う」を使う。',
    '・印刷は「倍率100%」「余白なし（または最小）」で。黒い四角（マーカー）が欠けないこと。',
    '・撮影：用紙全体と四隅の黒い四角が入るように、なるべく真上から撮る。影や反射に注意。'
  ];
  lines.forEach(function(t,i){ o+='<text x="20" y="'+(38+i*8)+'" font-size="4.2">'+esc(t)+'</text>'; });
  // 分担表
  var y0=104, cw=Math.min(30,250/p.n);
  o+='<text x="20" y="'+(y0-4)+'" font-size="4.2" font-weight="bold">分担表</text>';
  for(var n=0;n<p.n;n++){
    var x=20+n*cw;
    o+='<rect x="'+x+'" y="'+y0+'" width="'+cw+'" height="22" fill="none" stroke="#888" stroke-width="0.3"/>';
    o+='<text x="'+(x+cw/2)+'" y="'+(y0+6)+'" font-size="3.4" text-anchor="middle">'+esc(S.label(p,n))+'</text>';
  }
  return o+'</svg>';
};

/* ---------- ラスター（サンプル用）：作図範囲だけを描く ---------- */
/* ctx は作図範囲の左上を原点にし、1 mm = ppm 画素 */
S.drawArea = function(ctx, p, n, ppm, opt){
  opt=opt||{};
  var a=S.area(p);
  function X(u){ return u*p.colMM*ppm; }
  function Y(r){ return (S.AXIS_Y-r*p.rowMM-a.y0)*ppm; }
  ctx.fillStyle=opt.paper||'#fff'; ctx.fillRect(0,0,a.w*ppm,a.h*ppm);
  ctx.lineWidth=Math.max(1,0.25*ppm);
  for(var r=-(2*p.amp+1); r<=2*p.amp+1; r++){
    ctx.strokeStyle=r===0?'#5cb8e0':'#b8e2f4'; ctx.lineWidth=(r===0?0.45:0.25)*ppm;
    ctx.beginPath(); ctx.moveTo(0,Y(r)); ctx.lineTo(a.w*ppm,Y(r)); ctx.stroke();
  }
  ctx.strokeStyle='#9fd6ee'; ctx.lineWidth=0.3*ppm;
  for(var u=0;u<=a.cols;u++){ ctx.beginPath(); ctx.moveTo(X(u),0); ctx.lineTo(X(u),a.h*ppm); ctx.stroke(); }
  function wave(fn,col,dash){
    ctx.strokeStyle=col; ctx.lineWidth=0.55*ppm; ctx.setLineDash(dash?[2.4*ppm,1.6*ppm]:[]);
    ctx.beginPath();
    for(var i=0;i<=a.cols*12;i++){ var uu=i/12, x=X(uu), y=Y(fn(p,uu,n)); if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  wave(S.right,'#111',false); wave(S.left,'#666',true);
};

/* ---------- 印刷 ---------- */
S.print = function(){
  var p=S.get(A.$('#selSheetPreset').value), area=A.$('#printArea'), html='';
  if(A.$('#chkCover').checked) html+='<div class="page">'+S.coverSVG(p)+'</div>';
  for(var n=0;n<p.n;n++) html+='<div class="page">'+S.pageSVG(p,n)+'</div>';
  area.innerHTML=html;
  setTimeout(function(){ window.print(); },50);
};

function preview(){
  var p=S.get(A.$('#selSheetPreset').value);
  A.$('#sheetPrev').innerHTML=S.pageSVG(p, 1).replace(/width="297mm" height="210mm"/,'');
}
function fillPresets(sel){
  sel.innerHTML=S.PRESETS.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
}

S.init = function(){
  fillPresets(A.$('#selSheetPreset'));
  fillPresets(A.$('#selFlipPreset'));
  A.$('#selSheetPreset').addEventListener('change',function(){ A.$('#selFlipPreset').value=this.value; preview(); });
  A.$('#selFlipPreset').addEventListener('change',function(){ A.$('#selSheetPreset').value=this.value; preview(); });
  A.$('#btnPrint').addEventListener('click',S.print);
  A.on('tab',function(t){ if(t==='sheet') preview(); });
  window.addEventListener('afterprint',function(){ A.$('#printArea').innerHTML=''; });
};

})(W);
