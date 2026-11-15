const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const out=process.argv[2], secs=+process.argv[3]||22, W=+process.argv[4]||1920, H=Math.round(W*9/16);
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({args:['--force-device-scale-factor=1']});
 const p=await b.newPage({viewport:{width:W,height:H}});
 const c=await p.context().newCDPSession(p);
 const frames=[];let n=0;
 c.on('Page.screencastFrame',async f=>{
   const i=n++;frames.push(f.metadata.timestamp);
   fs.writeFileSync(`${out}/f${String(i).padStart(5,'0')}.jpg`,Buffer.from(f.data,'base64'));
   c.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});
 });
 await p.goto('file://'+process.argv[5],{waitUntil:'load'});
 await c.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:W,maxHeight:H,everyNthFrame:1});
 await p.waitForTimeout(secs*1000);
 await c.send('Page.stopScreencast');
 fs.writeFileSync(out+'/ts.json',JSON.stringify(frames));
 console.log('frames',n,'fps medio',(n/secs).toFixed(1));
 await b.close();
})();
