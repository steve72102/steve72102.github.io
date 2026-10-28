const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port=Number(process.env.MQ_PREVIEW_PORT||4173);
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json','.zip':'application/zip'};
http.createServer((req,res)=>{
  let name;
  try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
  let target=path.resolve(root,'.'+name);
  if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);return res.end();}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  if(!fs.existsSync(target)){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(target).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+port+'/game/'));
