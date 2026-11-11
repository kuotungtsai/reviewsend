import asyncio, sys, os, tempfile, pathlib
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).resolve().parent
EXT = str(HERE.parent / 'extension')
MOCK = (HERE / 'mock_gmail.html').read_text(encoding='utf-8')
# 預設用 Playwright 內建 Chromium（先執行 `playwright install chromium`）。
# 要改用本機 Chrome，請設環境變數 CHROME_PATH 指向 chrome 執行檔。
CHROME = os.environ.get('CHROME_PATH') or None
results = []

def check(name, cond, extra=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra else ''))

async def overlay_text(page):
    return await page.evaluate("() => { const h = document.getElementById('gsg-overlay-host'); return h ? h.shadowRoot.textContent.replace(/\\s+/g,' ') : null; }")

async def shadow_click(page, sel):
    await page.evaluate(f"() => document.getElementById('gsg-overlay-host').shadowRoot.querySelector('{sel}').click()")

async def main():
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            tempfile.mkdtemp(), executable_path=CHROME, headless=False,
            args=['--headless=new', f'--disable-extensions-except={EXT}', f'--load-extension={EXT}',
                  '--disable-features=DisableLoadExtensionCommandLineSwitch', '--no-sandbox'])
        await ctx.route('https://mail.google.com/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=MOCK))
        page = await ctx.new_page()

        async def load(scen):
            await page.goto(f'https://mail.google.com/mail/u/0/#{scen}')
            await page.evaluate("() => { location.reload(); }")
            await page.wait_for_load_state('load')
            await page.wait_for_timeout(500)

        # 1. click send -> dialog, no immediate send, auto-send after countdown
        await load('normal')
        await page.click('#send')
        await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('dialog opens on click', t is not None)
        check('not sent immediately', await page.evaluate('window.__sent') == 0)
        print('   dialog:', t)
        check('lists To/Cc recipients', t and 'bob@example.com' in t and 'pm@customer-a.com' in t and 'carol.lin@example.com' in t)
        check('quoted body address excluded', t and 'quoted@other.com' not in t)
        check('external tagged (info only)', t and '外部' in t and '1 位外部收件人' in t)
        check('subject + attachment shown', t and 'Q3 測試報告' in t and 'report_v3.xlsx' in t)
        check('countdown running', t and '秒後自動寄出' in t)
        await page.wait_for_timeout(15500)
        check('auto-sent after 15s', await page.evaluate('window.__sent') == 1, f"sent={await page.evaluate('window.__sent')}")
        check('dialog closed after send', await overlay_text(page) is None)

        # 2. send now
        await load('normal')
        await page.click('#send'); await page.wait_for_timeout(300)
        await shadow_click(page, '.send'); await page.wait_for_timeout(300)
        check('send-now sends immediately', await page.evaluate('window.__sent') == 1)

        # 3. cancel
        await load('normal')
        await page.click('#send'); await page.wait_for_timeout(300)
        await shadow_click(page, '.cancel'); await page.wait_for_timeout(16000)
        check('cancel -> never sent', await page.evaluate('window.__sent') == 0)

        # 4. Ctrl+Enter in body, then Esc
        await load('normal')
        await page.click('#body'); await page.keyboard.press('Control+Enter'); await page.wait_for_timeout(300)
        check('Ctrl+Enter opens dialog', await overlay_text(page) is not None)
        check('Ctrl+Enter not sent', await page.evaluate('window.__sent') == 0)
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        check('Esc cancels dialog', await overlay_text(page) is None)
        check('Esc did not close Gmail compose', await page.evaluate('window.__closed') is False)
        await page.wait_for_timeout(15500)
        check('still not sent after Esc', await page.evaluate('window.__sent') == 0)

        # 5. group address -> hold, no auto-send
        await load('group')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        print('   dialog:', t)
        check('group warning shown', t and '群組地址' in t and 'all@example.com' in t)
        check('hold message shown', t and '不會自動寄出' in t)
        await page.wait_for_timeout(16000)
        check('group: not auto-sent', await page.evaluate('window.__sent') == 0)
        await shadow_click(page, '.send'); await page.wait_for_timeout(300)
        check('group: manual send works', await page.evaluate('window.__sent') == 1)

        # 6. mixed external domains -> hold
        await load('mixed')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('multi-domain warning + hold', t and '2 個不同的外部網域' in t and '不會自動寄出' in t)

        # 7. pause by clicking list
        await load('normal')
        await page.click('#send'); await page.wait_for_timeout(300)
        await page.evaluate("() => document.getElementById('gsg-overlay-host').shadowRoot.querySelector('.bd').click()")
        await page.wait_for_timeout(16000)
        check('click list pauses countdown', await page.evaluate('window.__sent') == 0 and '已暫停' in (await overlay_text(page) or ''))

        # 8. dropdown arrow not intercepted
        await shadow_click(page, '.cancel'); await page.wait_for_timeout(200)
        await page.click('#more'); await page.wait_for_timeout(200)
        check('more-options arrow not intercepted', await overlay_text(page) is None)

        # 9. long list -> countdown waits until scrolled to bottom
        await load('many')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('long list: asks to scroll first', t and '100 位收件人' in t and '往下捲到最後' in t)
        await page.wait_for_timeout(16000)
        check('long list: not sent before scrolling', await page.evaluate('window.__sent') == 0)
        await page.evaluate("() => { const b = document.getElementById('gsg-overlay-host').shadowRoot.querySelector('.bd'); b.scrollTop = b.scrollHeight; }")
        await page.wait_for_timeout(500)
        check('long list: countdown starts at bottom', '秒後自動寄出' in (await overlay_text(page) or ''))
        await page.wait_for_timeout(15500)
        check('long list: auto-sent after scrolling', await page.evaluate('window.__sent') == 1)

        # 10. long list -> send-now still works without scrolling
        await load('many')
        await page.click('#send'); await page.wait_for_timeout(300)
        await shadow_click(page, '.send'); await page.wait_for_timeout(300)
        check('long list: send-now works without scrolling', await page.evaluate('window.__sent') == 1)

        # 10b. recipient removed while the field is expanded: the hidden summary still holds the old address
        await load('stale')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('stale summary: removed recipient is not listed', t and '3 位收件人' in t and 'gone@' not in t)
        check('stale summary: real recipients still listed', t and 'bob@example.com' in t and 'pm@customer-a.com' in t and 'carol.lin@example.com' in t)

        # 10c. collapsed field: chips hidden, summary visible -> no duplicates, Cc stays in Cc
        await load('collapsed')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('collapsed: counts each recipient once', t and '3 位收件人' in t and '收件者（2）' in t and '副本（1）' in t)

        # 10d. older markup without role=option chips still works
        await load('legacy')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('legacy markup: recipients still read', t and '3 位收件人' in t and '副本（1）' in t)

        # 11. special-alert recipient -> "send now" waits 5 more seconds and can be cancelled
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event('serviceworker')
        await sw.evaluate("() => chrome.storage.sync.set({ alertPatterns: 'vip@example.org' })")
        await load('alert')
        await page.click('#send'); await page.wait_for_timeout(300)
        t = await overlay_text(page)
        check('alert: warning shown and held', t and '特別警示' in t and '不會自動寄出' in t)
        await shadow_click(page, '.send'); await page.wait_for_timeout(500)
        t = await overlay_text(page)
        check('alert: send-now starts a 5s countdown', await page.evaluate('window.__sent') == 0 and t and '秒後寄出' in t)
        await page.wait_for_timeout(5500)
        check('alert: sent after the extra countdown', await page.evaluate('window.__sent') == 1)

        await load('alert')
        await page.click('#send'); await page.wait_for_timeout(300)
        await shadow_click(page, '.send'); await page.wait_for_timeout(1500)
        await shadow_click(page, '.cancel'); await page.wait_for_timeout(6000)
        check('alert: cancel during the extra countdown -> not sent', await page.evaluate('window.__sent') == 0 and await overlay_text(page) is None)

        # non-alert warnings (group) still send immediately on "send now"
        await load('group')
        await page.click('#send'); await page.wait_for_timeout(300)
        await shadow_click(page, '.send'); await page.wait_for_timeout(300)
        check('group without alert: send-now is still immediate', await page.evaluate('window.__sent') == 1)
        await sw.evaluate("() => chrome.storage.sync.set({ alertPatterns: '' })")

        await ctx.close()
    failed = [n for n, ok in results if not ok]
    print(f'\n{len(results) - len(failed)}/{len(results)} passed')
    sys.exit(1 if failed else 0)

asyncio.run(main())
