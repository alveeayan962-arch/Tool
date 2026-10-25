// Learnory Caption Studio service worker
var VER='lpf-v5';
var SHELL=['./','index.html','manifest.webmanifest','fonts/HindSiliguri-500.woff2','fonts/HindSiliguri-600.woff2','fonts/HindSiliguri-700.woff2'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(VER).then(function(c){return Promise.all(SHELL.map(function(u){return c.add(u).catch(function(){})}))}).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf('lpf-v')===0&&k!==VER}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  // fonts: cache first, refresh in background
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open('lpf-fonts').then(function(c){
      return c.match(req).then(function(hit){
        var net=fetch(req).then(function(r){if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(function(){return hit});
        return hit||net;
      });
    }));
    return;
  }
  if(url.origin!==location.origin)return;
  // app files: network first (so a new upload shows up), cache as offline fallback
  e.respondWith(fetch(req).then(function(r){
    if(r&&r.ok){var cp=r.clone();caches.open(VER).then(function(c){c.put(req,cp)})}
    return r;
  }).catch(function(){
    return caches.match(req,{ignoreSearch:true}).then(function(hit){return hit||(req.mode==='navigate'?caches.match('index.html'):undefined)||caches.match('./')});
  }));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cl){
    for(var i=0;i<cl.length;i++){if('focus' in cl[i])return cl[i].focus()}
    return self.clients.openWindow('./');
  }));
});
// best-effort background check (Chrome decides if/when this runs on an installed app)
self.addEventListener('periodicsync',function(e){
  if(e.tag!=='lpf-check')return;
  e.waitUntil(caches.open('lpf-data').then(function(c){return Promise.all([c.match('campaigns.json'),c.match('reminders.json')])}).then(function(rs){
    return Promise.all(rs.map(function(r){return r?r.json():null}));
  }).then(function(ds){
    var d=ds[0],R=ds[1],now=new Date(),td=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tasks=[];
    var tdIso=now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
    if(d&&d.list)d.list.forEach(function(c){
      var a=c.start.split('-'),st=new Date(+a[0],+a[1]-1,+a[2]),idx=Math.round((td-st)/864e5)+1;
      if(idx>c.days&&c.snooze!==tdIso)tasks.push(self.registration.showNotification(c.name+': campaign ended',{body:'Start marketing again: open the app and generate a new series.',tag:'end-'+c.name,requireInteraction:true,vibrate:[300,150,300,150,300]}));
      else if(idx>=1&&idx<=c.days&&!(c.posted||[]).includes(tdIso))tasks.push(self.registration.showNotification(c.name+': post today',{body:'Day '+idx+' of '+c.days,tag:'day-'+c.name}));
    });
    if(R&&R.list)R.list.forEach(function(r){
      if(r.rep&&r.rep!=='none')return; // repeating reminders are checked inside the app
      var a=r.date.split('-'),t=(r.time||'10:00').split(':'),at=new Date(+a[0],+a[1]-1,+a[2],+t[0],+t[1]).getTime();
      if(at<=Date.now()&&at>(r.ack||0))tasks.push(self.registration.showNotification('⏰ '+(r.prod?r.prod+': ':'')+(r.note||'Marketing reminder'),{body:'Open Caption Studio',tag:'rem-'+r.id,requireInteraction:true,vibrate:[300,150,300,150,300]}));
    });
    return Promise.all(tasks);
  }));
});
