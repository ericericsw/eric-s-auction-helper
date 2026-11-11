# eric's Auction Helper

A userscript for bidding in eric's Auto Equip Auction threads on the E-Hentai forums.

拍賣討論串的喊價輔助腳本。

## Install / 安裝

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser and finish the setup it asks for
   (some browsers require you to allow userscripts / extensions developer mode).
   安裝瀏覽器用的 Tampermonkey，並完成它要求的設定（部分瀏覽器需要允許執行使用者腳本或開啟擴充功能的開發人員模式）。
2. Open [Install eric's Auction Helper](https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/main/auction-helper.user.js).
   開啟上面的安裝連結。
3. Click **Install** in Tampermonkey, then open or reload an auction thread.
   在 Tampermonkey 的畫面按 **Install（安裝）**，再開啟或重新整理拍賣討論串。

If the link only shows the source code, Tampermonkey is not enabled or not allowed to run userscripts yet.
Check its settings, then open the link again.

如果連結只顯示原始碼，表示 Tampermonkey 尚未啟用或還不能執行使用者腳本；請檢查設定後再開一次連結。

## Updates / 更新

- The install link never changes. Tampermonkey checks it for new versions on its own and updates the script.
  安裝連結不會變。Tampermonkey 會自動從這個連結檢查新版並更新。
- To check right away: open the Tampermonkey menu and choose **Check for userscript updates**.
  想立即檢查：開啟 Tampermonkey 選單，選 **Check for userscript updates（檢查使用者腳本更新）**。
- The current version is shown in the `Auction Helper` line of each auction thread's first post.
  Compare it with the version in your Tampermonkey dashboard.
  每個拍賣討論串第一篇的 `Auction Helper` 列會顯示目前的版本號，可以和 Tampermonkey 管理頁的版本對照。

For maintainers: every release must raise `@version` and replace `auction-helper.user.js` on `main`.
The auction threads read the version from that line.

維護者：每次發布都要調高 `@version`，並覆蓋 `main` 上的 `auction-helper.user.js`；拍賣討論串顯示的版本號就是讀這一行。

## Features / 功能

- A checkbox on each auction item, with the amount you set shown next to it.
  每個拍賣品項旁加入勾選框，並即時顯示你設定的金額。
- A collapsible floating bid panel (English / 中文).
  可收合的懸浮喊價視窗，支援中英切換。
- Amounts like `500k`, `1.5m`, `2b`; checks against the reserve price.
  支援 k/m/b 金額寫法，並檢查是否低於底價。
- One click to copy the `Auction Bid` text, or open MoogleMail with it filled in.
  一鍵複製 `Auction Bid` 格式，或開啟 MoogleMail 自動帶入。
- Automatically freezes mail-sending and copy buttons during `Intake`, `Pending` (settling), and `Close` phases to prevent unnecessary MoogleMails, while keeping item selection and price calculation active.
  在收件期（`Intake`）、結算中（`Pending`）與已結案（`Close`）狀態下自動凍結發信與複製按鈕，避免寄出非必要 MM（仍可勾選品項與試算金額）。

It only activates in eric's auction threads.
只在 eric 的拍賣討論串中啟用。

## Credits / 致謝

Thanks to sparroff (original), SIRIUSs (current), and CornerCactus (contributor) of
[Noni's DIY Auction Helper](https://github.com/TetsuOrb/nonis-diy-auction-helper).

感謝 Noni's DIY Auction Helper 的 sparroff（原作者）、SIRIUSs（現任維護者）與 CornerCactus（貢獻者）。

## License

[Apache License 2.0](LICENSE)
