const assert=require('node:assert/strict');
const { chromium } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/booking'); await page.waitForLoadState('networkidle');
 await page.locator('canvas').waitFor();
 await page.getByRole('button',{name:'A01 Còn trống',exact:true}).click();
 assert.equal(await page.locator('.booking-detail-title strong').innerText(),'A01');
 await page.getByRole('button',{name:'Nhìn từ trên cao',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Nhìn từ trên cao',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Đặt lại góc nhìn',exact:true}).click();
 await page.getByRole('button',{name:'2D',exact:true}).click();
 await page.locator('.booking-flat').getByRole('button',{name:'A04 Bảo trì',exact:true}).click();
 assert.equal(await page.locator('.booking-detail-title strong').innerText(),'A04');
 await page.screenshot({path:'artifacts/parking-preview-2d.png',fullPage:true});
 await page.getByRole('button',{name:'3D',exact:true}).click();
 assert.equal(await page.locator('.booking-detail-title strong').innerText(),'A04');
 await page.getByRole('button',{name:'Bỏ chọn',exact:true}).click();
 await page.screenshot({path:'artifacts/parking-preview-desktop.png',fullPage:true});
 for(const width of [390,320]) {
  await page.setViewportSize({width,height:844});
  await page.screenshot({path:`artifacts/parking-preview-mobile-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
  await page.getByRole('button',{name:'2D',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'2D overflow at '+width);
  await page.getByRole('button',{name:'3D',exact:true}).click();
 }
 const fallback=await browser.newPage();
 await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.startsWith('webgl'))return null;return original.call(this,type,...args)}});
 await fallback.goto('http://127.0.0.1:5174/booking');
 await fallback.getByRole('alert').waitFor();
 assert.equal(await fallback.getByRole('button',{name:'3D',exact:true}).isDisabled(),true);
 await fallback.locator('.booking-flat').getByRole('button',{name:'A01 Còn trống',exact:true}).click();
 assert.equal(await fallback.locator('.booking-detail-title strong').innerText(),'A01');
 assert.deepEqual(errors,[]);
 console.log('PASS: selection, camera/reset, 2D/3D selection persistence, 390px/320px overflow, WebGL fallback; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

