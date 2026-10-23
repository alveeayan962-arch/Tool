// Learnory Post Factory service worker
var VER='lpf-v1';
var SHELL=['./','index.html','manifest.webmanifest'];
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
  e.waitUntil(caches.open('lpf-data').then(function(c){return c.match('campaigns.json')}).then(function(r){return r?r.json():null}).then(function(d){
    if(!d||!d.list)return;
    var now=new Date(),td=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tasks=[];
    var tdIso=now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
    d.list.forEach(function(c){
      var a=c.start.split('-'),st=new Date(+a[0],+a[1]-1,+a[2]),idx=Math.round((td-st)/864e5)+1;
      if(idx>c.days&&c.snooze!==tdIso)tasks.push(self.registration.showNotification(c.name+': ক্যাম্পেইন শেষ',{body:'আবার মার্কেটিং শুরু করুন। অ্যাপ খুলে নতুন সিরিজ বানান।',tag:'end-'+c.name,requireInteraction:true,vibrate:[300,150,300,150,300],lang:'bn'}));
      else if(idx>=1&&idx<=c.days)tasks.push(self.registration.showNotification(c.name+': আজকের পোস্ট দিন',{body:'দিন '+idx+'/'+c.days,tag:'day-'+c.name,lang:'bn'}));
    });
    return Promise.all(tasks);
  }));
});
