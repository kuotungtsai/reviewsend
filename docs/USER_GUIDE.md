# ReviewSend User Guide

**English** | [繁體中文](USER_GUIDE.zh-TW.md)

This guide is for the people who use ReviewSend day to day. No technical knowledge is needed, and installing and setting it up takes about 5 minutes.

## 1. What it is

ReviewSend (full name: ReviewSend: Recipient Check for Gmail) is a Chrome extension. Once it is installed, clicking Send in Gmail does not send the email straight away. A dialog first shows you every recipient, the subject and the attachments, and the email is only sent after a few seconds' countdown.

<img src="images/en/dialog-hero.png" alt="The confirmation dialog shown after clicking Send" width="620">

It helps you avoid:

- A mistyped recipient, or autocomplete picking a different person with the same name.
- Sending an internal email to someone outside the company.
- Sending to a company-wide group mailbox by accident.
- Sending one email to two different customers at once.

What it does not do:

- It does not send your email content or recipients anywhere. All checks happen on your own computer.
- It does not change your email.
- It does not stop you sending. You can click "Send now" at any time.

## 2. Install

You will be given a zip file named `reviewsend-x.x.x.zip`.

1. Extract the zip into a folder that will stay put, for example under Documents. **Do not delete or move this folder after installing**, or the extension will stop working.
2. Open Chrome, type `chrome://extensions` in the address bar and press Enter.
3. Turn on "Developer mode" at the top right (1 in the picture).
4. Click "Load unpacked", which appears at the top left (2 in the picture).

   <img src="images/en/install.png" alt="Developer mode and Load unpacked on the Extensions page" width="760">

5. In the window that opens, choose the folder you just extracted and click "Select Folder".
6. A "ReviewSend" card with a yellow shield icon appears on the page. That means it is installed, and the settings page opens automatically.
7. Click the puzzle icon to the right of the address bar, then the pin next to "ReviewSend", so the icon stays in the toolbar where you can see its status.

> Each time Chrome starts you may see a reminder to "Disable developer mode extensions". Close it; do not click Disable.

## 3. First-time setup

The settings page opens automatically after installing. To open it again later, click the shield icon in the toolbar and then "Open settings".

<img src="images/en/settings.png" alt="The settings page" width="760">

The interface follows your browser's language by default. To change it, use "語言 / Language" at the top right of the settings page and pick "English" or "繁體中文". It takes effect immediately.

### The quickest way: use a settings file someone gave you

If a colleague or your IT team gave you a `reviewsend-config.json`:

1. Click "Upload settings" at the bottom of the settings page and choose that file.
2. Check that the fields above have been filled in.
3. Click "Save".

### Setting it up yourself

Only item 1 really needs checking. The defaults are fine for the rest.

1. **Internal domains**: the part after `@` in your company address. If your address is `name@example.com`, enter `example.com`. This is how the extension decides who is "External". If left empty, the domain of the Gmail account you are signed in to is used.
2. **Countdown**: how many seconds the dialog waits before sending. The default is 15.
3. **Group addresses**: mailboxes that reach many people at once. Common names such as `all@` and `staff@` are included by default. Add any other group mailboxes your company has.
4. **Alert list**: recipients or domains you want to be extra careful with. Empty by default.
5. **Switches**: keeping both checked is recommended.

When you are done:

1. Type a few addresses into "Try it" (a colleague's, a customer's) and see whether the result is what you expect. This sends nothing.
2. Click "Save".
3. **Go back to your Gmail tab and reload it.** The settings do not take effect until you reload.

## 4. Check that it is working

Open Gmail and look at the bottom right of the shield icon in the toolbar:

<img src="images/en/icon-states.png" alt="The four states of the toolbar icon" width="620">

| Icon | Meaning | What to do |
|---|---|---|
| Green dot | Active | Nothing |
| Grey dot | Turned off | Check "Enable send confirmation" on the settings page and save |
| Red dot | May not be working | Check your recipients carefully yourself before sending, and tell whoever gave you the extension |
| No dot | Not active on this tab | If this is a Gmail tab, reload it |

Clicking the shield icon also tells you the current status in words:

<img src="images/en/popup.png" alt="The toolbar popup showing Active" width="300">

The most direct check: send an email to yourself. If the dialog appears after you click Send, everything is fine.

## 5. Everyday use

Write your email as usual and click Send or press Ctrl+Enter. You will see the confirmation dialog:

<img src="images/en/dialog-normal.png" alt="The confirmation dialog in the normal case" width="600">

Look at these things:

