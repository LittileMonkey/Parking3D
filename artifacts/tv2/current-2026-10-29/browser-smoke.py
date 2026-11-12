from pathlib import Path
import json
from playwright.sync_api import sync_playwright

out=Path('artifacts/tv2/current-2026-10-29/browser')
out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':900},record_video_dir=str(out/'video'))
    page=context.new_page()
    page_errors=[]
    page.on('pageerror',lambda error:page_errors.append(str(error)))
    for name,route in [('home','/'),('search','/search'),('booking','/booking'),('staff','/staff')]:
        response=page.goto('http://127.0.0.1:5178'+route,wait_until='networkidle',timeout=30000)
        page.screenshot(path=str(out/(name+'-desktop.png')),full_page=True)
        results.append({'name':name,'status':response.status,'finalPath':page.url.replace('http://127.0.0.1:5178',''),
                        'title':page.title(),'buttons':page.get_by_role('button').all_text_contents(),
                        'headings':page.get_by_role('heading').all_text_contents(),
                        'text':page.locator('body').inner_text()[:2200]})
    page.set_viewport_size({'width':390,'height':844})
    page.goto('http://127.0.0.1:5178/search',wait_until='networkidle')
    page.screenshot(path=str(out/'search-mobile.png'),full_page=True)
    results.append({'name':'search-mobile','documentWidth':page.evaluate('document.documentElement.scrollWidth'),'viewport':390})
    context.close()
    browser.close()
(out/'results.json').write_text(json.dumps({'scope':'Frontend rendering only; real backend not attached; no API mocks','routes':results,'pageErrors':page_errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('BROWSER_SMOKE_COMPLETE; details in browser/results.json')
