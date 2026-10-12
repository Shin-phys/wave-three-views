/* =========================================================
   画面の枠：タブ、設定欄の開閉（WAVE-N-02）
   ========================================================= */
(function(A){
'use strict';
var U = A.ui = {cur:'open'};

U.tab = function(name){
  U.cur=name;
  A.$$('#tabs button').forEach(function(b){
    var on=b.dataset.tab===name; b.classList.toggle('on',on); b.setAttribute('aria-selected',on?'true':'false');
  });
  A.$$('#panel .tabpane').forEach(function(p){ A.show(p, p.dataset.pane===name); });
  A.emit('tab', name);
};

U.setPanel = function(open){
  document.body.classList.toggle('panel-closed',!open);
  var b=A.$('#btnPanel');
  b.setAttribute('aria-expanded',open?'true':'false');
  b.textContent=open?'設定欄を畳む':'設定欄を開く';
  A.emit('panel',open);
};

U.init = function(){
  A.$$('#tabs button').forEach(function(b){ b.addEventListener('click',function(){ U.tab(b.dataset.tab); }); });
  A.$('#btnPanel').addEventListener('click',function(){ U.setPanel(document.body.classList.contains('panel-closed')); });
  // 開いたものに合わせてタブを移る
  A.on('source',function(s){
    if(s.kind==='flip') U.tab('flip');
    else if(U.cur==='open' || U.cur==='flip' || U.cur==='sheet') U.tab('guide');
  });
};

})(W);