- **The number of recipients in the title**: is it what you expected?
- **To, Cc and Bcc**: is every address someone you mean to send to?
- **Red "External" tags**: these people are outside your company. Are you sure?
- **Subject and attachments**: did you forget an attachment, or attach the wrong file?

Then you can:

| What you want | What to do |
|---|---|
| Everything is fine, let it send | Nothing. It sends when the countdown ends |
| You do not want to wait | Click "Send now" |
| Something is wrong and you want to fix it | Click "Cancel, keep editing", or press Esc |
| You want to check slowly without the countdown | Click the recipient list; the countdown pauses |

After cancelling, nothing is sent. You are back in the compose window with everything still there.

## 6. When there is a red warning

<img src="images/en/dialog-warning.png" alt="The confirmation dialog with a red warning" width="600">

When there is a red box at the top of the dialog, **there is no countdown and nothing is sent automatically**. You have to look, then click "Send now" or "Cancel, keep editing" yourself.

Red warnings appear in these cases:

| Warning | What it means | Suggestion |
|---|---|---|
| Includes group address | A recipient is a group mailbox that reaches many people | Make sure you really mean to send to the whole group |
| Includes alert-list address | A recipient is on your alert list | Check the content and attachments once more. After "Send now" there is a further 5-second countdown, during which "Cancel, keep editing" still stops it |
| Going to several different external domains | The email goes to two or more outside organisations at once | Make sure customer A's email is not also going to customer B |
| No recipients could be read | The extension does not understand the current Gmail screen | Check the recipients in the compose window yourself, and tell whoever gave you the extension |

## 7. When there are many recipients

<img src="images/en/dialog-long.png" alt="The confirmation dialog with many recipients" width="600">

When the recipients do not fit on one screen, the countdown does not start and the text at the bottom asks you to scroll down. The countdown starts only once you have scrolled to the end, so that every recipient has been in front of you.

If you are sure and do not want to scroll, you can click "Send now" straight away.

## 8. Common questions

**I clicked Send, no dialog appeared, and the email went out.**<br>
Check the shield icon's status first (section 4). The most common cause is not reloading the Gmail tab after installing or updating. Also, emails sent with "Schedule send" are not intercepted.

**The email has gone and only now do I see a problem. What can I do?**<br>
Gmail's own "Undo send" still works. After an email is sent, "Undo" appears briefly at the bottom left of the screen; click it before it disappears to take the email back. You can lengthen the undo period to as much as 30 seconds in Gmail's settings.

**The shield icon shows a red dot.**<br>
Gmail's screen may have changed and the extension no longer recognises the Send button, so emails may go out without the dialog. Check your recipients carefully yourself before sending, and tell whoever gave you the extension.

**Can the extension see the content of my emails?**<br>
It only reads the recipients, the subject and the attachment file names in the compose window, so that it can show them in the dialog. This information never leaves your computer; the extension has no way of connecting to anything outside.

**I want to turn it off for a while.**<br>
Uncheck "Enable send confirmation" on the settings page and save. The icon shows a grey dot. Check it again to turn it back on. If the option is greyed out, your company's IT team has set it for everyone.

**Waiting 15 seconds every time is too long.**<br>
Shorten the countdown on the settings page, or click "Send now" each time once you have checked. Setting it very short is not recommended, because you will not have time to read.

**Some settings are greyed out and say "Set by your administrator".**<br>
These are pushed by your company's IT team. You cannot change or remove them, but for the list fields you can still add entries of your own.

**Does the dialog appear when I send from my phone?**<br>
No. The extension only works on Gmail in desktop Chrome. The mobile apps are not protected.

**I have two Chrome profiles (for example work and personal).**<br>
Install and set it up once in each profile.

**Can I switch the interface to Chinese?**<br>
Yes. "語言 / Language" at the top right of the settings page offers Auto, 繁體中文 and English. It is a personal preference and is not written to the downloaded settings file.

**How do I update to a new version?**<br>
Extract the new zip over the original folder, click the reload button on the "ReviewSend" card at `chrome://extensions`, then reload your Gmail tab. Your settings are kept.

**How do I remove it?**<br>
Go to `chrome://extensions` and click "Remove" on the "ReviewSend" card.

## 9. Quick reference

| Situation | What happens |
|---|---|
| An ordinary email | Recipients are listed, then it sends after the countdown |
| External recipients | Tagged "External" with a note; still sends after the countdown |
| A group address, an alert-list address, or several external domains | Red warning; not sent automatically; you have to click |
| Recipients do not fit on one screen | The countdown starts only after scrolling to the end |
| Esc or "Cancel, keep editing" | Nothing is sent; back to the compose window |
| "Send now" | Sent immediately |
| Schedule send, mobile apps | Not intercepted |
