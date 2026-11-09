# eric's Auction Helper

A userscript for bidding in eric's Auto Equip Auction threads on the E-Hentai forums.

拍賣討論串的喊價輔助腳本。

## Install / 安裝

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
   先安裝 Tampermonkey 等使用者腳本管理器。
2. Open the link below; the manager will offer to install it.
   開啟下面的連結，管理器會跳出安裝畫面。

   <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/main/auction-helper.user.js>

Updates are picked up automatically by the manager.
之後的新版會由管理器自動更新。

## Features / 功能

- A checkbox on each auction item, with the amount you set shown next to it.
  每個拍賣品項旁加入勾選框，並即時顯示你設定的金額。
- A collapsible floating bid panel (English / 中文).
  可收合的懸浮喊價視窗，支援中英切換。
- Amounts like `500k`, `1.5m`, `2b`; checks against the reserve price.
  支援 k/m/b 金額寫法，並檢查是否低於底價。
- One click to copy the `Auction Bid` text, or open MoogleMail with it filled in.
  一鍵複製 `Auction Bid` 格式，或開啟 MoogleMail 自動帶入。

It only activates in eric's auction threads.
只在 eric 的拍賣討論串中啟用。

## License

[Apache License 2.0](LICENSE)
