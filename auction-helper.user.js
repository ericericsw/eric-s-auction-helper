// ==UserScript==
// @name         eric's Auction Helper
// @namespace    https://forums.e-hentai.org/
// @version      1.4.1
// @description  在 E-Hentai 論壇拍賣討論串的每個拍賣品項左側加入勾選框、右側即時顯示設定金額，並提供可收合的懸浮喊價視窗（支援中英雙語切換、k/m/b 金額解析、底價檢核、一鍵複製 Auction Bid 格式與開啟 MoogleMail 自動帶入；於 Intake/Pending/Close 階段自動凍結發信與複製功能）。
// @author       eric
// @match        https://forums.e-hentai.org/*showtopic*
// @match        https://hentaiverse.org/?s=Bazaar&ss=mm&filter=new*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/main/auction-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/main/auction-helper.user.js
// ==/UserScript==

(function () {
    'use strict';

    const DRAFT_STORAGE_KEY = 'hv_auction_mm_draft_payload';
    const PANEL_COLLAPSED_KEY = 'hv_auction_panel_collapsed';
    const LANG_STORAGE_KEY = 'hv_auction_helper_lang';

    // 拍賣系統專屬驗證條件（防止其他拍賣 thread 誤觸發）
    const ALLOWED_SHOP_NAMES = new Set(['hvequipauction']);
    const ALLOWED_SHOP_UIDS = new Set(['10151793']);
    const ALLOWED_TITLE_REGEX = /\[Auction\]\s*(?:eric(?:'|&#39;|’)s\s+)?Auto\s+Equip\s+Auction\s*-\s*Session\s+\d+/i;

    // =========================================================================
    // 0. 多語系設定與字典 (預設英文 'en'，長期保存於 localStorage / GM_setValue)
    // =========================================================================
    const I18N = {
        en: {
            toggleLabel: 'Auction Bid',
            toggleTitle: 'Click to collapse / expand Auction Bid panel',
            headerTitle: '🔨 Auction Bid Helper',
            headerCount: (sel, total) => `(${sel} / ${total} selected)`,
            collapseBtn: 'Hide ▶',
            collapseBtnTitle: 'Collapse panel to the right',
            langBtnLabel: '🌐 EN',
            langBtnTitle: 'Current language: EN (Click to switch to 中文)',
            intakeWarning: '⚠️ <b>Intake Phase (Bidding Not Open)</b>: Item IDs shown now are temporary Equip IDs (for seller <code>Auction Set</code> / <code>Auction Cancel</code> only). Official IDs (e.g. <code>001One01</code>) will be assigned when Bidding opens. <b>Mail & copy functions are frozen</b> (item selection & price calculation remain available).',
            pendingWarning: '🔒 <b>Settling / Delivery in Progress (Pending)</b>: Bidding has ended for this session. <b>Mail & copy functions are frozen</b> to avoid unnecessary MoogleMails (item selection & price calculation remain available).',
            closedWarning: '🔒 <b>Session Closed (Close)</b>: This auction session is completed and archived. <b>Mail & copy functions are frozen</b> to avoid unnecessary MoogleMails (item selection & price calculation remain available).',
            frozenBtnTitle: (phase) => phase === 'close'
                ? 'Disabled: Session is Closed (no bidding allowed)'
                : phase === 'pending'
                    ? 'Disabled: Session is in Pending / Settlement phase (bidding has ended)'
                    : 'Disabled: Session is in Intake phase (bidding has not opened yet)',
            copyRcptBtn: '📋 Copy Rcpt',
            copyRcptBtnTitle: (shop) => `Copy recipient "${shop}" to clipboard`,
            copySubjBtn: '📋 Copy Subject',
            copySubjBtnTitle: 'Copy fixed subject "Auction Bid" to clipboard',
            copyBidsBtn: (count) => count > 0 ? `📋 Copy Bid (${count})` : '📋 Copy Bid',
            copyBidsBtnFrozen: (count) => count > 0 ? `🔒 Copy Bid (${count})` : '🔒 Copy Bid',
            copyBidsBtnInvalid: (errCount) => `⚠️ Copy Bid (${errCount} invalid)`,
            copyBidsBtnTitle: 'Generate auction bid lines and copy to clipboard',
            selectAllBtn: 'Select All',
            clearAllBtn: 'Clear',
            openMmBtn: '✉️ Auto fill in MoogleMail',
            openMmBtnFrozen: '🔒 Auto fill in MoogleMail',
            openMmBtnTitle: 'Open HentaiVerse MoogleMail (legacy mode &hvut=disabled) and auto-fill recipient, subject & bid lines',
            defaultStatusHint: '<span>Units: <code>k</code> / <code>m</code> / <code>b</code> or <code>start</code> / <code>cancel</code> / <code>mybid</code></span>',
            footerRecipient: (shop) => `To: <b>${shop}</b> | Subject: <b>Auction Bid</b>`,
            footerTotal: (cr) => `Total: ${cr} Cr`,
            emptyList: 'No auction items selected.<br>Check the box on the left of any equipment in the post to add it here.',
            checkboxTitle: (id) => `Select item for bidding (${id})`,
            removeBtnTitle: 'Deselect this item',
            extLinkTitle: 'Open equipment stats page in new tab',
            scrollLinkTitle: (name) => `${name}\nClick to scroll to this item in the post`,
            hintEmpty: 'Enter amount or start',
            errEmpty: 'Amount required',
            hintStart: (cr) => `Reserve price (${cr} Cr)`,
            hintCancel: '⚠️ Cancel bid (irreversible)',
            hintMybid: 'Query active bid for item',
            hintCommaError: '❌ No commas allowed (use 50k or 50000)',
            errComma: 'Contains comma (E-AUC-101)',
            hintNegError: '❌ Negative amount forbidden',
            errNeg: 'Negative amount (E-AUC-102)',
            hintPlusError: '❌ Do not include + sign',
            errFormat: 'Invalid format (E-AUC-101)',
            hintFormatError: '❌ Invalid format (use numbers + k/m/b)',
            hintFractionError: '❌ Must evaluate to whole integer Cr',
            errFraction: 'Non-integer Credits (E-AUC-103)',
            hintRangeError: '❌ Amount out of allowed range',
            errRange: 'Out of range (E-AUC-104)',
            hintBelowReserve: (cr) => `❌ Below start ${cr} Cr`,
            errBelowReserve: (val, res) => `Below start (${val} < ${res})`,
            inlineBadgeStart: (token, cr) => `✓ Bid: ${token} (${cr} Cr)`,
            inlineBadgeAmount: (token, cr) => `✓ Bid: ${token} (${cr} Cr)`,
            inlineBadgeCmd: (token) => `✓ Cmd: ${token}`,
            inlineBadgeInvalid: (raw, err) => `⚠️ ${raw || '(empty)'} — ${err}`,
            inlineLabelBid: '✓ Bid:',
            inlineLabelCmd: '✓ Cmd:',
            inlineLabelInvalid: '⚠️ Bid:',
            inlineStatusCr: (cr) => `(${cr} Cr)`,
            inlineStatusCancel: '(Cancel bid)',
            inlineStatusMybid: '(Query bid)',
            inlineStatusInvalid: (err) => `— ${err}`,
            inlineInputTitle: 'Edit bid amount directly (syncs with floating panel)',
            msgSelectAtLeastOne: 'Please select at least one equipment item first!',
            msgFixErrorsFirst: (count, firstErr) => `❌ ${count} item(s) have invalid amount: ${firstErr}`,
            msgCopiedRcpt: (shop) => `✅ Copied recipient "${shop}" to clipboard!`,
            msgCopiedSubj: '✅ Copied subject "Auction Bid" to clipboard!',
            msgCopiedBids: (count) => `✅ Copied ${count} bid line(s) to clipboard!`,
            msgSelectedAll: (count) => `Selected all ${count} auction items on this page`,
            msgClearedAll: 'Cleared all selected items',
            msgOpenedMm: '✅ Auto-filling in MoogleMail (opened in new tab)!',
            mmAutoFillBanner: (recipient, count) => `✅ Auto-filled Auction Bid (To: ${recipient}, ${count} item(s)). Please review and click Send!`
        },
        zh: {
            toggleLabel: '拍賣喊價',
            toggleTitle: '點擊收起 / 展開拍賣喊價視窗',
            headerTitle: '🔨 拍賣快捷喊價',
            headerCount: (sel, total) => `(已選 ${sel} / ${total})`,
            collapseBtn: '收起 ▶',
            collapseBtnTitle: '向右收起視窗',
            langBtnLabel: '🌐 中文',
            langBtnTitle: '目前語系：中文（點擊切換為 EN）',
            intakeWarning: '⚠️ <b>目前為 Intake 收件期（尚未開標）</b>：品項編號為暫時裝備 ID（僅供賣家 <code>Auction Set</code> / <code>Auction Cancel</code> 使用），正式開標（Bidding）後將換成如 <code>001One01</code> 的正式編號。<b>已凍結發信與複製功能</b>（仍可勾選品項與試算金額）。',
            pendingWarning: '🔒 <b>目前為結算交割中（Pending）</b>：本場次已截標並進入結算交割階段，不再接受出價。<b>已凍結發信與複製功能</b>以避免製造非必要 MM（仍可勾選品項與試算金額）。',
            closedWarning: '🔒 <b>本場次已結案（Close）</b>：拍賣與交割皆已結清歸檔，不再接受出價。<b>已凍結發信與複製功能</b>以避免製造非必要 MM（仍可勾選品項與試算金額）。',
            frozenBtnTitle: (phase) => phase === 'close'
                ? '已凍結：本場次已結案（Close），不再接受出價'
                : phase === 'pending'
                    ? '已凍結：本場次結算交割中（Pending），已停止收受出價'
                    : '已凍結：目前為收件期（Intake），尚未開放出價',
            copyRcptBtn: '📋 複製收件人',
            copyRcptBtnTitle: (shop) => `複製收件人 "${shop}" 至剪貼簿`,
            copySubjBtn: '📋 複製主旨',
            copySubjBtnTitle: '複製拍賣出價固定主旨 "Auction Bid" 至剪貼簿',
            copyBidsBtn: (count) => count > 0 ? `📋 複製喊價 (${count})` : '📋 複製喊價',
            copyBidsBtnFrozen: (count) => count > 0 ? `🔒 複製喊價 (${count})` : '🔒 複製喊價',
            copyBidsBtnInvalid: (errCount) => `⚠️ 複製喊價 (${errCount} 筆有誤)`,
            copyBidsBtnTitle: '產生符合拍賣系統格式的喊價內文並複製到剪貼簿',
            selectAllBtn: '全選',
            clearAllBtn: '清空',
            openMmBtn: '✉️ Auto fill in MoogleMail',
            openMmBtnFrozen: '🔒 Auto fill in MoogleMail',
            openMmBtnTitle: '開啟 HentaiVerse MoogleMail 寫信頁面（自動帶入 hvut=disabled 相容模式）並填入收件人、主旨與喊價內文',
            defaultStatusHint: '<span>支援單位: <code>k</code> / <code>m</code> / <code>b</code> 或 <code>start</code> / <code>cancel</code> / <code>mybid</code></span>',
            footerRecipient: (shop) => `收件人: <b>${shop}</b> | 主旨: <b>Auction Bid</b>`,
            footerTotal: (cr) => `總計: ${cr} Cr`,
            emptyList: '尚未選擇任何拍賣品項。<br>請勾選左側貼文中的裝備方框，項目將顯示於此處。',
            checkboxTitle: (id) => `勾選加入右側喊價清單 (${id})`,
            removeBtnTitle: '取消選取此品項',
            extLinkTitle: '在新分頁開啟裝備素質頁面',
            scrollLinkTitle: (name) => `${name}\n點擊捲動定位至貼文位置`,
            hintEmpty: '請輸入金額或 start',
            errEmpty: '金額未填寫',
            hintStart: (cr) => `底價出價 (${cr} Cr)`,
            hintCancel: '⚠️ 取消出價 (不可逆)',
            hintMybid: '查詢此品項有效出價',
            hintCommaError: '❌ 禁止使用逗號 (請填 50k 或 50000)',
            errComma: '含逗號 (E-AUC-101)',
            hintNegError: '❌ 嚴禁負數 (會被記惡意輸入)',
            errNeg: '負數金額 (E-AUC-102)',
            hintPlusError: '❌ 請勿加正號 +',
            errFormat: '格式錯誤 (E-AUC-101)',
            hintFormatError: '❌ 格式錯誤 (支援數字與 k/m/b)',
            hintFractionError: '❌ 換算後含小數點，須為整數 Cr',
            errFraction: '非整數金額 (E-AUC-103)',
            hintRangeError: '❌ 金額超出系統允許範圍',
            errRange: '金額越界 (E-AUC-104)',
            hintBelowReserve: (cr) => `❌ 低於底價 ${cr} Cr`,
            errBelowReserve: (val, res) => `低於底價 (${val} < ${res})`,
            inlineBadgeStart: (token, cr) => `✓ 出價: ${token} (${cr} Cr)`,
            inlineBadgeAmount: (token, cr) => `✓ 出價: ${token} (${cr} Cr)`,
            inlineBadgeCmd: (token) => `✓ 指令: ${token}`,
            inlineBadgeInvalid: (raw, err) => `⚠️ ${raw || '(未填)'} — ${err}`,
            inlineLabelBid: '✓ 出價:',
            inlineLabelCmd: '✓ 指令:',
            inlineLabelInvalid: '⚠️ 出價:',
            inlineStatusCr: (cr) => `(${cr} Cr)`,
            inlineStatusCancel: '(取消出價)',
            inlineStatusMybid: '(查詢出價)',
            inlineStatusInvalid: (err) => `— ${err}`,
            inlineInputTitle: '直接編輯出價金額（與右側懸浮視窗即時同步）',
            msgSelectAtLeastOne: '請先勾選至少一項拍賣裝備！',
            msgFixErrorsFirst: (count, firstErr) => `❌ 有 ${count} 筆金額格式或底價不符：${firstErr}`,
            msgCopiedRcpt: (shop) => `✅ 已複製收件人 "${shop}" 至剪貼簿！`,
            msgCopiedSubj: '✅ 已複製主旨 "Auction Bid" 至剪貼簿！',
            msgCopiedBids: (count) => `✅ 已複製 ${count} 筆喊價指令至剪貼簿！`,
            msgSelectedAll: (count) => `已全選本頁 ${count} 項拍賣品項`,
            msgClearedAll: '已清空所有已選品項',
            msgOpenedMm: '✅ 已開啟 MoogleMail 並自動填入喊價內容！',
            mmAutoFillBanner: (recipient, count) => `✅ 已自動帶入拍賣喊價內容（收件人: ${recipient}，共 ${count} 筆），確認無誤後即可點擊 Send 寄出！`
        }
    };

    function getSavedLang() {
        try {
            if (typeof GM_getValue === 'function') {
                const gmLang = GM_getValue(LANG_STORAGE_KEY, '');
                if (gmLang === 'en' || gmLang === 'zh') return gmLang;
            }
        } catch (_) {
            // ignore
        }
        try {
            const lsLang = localStorage.getItem(LANG_STORAGE_KEY);
            if (lsLang === 'en' || lsLang === 'zh') return lsLang;
        } catch (_) {
            // ignore
        }
        return 'en'; // 預設英文
    }

    function setSavedLang(lang) {
        const normalized = lang === 'zh' ? 'zh' : 'en';
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(LANG_STORAGE_KEY, normalized);
            }
        } catch (_) {
            // ignore
        }
        try {
            localStorage.setItem(LANG_STORAGE_KEY, normalized);
        } catch (_) {
            // ignore
        }
    }

    let currentLang = getSavedLang();
    function t() {
        return I18N[currentLang] || I18N.en;
    }

    // =========================================================================
    // 1. HentaiVerse MoogleMail 寫信頁面自動填入支援
    // =========================================================================
    if (location.hostname === 'hentaiverse.org') {
        handleMoogleMailAutoFill();
        return;
    }

    function handleMoogleMailAutoFill() {
        let payload = null;

        try {
            if (typeof GM_getValue === 'function') {
                const raw = GM_getValue(DRAFT_STORAGE_KEY, null);
                if (raw) {
                    payload = JSON.parse(raw);
                    if (typeof GM_deleteValue === 'function') {
                        GM_deleteValue(DRAFT_STORAGE_KEY);
                    }
                }
            }
        } catch (err) {
            console.warn('[HV Auction Helper] Failed to read GM draft:', err);
        }

        if (!payload && location.hash.startsWith('#hv_auc_draft=')) {
            try {
                const encoded = location.hash.slice('#hv_auc_draft='.length);
                payload = JSON.parse(decodeURIComponent(encoded));
                history.replaceState(null, document.title, location.pathname + location.search);
            } catch (err) {
                console.warn('[HV Auction Helper] Failed to parse URL hash draft:', err);
            }
        }

        if (!payload || !payload.body) return;
        if (payload.timestamp && Date.now() - payload.timestamp > 60 * 1000) {
            return;
        }

        const toInput = document.querySelector('input[name="message_to_name"]');
        const subjInput = document.querySelector('input[name="message_subject"]');
        const bodyTextarea = document.querySelector('textarea[name="message_body"]');

        if (toInput && payload.recipient) {
            toInput.value = payload.recipient;
        }
        if (subjInput && payload.subject) {
            subjInput.value = payload.subject;
        }
        if (bodyTextarea && payload.body) {
            bodyTextarea.value = payload.body;
        }

        // 相容 HV Utils 自訂寫信介面（若使用者在未帶 hvut=disabled 的情況下進入）
        const hvutToInput = document.querySelector('.hvut-mm-left input[tabindex="1"]');
        const hvutSubjInput = document.querySelector('.hvut-mm-left input[tabindex="2"]');
        const hvutBodyTextarea = document.querySelector('.hvut-mm-left textarea[tabindex="3"]');
        if (hvutToInput && payload.recipient) {
            hvutToInput.value = payload.recipient;
        }
        if (hvutSubjInput && payload.subject) {
            hvutSubjInput.value = payload.subject;
        }
        if (hvutBodyTextarea && payload.body) {
            hvutBodyTextarea.value = payload.body;
        }

        const dict = I18N[payload.lang] || t();
        const banner = document.createElement('div');
        banner.textContent = dict.mmAutoFillBanner(payload.recipient || 'HVEquipAuction', payload.count || '');
        banner.style.cssText = [
            'position:fixed',
            'top:12px',
            'left:50%',
            'transform:translateX(-50%)',
            'background:#1b4332',
            'color:#d8f3dc',
            'border:1px solid #40916c',
            'padding:8px 16px',
            'border-radius:6px',
            'font-size:13px',
            'font-weight:bold',
            'z-index:99999',
            'box-shadow:0 4px 12px rgba(0,0,0,0.4)'
        ].join(';');
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 6000);
    }

    // =========================================================================
    // 2. 討論串身分與標題雙重驗證（避免其他玩家拍賣串誤觸發）
    // =========================================================================
    const MAX_AUCTION_AMOUNT = 1000000000000n; // 10^12
    const SPECIAL_KEYWORDS = new Set(['start', 'cancel', 'mybid']);

    /**
     * 檢查某個貼文區塊是否由官方拍賣系統帳號 (HVEquipAuction / UID 10151793) 發布
     */
    function isShopAuthoredPost(postEl) {
        const postTable = postEl.closest('table');
        if (!postTable) return false;
        const authorLink = postTable.querySelector('.bigusername a');
        if (!authorLink) return false;

        const authorName = (authorLink.textContent || '').trim().toLowerCase();
        const href = authorLink.getAttribute('href') || '';
        const uidMatch = href.match(/showuser=(\d+)/i);
        const authorUid = uidMatch ? uidMatch[1] : '';

        return ALLOWED_SHOP_NAMES.has(authorName) || (authorUid !== '' && ALLOWED_SHOP_UIDS.has(authorUid));
    }

    /**
     * 驗證討論串標題或發文者是否為本拍賣系統討論串
     */
    function verifyAuctionThreadAndMeta() {
        const titleText = document.title || '';
        const mainTitleEl = document.querySelector('.maintitle');
        const mainTitleText = mainTitleEl ? (mainTitleEl.textContent || '') : '';

        const isTitleMatched = ALLOWED_TITLE_REGEX.test(titleText) || ALLOWED_TITLE_REGEX.test(mainTitleText);

        // 檢查頁面上的發文者是否包含拍賣店家帳號
        let shopAccount = '';
        let isAuthorMatched = false;
        const authorLinks = document.querySelectorAll('.bigusername a');
        for (const a of authorLinks) {
            const name = (a.textContent || '').trim();
            const href = a.getAttribute('href') || '';
            const uidMatch = href.match(/showuser=(\d+)/i);
            const uid = uidMatch ? uidMatch[1] : '';
            if (ALLOWED_SHOP_NAMES.has(name.toLowerCase()) || (uid && ALLOWED_SHOP_UIDS.has(uid))) {
                isAuthorMatched = true;
                shopAccount = ALLOWED_SHOP_NAMES.has(name.toLowerCase()) ? name : 'HVEquipAuction';
                break;
            }
        }

        const topicMatch = location.search.match(/[?&]showtopic=(\d+)/i) ||
            document.documentElement.innerHTML.match(/showtopic=(\d+)/i) ||
            document.documentElement.innerHTML.match(/var\s+ipb_input_t\s*=\s*"(\d+)"/);
        const topicId = topicMatch ? topicMatch[1] : (location.pathname.slice(-32) || 'local');

        const combinedTitle = `${titleText} ${mainTitleText}`;
        let titlePhase = null;
        if (/\[\s*Closed?\s*\]/i.test(combinedTitle)) {
            titlePhase = 'close';
        } else if (/\[\s*Pending\s*\]/i.test(combinedTitle)) {
            titlePhase = 'pending';
        } else if (/\[\s*Intake\s*\]/i.test(combinedTitle)) {
            titlePhase = 'intake';
        } else if (/\[\s*Bidding\s*\]/i.test(combinedTitle)) {
            titlePhase = 'bidding';
        }

        return {
            isVerifiedThread: isTitleMatched || isAuthorMatched,
            isAuthorMatched,
            topicId,
            shopAccount: shopAccount || 'HVEquipAuction',
            titlePhase
        };
    }

    const threadMeta = verifyAuctionThreadAndMeta();

    // ★ 第一道防線：若討論串標題與發文者皆不符合本拍賣系統特徵，直接中止
    if (!threadMeta.isVerifiedThread) {
        return;
    }

    const LINE_BOUNDARY_TAGS = new Set([
        'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
        'HR', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
    ]);
    const START_PRICE_REGEX = /[-–—－]\s*(?:start|起[標标拍始]|開[始標标]|底[價价]|初始)\s*[:：]\s*([\d,]+)/i;
    const NEXT_ITEM_TAIL_REGEX = /(\r?\n\s*[\[【]\s*[A-Za-z0-9]+\s*[\]】]\s*)$/;

    function isLineBoundaryNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node;
        if (LINE_BOUNDARY_TAGS.has(el.tagName.toUpperCase())) return true;
        if (el.classList && el.classList.contains('hv-auc-item-row')) return true;
        return false;
    }

    function containsOtherEquipLink(node, currentHref = '') {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node;
        if (el.tagName.toUpperCase() === 'A') {
            const href = el.getAttribute('href') || '';
            if (href.includes('hentaiverse.org/equip/')) {
                return currentHref ? el.href !== currentHref : true;
            }
        }
        if (!el.querySelectorAll) return false;
        const links = el.querySelectorAll('a[href*="hentaiverse.org/equip/"]');
        for (const a of links) {
            if (!currentHref || a.href !== currentHref) return true;
        }
        return false;
    }

    /**
     * 若其他腳本或 BBCode 僅針對單一裝備連結包裹了行內容器（如 <span> / <strong>），
     * 向上尋找該單一連結的最外層行內節點，以便正確取得同行前後兄弟節點
     */
    function findInlineAnchorForLink(linkEl, postEl) {
        let curr = linkEl;
        while (curr.parentElement && curr.parentElement !== postEl) {
            const parent = curr.parentElement;
            if (isLineBoundaryNode(parent)) break;
            if (parent.querySelector && parent.querySelector('br')) break;
            const equipLinks = parent.querySelectorAll ? parent.querySelectorAll('a[href*="hentaiverse.org/equip/"]') : [];
            if (equipLinks.length > 1) break;
            const parentText = parent.textContent || '';
            if (/[\[【]\s*[A-Za-z0-9]+\s*[\]】]/.test(parentText)) break;
            if (START_PRICE_REGEX.test(parentText)) break;
            curr = parent;
        }
        return curr;
    }

    const ROW_WRAPPER_TAG = 'hv-auc-row';
    const INLINE_BADGE_TAG = 'hv-auc-badge';
    const INLINE_LABEL_TAG = 'hv-auc-label';
    const INLINE_STATUS_TAG = 'hv-auc-status';
    const AUCTION_INTERNAL_CLASSES = [
        'hv-auc-checkbox',
        'hv-auc-inline-badge',
        'hv-auc-inline-input',
        'hv-auc-inline-label',
        'hv-auc-inline-status'
    ];
    const AUCTION_INTERNAL_SELECTOR = AUCTION_INTERNAL_CLASSES.map((c) => `.${c}`).join(', ');

    function isAuctionInternalNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node;
        if (!el.classList) return false;
        return AUCTION_INTERNAL_CLASSES.some((cls) => el.classList.contains(cls));
    }

    /**
     * 清理因其他腳本（如 Hentaiverse 漢化 normalizeStyledTextInPostcolor）剝除 <span> 標籤後，
     * 殘留於貼文內未受 .hv-auc-item-row 包裹的孤兒勾選框與徽章節點，防止重複產生兩個勾選框
     */
    function cleanupOrphanedAuctionNodes(rootEl) {
        if (!rootEl || !rootEl.querySelectorAll) return;
        const nodes = rootEl.querySelectorAll(AUCTION_INTERNAL_SELECTOR);
        nodes.forEach((node) => {
            if (!node.closest('.hv-auc-item-row')) {
                node.remove();
                return;
            }
            if (
                node.classList &&
                (node.classList.contains('hv-auc-inline-input') ||
                    node.classList.contains('hv-auc-inline-label') ||
                    node.classList.contains('hv-auc-inline-status')) &&
                !node.closest('.hv-auc-inline-badge')
            ) {
                node.remove();
            }
        });
    }

    /**
     * 擷取裝備名稱顏色，並略過其他漢化腳本為品質標籤（如 ☯无双☯ / ✪传奇✪）注入的亮底黑字樣式
     */
    function extractEquipColor(linkEl, fallbackColor = '#FF9900') {
        if (!linkEl) return fallbackColor;
        const spans = Array.from(linkEl.querySelectorAll('span[style*="color"]'));
        if (linkEl.parentElement && linkEl.parentElement.tagName === 'SPAN' && linkEl.parentElement.style && linkEl.parentElement.style.color) {
            spans.unshift(linkEl.parentElement);
        }
        for (const sp of spans) {
            const c = (sp.style && sp.style.color ? sp.style.color : '').trim().toLowerCase();
            const bg = (sp.style && (sp.style.backgroundColor || sp.style.background) ? (sp.style.backgroundColor || sp.style.background) : '').trim();
            if (bg && (c === '#000000' || c === '#000' || c === 'black' || c === 'rgb(0, 0, 0)')) {
                continue;
            }
            if (c && c !== '#000000' && c !== '#000' && c !== 'black' && c !== 'rgb(0, 0, 0)') {
                return sp.style.color;
            }
        }
        return fallbackColor;
    }

    /**
     * 包裹單一裝備連結所在的品項列；容許其他腳本先行改寫裝備名稱、插入 span/icon 或拆分文字節點
     */
    function wrapSingleAuctionLink(linkEl, postEl, seenIds) {
        if (!linkEl || linkEl.closest('.hv-auc-item-row')) return null;

        const anchorNode = findInlineAnchorForLink(linkEl, postEl);
        if (!anchorNode || !anchorNode.parentNode) return null;

        // 1. 向前收集同行行內節點，尋找 `[品項ID]`（相容其他腳本在連結前插入圖示或包裹節點，並自動清除殘留孤兒節點）
        const prevLineNodes = [];
        let p = anchorNode.previousSibling;
        while (p) {
            const prevSibling = p.previousSibling;
            if (isLineBoundaryNode(p) || containsOtherEquipLink(p, linkEl.href)) {
                break;
            }
            if (isAuctionInternalNode(p)) {
                p.remove();
                p = prevSibling;
                continue;
            }
            prevLineNodes.unshift(p);
            p = prevSibling;
        }

        const idRegex = /[\[【]\s*([A-Za-z0-9]+)\s*[\]】]/g;
        let matchedId = '';
        let idNodeIndex = -1;
        let idMatchIndexInText = -1;

        for (let i = prevLineNodes.length - 1; i >= 0; i--) {
            const node = prevLineNodes[i];
            const txt = node.nodeType === Node.TEXT_NODE ? (node.nodeValue || '') : (node.textContent || '');
            idRegex.lastIndex = 0;
            let m;
            let lastMatch = null;
            while ((m = idRegex.exec(txt)) !== null) {
                lastMatch = m;
            }
            if (lastMatch) {
                matchedId = lastMatch[1].trim();
                idNodeIndex = i;
                idMatchIndexInText = lastMatch.index;
                break;
            }
        }

        if (!matchedId) return null;
        if (seenIds && seenIds.has(matchedId)) return null;

        // 2. 向後收集同行所有後續行內節點（容許其他腳本在 `(Lv ...)` 或結果文字內插入 `<span>` 標籤）
        const trailingNodes = [];
        let splitNextItemNode = null;
        let splitNextItemIndex = -1;
        let cursor = anchorNode.nextSibling;

        while (cursor) {
            const nextCursor = cursor.nextSibling;
            if (isLineBoundaryNode(cursor) || containsOtherEquipLink(cursor, linkEl.href)) {
                break;
            }
            if (isAuctionInternalNode(cursor)) {
                cursor.remove();
                cursor = nextCursor;
                continue;
            }
            if (cursor.nodeType === Node.TEXT_NODE) {
                const val = cursor.nodeValue || '';
                const tailMatch = val.match(NEXT_ITEM_TAIL_REGEX);
                if (tailMatch) {
                    const beforeTail = val.slice(0, tailMatch.index);
                    if (beforeTail.trim().length === 0) {
                        break;
                    }
                    splitNextItemNode = cursor;
                    splitNextItemIndex = tailMatch.index;
                    trailingNodes.push(cursor);
                    break;
                }
                if (/[\[【]\s*[A-Za-z0-9]+\s*[\]】]\s*$/.test(val) && !START_PRICE_REGEX.test(val)) {
                    break;
                }
            }
            trailingNodes.push(cursor);
            cursor = nextCursor;
        }

        if (trailingNodes.length === 0) return null;

        const nextText = trailingNodes
            .map((n) => {
                if (n === splitNextItemNode && splitNextItemIndex >= 0) {
                    return (n.nodeValue || '').slice(0, splitNextItemIndex);
                }
                return n.textContent || '';
            })
            .join('');

        // 後置文字必須包含 `- start:<起標價>`（相容中文化改寫）
        const startMatch = nextText.match(START_PRICE_REGEX);
        if (!startMatch) return null;

        const itemId = matchedId;
        const reserveRaw = startMatch[1].replace(/,/g, '');
        const reservePrice = parseInt(reserveRaw, 10);
        if (isNaN(reservePrice)) return null;

        const statsMatch = nextText.match(/\(((?:Lv|Level|等級|等级)\s*[^)]+)\)/i);
        const sellerMatch = nextText.match(/\((?:Seller|賣家|卖家)\s*[:：]\s*([^)]+)\)/i);
        const statsText = statsMatch ? statsMatch[1].trim() : '';
        const sellerName = sellerMatch ? sellerMatch[1].trim() : '';
        const hasResult = /[-–—－]\s*(?:start|起[標标拍始]|開[始標标]|底[價价]|初始)\s*[:：]\s*[\d,]+\s+(?:Result|結果|结果)\s*[:：]/i.test(nextText);

        const equipName = (linkEl.textContent || '').trim();
        const equipColor = extractEquipColor(linkEl);

        // 若尾端文字節點連著下一筆品項的 `\n[ID] `，在此安全切分
        if (splitNextItemNode && splitNextItemIndex >= 0 && splitNextItemNode.parentNode) {
            const fullVal = splitNextItemNode.nodeValue || '';
            splitNextItemNode.nodeValue = fullVal.slice(0, splitNextItemIndex);
            const nextItemLeadingTextNode = document.createTextNode(fullVal.slice(splitNextItemIndex));
            splitNextItemNode.parentNode.insertBefore(nextItemLeadingTextNode, splitNextItemNode.nextSibling);
        }

        // 將前置文字節點拆分為「前面的換行/空白」與「`[ID] ` 本身」
        const idOriginNode = prevLineNodes[idNodeIndex];
        const nodesBeforeAnchor = [];
        if (idOriginNode.nodeType === Node.TEXT_NODE) {
            const fullPrevText = idOriginNode.nodeValue || '';
            const leadingText = fullPrevText.slice(0, idMatchIndexInText);
            const idBracketText = fullPrevText.slice(idMatchIndexInText);
            idOriginNode.nodeValue = leadingText;
            nodesBeforeAnchor.push(document.createTextNode(idBracketText));
            for (let j = idNodeIndex + 1; j < prevLineNodes.length; j++) {
                nodesBeforeAnchor.push(prevLineNodes[j]);
            }
        } else {
            for (let j = idNodeIndex; j < prevLineNodes.length; j++) {
                nodesBeforeAnchor.push(prevLineNodes[j]);
            }
        }

        // 建立包裹容器（使用自訂標籤而非 <span>，避免被漢化腳本 normalizeStyledTextInPostcolor 的 /<span[^>]*>/gi 剝除）
        const rowWrapper = document.createElement(ROW_WRAPPER_TAG);
        rowWrapper.className = 'hv-auc-item-row';
        rowWrapper.dataset.itemId = itemId;

        // 左側選擇方框（加上 data-item-id 以支援事件委派，防止其他腳本覆寫 innerHTML 後遺失事件）
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'hv-auc-checkbox';
        checkbox.dataset.itemId = itemId;
        checkbox.title = t().checkboxTitle(itemId);

        // 右側即時顯示當前設定金額的標籤（使用自訂標籤而非 <span>）
        const inlineBadge = document.createElement(INLINE_BADGE_TAG);
        inlineBadge.className = 'hv-auc-inline-badge';
        inlineBadge.dataset.itemId = itemId;

        anchorNode.parentNode.insertBefore(rowWrapper, anchorNode);
        rowWrapper.appendChild(checkbox);
        nodesBeforeAnchor.forEach((n) => rowWrapper.appendChild(n));
        rowWrapper.appendChild(anchorNode);
        trailingNodes.forEach((node) => rowWrapper.appendChild(node));
        rowWrapper.appendChild(inlineBadge);

        if (seenIds) {
            seenIds.add(itemId);
        }

        return {
            itemId,
            isTempId: /^\d+$/.test(itemId),
            hasResult,
            equipName,
            equipUrl: linkEl.href,
            equipColor,
            statsText,
            sellerName,
            reservePrice,
            reserveFormatted: startMatch[1],
            rowWrapper,
            checkbox,
            inlineBadge
        };
    }

    /**
     * 掃描所有店家貼文中的拍賣品項，回傳結構化陣列並包裹 DOM 節點
     */
    function scanAndWrapAuctionItems() {
        const posts = document.querySelectorAll('div.postcolor');
        const items = [];
        const seenIds = new Set();

        posts.forEach((postEl) => {
            // 若頁面上能識別出店家發文者，則只掃描店家帳號自己發的貼文，防止玩家回文引用誤判
            if (threadMeta.isAuthorMatched && !isShopAuthoredPost(postEl)) {
                return;
            }

            cleanupOrphanedAuctionNodes(postEl);

            const links = Array.from(postEl.querySelectorAll('a[href*="hentaiverse.org/equip/"]'));
            if (links.length === 0) return;

            links.forEach((linkEl) => {
                const parsedItem = wrapSingleAuctionLink(linkEl, postEl, seenIds);
                if (parsedItem) {
                    items.push(parsedItem);
                }
            });
        });

        return items;
    }

    const catalogItems = scanAndWrapAuctionItems();
    const catalogById = new Map(catalogItems.map((it) => [it.itemId, it]));

    // ★ 第二道防線：若頁面上沒有任何拍賣裝備項目，直接結束，絕不建立懸浮視窗
    if (catalogItems.length === 0) {
        return;
    }

    /**
     * 依拍賣系統規格書 (AUC-FRM-020 §4.5.1 / AUC-DLST-100 §4.4.7 / AUC-STM-020 §6.0) 判定討論串階段：
     * - Title 標記: [Intake] / [Bidding] / [Pending] / [Close]
     * - Post #1 公告: Session Status: Intake (收件期) / Bidding (競標期) / Pending (結算交割中) / Closed (已結清)
     * - 狀態貼文: Current Phase: INTAKE / BIDDING / PENDING / CLOSE
     * - 品項列特徵: 含 Result: 代表已進入結算後 (pending / close)；純數字 ID 代表收件期 (intake)
     */
    function detectThreadPhase(meta, items) {
        const phases = new Set();
        if (meta.titlePhase) {
            phases.add(meta.titlePhase);
        }

        const posts = document.querySelectorAll('div.postcolor');
        posts.forEach((postEl) => {
            if (meta.isAuthorMatched && !isShopAuthoredPost(postEl)) {
                return;
            }
            const text = postEl.textContent || '';

            const statusMatch = text.match(/Session\s+Status\s*:\s*(Intake|Bidding|Pending|Closed?)\b/i);
            if (statusMatch) {
                const raw = statusMatch[1].toLowerCase();
                phases.add(raw.startsWith('close') ? 'close' : raw);
            }

            const phaseMatch = text.match(/Current\s+Phase\s*:\s*(INTAKE|BIDDING|PENDING|CLOSED?)\b/i);
            if (phaseMatch) {
                const raw = phaseMatch[1].toLowerCase();
                phases.add(raw.startsWith('close') ? 'close' : raw);
            }
        });

        const hasSettledResults = items.some((it) => it.hasResult);
        const hasTempIds = items.some((it) => it.isTempId);

        if (phases.has('close')) return 'close';
        if (phases.has('pending') || hasSettledResults) return 'pending';
        if (phases.has('intake') || hasTempIds) return 'intake';
        return 'bidding';
    }

    const threadPhase = detectThreadPhase(threadMeta, catalogItems);
    // 非 bidding 階段（intake 收件期 / pending 結算交割中 / close 已結案）皆凍結發信與複製功能，避免製造非必要 MM
    const isBiddingFrozen = threadPhase !== 'bidding';

    // =========================================================================
    // 3. 價格解析與驗證（嚴格對齊拍賣系統規格 AUC-BIZ-040 / AUC-CMD-070）
    // =========================================================================
    function validateBidInput(rawInput, reservePrice) {
        const dict = t();
        const trimmed = (rawInput || '').trim();
        if (!trimmed) {
            return {
                valid: false,
                type: 'empty',
                normalizedToken: '',
                amountBigInt: null,
                displayHint: dict.hintEmpty,
                errorMsg: dict.errEmpty,
                inlineText: dict.inlineBadgeInvalid('', dict.errEmpty),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errEmpty)
            };
        }

        const lower = trimmed.toLowerCase();
        const reserveFormatted = reservePrice.toLocaleString('en-US');

        // 1. 特殊指令關鍵字: start / cancel / mybid
        if (SPECIAL_KEYWORDS.has(lower)) {
            if (lower === 'start') {
                return {
                    valid: true,
                    type: 'keyword_start',
                    normalizedToken: 'start',
                    amountBigInt: BigInt(reservePrice),
                    displayHint: dict.hintStart(reserveFormatted),
                    errorMsg: '',
                    inlineText: dict.inlineBadgeStart('start', reserveFormatted),
                    inlineLabel: dict.inlineLabelBid,
                    inlineStatus: dict.inlineStatusCr(reserveFormatted)
                };
            }
            if (lower === 'cancel') {
                return {
                    valid: true,
                    type: 'keyword_cancel',
                    normalizedToken: 'cancel',
                    amountBigInt: 0n,
                    displayHint: dict.hintCancel,
                    errorMsg: '',
                    inlineText: dict.inlineBadgeCmd('cancel'),
                    inlineLabel: dict.inlineLabelCmd,
                    inlineStatus: dict.inlineStatusCancel
                };
            }
            if (lower === 'mybid') {
                return {
                    valid: true,
                    type: 'keyword_mybid',
                    normalizedToken: 'mybid',
                    amountBigInt: 0n,
                    displayHint: dict.hintMybid,
                    errorMsg: '',
                    inlineText: dict.inlineBadgeCmd('mybid'),
                    inlineLabel: dict.inlineLabelCmd,
                    inlineStatus: dict.inlineStatusMybid
                };
            }
        }

        // 2. 禁止任何逗號（AUC-BIZ-040 步驟 1: 含逗號回 E-AUC-101）
        if (trimmed.includes(',')) {
            return {
                valid: false,
                type: 'error',
                normalizedToken: trimmed,
                amountBigInt: null,
                displayHint: dict.hintCommaError,
                errorMsg: dict.errComma,
                inlineText: dict.inlineBadgeInvalid(trimmed, dict.errComma),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errComma)
            };
        }

        // 3. 符號前置檢查（AUC-BIZ-040 步驟 2）
        if (trimmed.startsWith('-')) {
            return {
                valid: false,
                type: 'error',
                normalizedToken: trimmed,
                amountBigInt: null,
                displayHint: dict.hintNegError,
                errorMsg: dict.errNeg,
                inlineText: dict.inlineBadgeInvalid(trimmed, dict.errNeg),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errNeg)
            };
        }
        if (trimmed.startsWith('+')) {
            return {
                valid: false,
                type: 'error',
                normalizedToken: trimmed,
                amountBigInt: null,
                displayHint: dict.hintPlusError,
                errorMsg: dict.errFormat,
                inlineText: dict.inlineBadgeInvalid(trimmed, dict.errFormat),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errFormat)
            };
        }

        // 4. 正則檢查 ^(\d+(?:\.\d+)?)\s*([kKmMbB]?)$
        const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*([kKmMbB]?)$/);
        if (!m) {
            return {
                valid: false,
                type: 'error',
                normalizedToken: trimmed,
                amountBigInt: null,
                displayHint: dict.hintFormatError,
                errorMsg: dict.errFormat,
                inlineText: dict.inlineBadgeInvalid(trimmed, dict.errFormat),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errFormat)
            };
        }

        const numPart = m[1];
        const unitPart = (m[2] || '').toLowerCase();
        const unitExponent = unitPart === 'k' ? 3 : unitPart === 'm' ? 6 : unitPart === 'b' ? 9 : 0;

        // 5. 精確十進位乘算（對應 Python decimal.Decimal）
        const dotIdx = numPart.indexOf('.');
        let intDigits = numPart;
        let fracDigits = '';
        if (dotIdx !== -1) {
            intDigits = numPart.slice(0, dotIdx);
            fracDigits = numPart.slice(dotIdx + 1);
        }

        const trimmedFrac = fracDigits.replace(/0+$/, '');
        if (trimmedFrac.length > unitExponent) {
            const token = `${numPart}${unitPart}`;
            return {
                valid: false,
                type: 'error',
                normalizedToken: token,
                amountBigInt: null,
                displayHint: dict.hintFractionError,
                errorMsg: dict.errFraction,
                inlineText: dict.inlineBadgeInvalid(token, dict.errFraction),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errFraction)
            };
        }

        const paddedFrac = trimmedFrac.padEnd(unitExponent, '0');
        const fullDigits = (intDigits + paddedFrac).replace(/^0+/, '') || '0';
        const valBigInt = BigInt(fullDigits);
        const normalizedToken = `${numPart}${unitPart}`;

        if (valBigInt < 1n || valBigInt > MAX_AUCTION_AMOUNT) {
            return {
                valid: false,
                type: 'error',
                normalizedToken,
                amountBigInt: valBigInt,
                displayHint: dict.hintRangeError,
                errorMsg: dict.errRange,
                inlineText: dict.inlineBadgeInvalid(normalizedToken, dict.errRange),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(dict.errRange)
            };
        }

        // 6. 檢查是否低於起標底價（AUC-CMD-070 E-AUC-204）
        const reserveBigInt = BigInt(reservePrice);
        const valFormatted = valBigInt.toLocaleString('en-US');
        if (valBigInt < reserveBigInt) {
            const errStr = dict.errBelowReserve(valFormatted, reserveFormatted);
            return {
                valid: false,
                type: 'below_reserve',
                normalizedToken,
                amountBigInt: valBigInt,
                displayHint: dict.hintBelowReserve(reserveFormatted),
                errorMsg: errStr,
                inlineText: dict.inlineBadgeInvalid(normalizedToken, errStr),
                inlineLabel: dict.inlineLabelInvalid,
                inlineStatus: dict.inlineStatusInvalid(errStr)
            };
        }

        return {
            valid: true,
            type: 'amount',
            normalizedToken,
            amountBigInt: valBigInt,
            displayHint: `= ${valFormatted} Cr`,
            errorMsg: '',
            inlineText: dict.inlineBadgeAmount(normalizedToken, valFormatted),
            inlineLabel: dict.inlineLabelBid,
            inlineStatus: dict.inlineStatusCr(valFormatted)
        };
    }

    // =========================================================================
    // 4. 狀態管理與 localStorage 持久化
    // =========================================================================
    const STORAGE_KEY = `hv_auction_bids_${threadMeta.topicId}`;
    const selectedMap = new Map();

    function loadSavedState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                const validIds = new Set(catalogItems.map((it) => it.itemId));
                Object.entries(parsed).forEach(([id, val]) => {
                    if (validIds.has(id) && typeof val === 'string') {
                        selectedMap.set(id, val);
                    }
                });
            }
        } catch (err) {
            console.warn('[HV Auction Helper] Failed to load saved state:', err);
        }
    }

    function saveState() {
        try {
            const obj = {};
            selectedMap.forEach((val, key) => {
                obj[key] = val;
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        } catch (err) {
            console.warn('[HV Auction Helper] Failed to save state:', err);
        }
    }

    function isPanelCollapsedSaved() {
        try {
            return localStorage.getItem(PANEL_COLLAPSED_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function setPanelCollapsedSaved(collapsed) {
        try {
            localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
        } catch (_) {
            // ignore
        }
    }

    loadSavedState();

    // =========================================================================
    // 5. 樣式注入 (CSS)
    // =========================================================================
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        /* 貼文內品項列與「被選上模式」樣式 */
        .hv-auc-item-row {
            display: inline;
            padding: 2px 6px 2px 4px;
            margin-left: -4px;
            border-radius: 4px;
            border-left: 3px solid transparent;
            transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .hv-auc-item-row:hover {
            background-color: rgba(255, 183, 3, 0.10);
        }
        .hv-auc-item-row.hv-auc-selected {
            background-color: rgba(255, 153, 0, 0.20);
            border-left-color: #ff9900;
            box-shadow: 0 0 0 1px rgba(255, 153, 0, 0.38);
        }
        .hv-auc-inline-badge {
            display: none;
            font-size: 11px;
            font-weight: bold;
            font-family: Consolas, Monaco, "Segoe UI", sans-serif;
            color: #ffd166;
            background: rgba(20, 22, 34, 0.90);
            border: 1px solid rgba(255, 183, 3, 0.55);
            padding: 1px 6px;
            margin-left: 8px;
            border-radius: 4px;
            vertical-align: middle;
            cursor: text;
        }
        .hv-auc-item-row.hv-auc-selected .hv-auc-inline-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .hv-auc-inline-badge.hv-auc-inline-invalid {
            color: #ff8787;
            border-color: rgba(255, 107, 107, 0.7);
            background: rgba(60, 15, 20, 0.88);
        }
        .hv-auc-inline-label {
            user-select: none;
            white-space: nowrap;
        }
        .hv-auc-inline-input {
            width: 72px;
            box-sizing: border-box;
            background: #10121d;
            color: #ffffff;
            border: 1px solid rgba(255, 183, 3, 0.65);
            border-radius: 3px;
            padding: 1px 5px;
            font-size: 11px;
            font-weight: bold;
            font-family: Consolas, Monaco, monospace;
            text-align: right;
            outline: none;
            line-height: 1.25;
        }
        .hv-auc-inline-input:focus {
            border-color: #ffb703;
            box-shadow: 0 0 0 2px rgba(255, 183, 3, 0.32);
        }
        .hv-auc-inline-badge.hv-auc-inline-invalid .hv-auc-inline-input {
            border-color: #ff6b6b;
            color: #ff8787;
        }
        .hv-auc-inline-status {
            white-space: nowrap;
        }
        @keyframes hvAucFlashHighlight {
            0%   { box-shadow: 0 0 0 4px rgba(0, 212, 255, 0.9); background-color: rgba(0, 212, 255, 0.35); }
            100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
        }
        .hv-auc-item-row.hv-auc-flash {
            animation: hvAucFlashHighlight 1.3s ease-out;
        }
        .hv-auc-checkbox {
            cursor: pointer;
            vertical-align: middle;
            margin: 0 6px 2px 2px;
            width: 15px;
            height: 15px;
            accent-color: #ff9900;
        }

        /* 右側懸浮視窗容器 */
        #hv-auc-floating-root {
            position: fixed;
            top: 72px;
            right: 0;
            z-index: 99990;
            display: flex;
            align-items: flex-start;
            font-family: "Segoe UI", "Microsoft JhengHei", Arial, sans-serif;
            font-size: 12px;
            color: #e9ecef;
            transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        #hv-auc-floating-root.hv-auc-collapsed {
            transform: translateX(calc(100% - 34px));
        }

        /* 左側收合/展開把手按鈕 */
        #hv-auc-toggle-handle {
            width: 34px;
            background: linear-gradient(180deg, #2b2d42 0%, #1e2030 100%);
            color: #ffb703;
            border: 1px solid #4a4e69;
            border-right: none;
            border-radius: 8px 0 0 8px;
            padding: 12px 4px;
            cursor: pointer;
            user-select: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            box-shadow: -3px 3px 10px rgba(0, 0, 0, 0.45);
            font-weight: bold;
            line-height: 1.2;
            text-align: center;
        }
        #hv-auc-toggle-handle:hover {
            background: #343854;
            color: #ffd166;
        }
        #hv-auc-toggle-arrow {
            font-size: 14px;
        }
        #hv-auc-toggle-label {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            letter-spacing: 1.5px;
            font-size: 12px;
        }
        #hv-auc-toggle-badge {
            background: #ff9900;
            color: #111;
            border-radius: 10px;
            padding: 2px 5px;
            font-size: 11px;
            font-weight: 800;
            min-width: 16px;
        }

        /* 主面板 */
        #hv-auc-panel {
            width: 400px;
            max-width: calc(100vw - 48px);
            max-height: calc(100vh - 96px);
            background: #1b1d29;
            border: 1px solid #4a4e69;
            border-right: none;
            border-radius: 0 0 0 8px;
            box-shadow: -6px 8px 24px rgba(0, 0, 0, 0.6);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* 頂部標題列 */
        .hv-auc-header {
            background: linear-gradient(90deg, #26293d 0%, #1f2233 100%);
            padding: 9px 12px;
            border-bottom: 1px solid #393d57;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
        }
        .hv-auc-header-title {
            font-size: 13px;
            font-weight: bold;
            color: #ffb703;
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .hv-auc-header-actions {
            display: flex;
            align-items: center;
            gap: 5px;
            flex-shrink: 0;
        }
        .hv-auc-header-btn {
            background: #2b2f47;
            border: 1px solid #4a4e69;
            color: #dee2e6;
            border-radius: 4px;
            padding: 2px 7px;
            font-size: 11px;
            cursor: pointer;
            font-weight: 600;
        }
        .hv-auc-header-btn:hover {
            background: #3d4261;
            color: #fff;
        }

        /* 場次階段提醒橫幅 (Intake / Pending / Close) */
        .hv-auc-intake-banner {
            background: rgba(255, 183, 3, 0.14);
            border-bottom: 1px solid rgba(255, 183, 3, 0.35);
            color: #ffd166;
            padding: 6px 10px;
            font-size: 11px;
            line-height: 1.4;
        }
        .hv-auc-intake-banner.hv-auc-phase-pending {
            background: rgba(255, 123, 0, 0.16);
            border-bottom-color: rgba(255, 153, 0, 0.42);
            color: #ffc078;
        }
        .hv-auc-intake-banner.hv-auc-phase-close {
            background: rgba(230, 57, 70, 0.16);
            border-bottom-color: rgba(230, 57, 70, 0.42);
            color: #ff8787;
        }

        /* 框上方控制列 (Copy 按鈕區) */
        .hv-auc-toolbar {
            padding: 8px 10px;
            background: #222536;
            border-bottom: 1px solid #353952;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .hv-auc-toolbar-row {
            display: flex;
            gap: 6px;
            align-items: center;
            flex-wrap: wrap;
        }
        .hv-auc-btn {
            border: 1px solid #4a4e69;
            background: #2f334a;
            color: #f8f9fa;
            border-radius: 4px;
            padding: 5px 10px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }
        .hv-auc-btn:hover:not(:disabled) {
            background: #3d4261;
            border-color: #6c757d;
        }
        .hv-auc-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }
        .hv-auc-btn-primary {
            flex: 1;
            background: #d97706;
            border-color: #f59e0b;
            color: #fff;
            font-size: 12.5px;
            padding: 6px 12px;
        }
        .hv-auc-btn-primary:hover:not(:disabled) {
            background: #b45309;
            border-color: #fbbf24;
        }
        .hv-auc-btn-mm {
            background: #2a6f4e;
            border-color: #40916c;
            color: #e9f5ee;
            font-size: 11.5px;
            padding: 4px 8px;
        }
        .hv-auc-btn-mm:hover:not(:disabled) {
            background: #1b4332;
        }
        .hv-auc-btn-sm {
            padding: 3px 7px;
            font-size: 11px;
            font-weight: normal;
        }

        /* 狀態訊息列 */
        .hv-auc-status-msg {
            font-size: 11px;
            min-height: 16px;
            color: #90e0ef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .hv-auc-status-msg.hv-auc-msg-error {
            color: #ff6b6b;
        }
        .hv-auc-status-msg.hv-auc-msg-ok {
            color: #69db7c;
        }

        /* 已選項目清單區 */
        .hv-auc-list {
            flex: 1;
            overflow-y: auto;
            padding: 6px 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .hv-auc-empty {
            padding: 24px 12px;
            text-align: center;
            color: #8d99ae;
            font-size: 12px;
            line-height: 1.6;
        }

        /* 單一已選項目卡片：左資訊、右輸入框 */
        .hv-auc-card {
            background: #26293c;
            border: 1px solid #393d57;
            border-radius: 6px;
            padding: 7px 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            transition: border-color 0.15s ease;
        }
        .hv-auc-card.hv-auc-card-invalid {
            border-color: #e63946;
            background: rgba(230, 57, 70, 0.10);
        }
        .hv-auc-card-left {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .hv-auc-card-top {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .hv-auc-remove-btn {
            background: transparent;
            border: none;
            color: #adb5bd;
            cursor: pointer;
            font-size: 13px;
            line-height: 1;
            padding: 0 3px;
            border-radius: 3px;
        }
        .hv-auc-remove-btn:hover {
            color: #ff6b6b;
            background: rgba(255, 107, 107, 0.15);
        }
        .hv-auc-id-badge {
            font-family: Consolas, Monaco, monospace;
            font-size: 11.5px;
            font-weight: bold;
            color: #ffd166;
            background: #161824;
            padding: 1px 5px;
            border-radius: 3px;
            border: 1px solid #3d4261;
        }
        .hv-auc-equip-link-icon {
            text-decoration: none;
            font-size: 11px;
            color: #90e0ef;
            opacity: 0.8;
        }
        .hv-auc-equip-link-icon:hover {
            opacity: 1;
        }
        .hv-auc-equip-name {
            font-weight: bold;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            text-decoration: none;
        }
        .hv-auc-equip-name:hover {
            text-decoration: underline;
        }
        .hv-auc-equip-meta {
            font-size: 10.5px;
            color: #adb5bd;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* 右側金額輸入框區塊 */
        .hv-auc-card-right {
            width: 132px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
        }
        .hv-auc-price-input {
            width: 100%;
            box-sizing: border-box;
            background: #141622;
            color: #f8f9fa;
            border: 1px solid #5c6285;
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 12px;
            font-family: Consolas, Monaco, monospace;
            text-align: right;
            outline: none;
        }
        .hv-auc-price-input:focus {
            border-color: #ffb703;
            box-shadow: 0 0 0 2px rgba(255, 183, 3, 0.25);
        }
        .hv-auc-card.hv-auc-card-invalid .hv-auc-price-input {
            border-color: #ff6b6b;
            color: #ff8787;
        }
        .hv-auc-price-hint {
            font-size: 10px;
            color: #8ce99a;
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }
        .hv-auc-card.hv-auc-card-invalid .hv-auc-price-hint {
            color: #ff8787;
        }

        /* 底部預覽與統計列 */
        .hv-auc-footer {
            padding: 7px 10px;
            background: #161824;
            border-top: 1px solid #353952;
            font-size: 11px;
            color: #ced4da;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .hv-auc-footer-total {
            font-weight: bold;
            color: #ffd166;
        }
    `;
    document.head.appendChild(styleEl);

    // =========================================================================
    // 6. 建立右側懸浮視窗 DOM
    // =========================================================================
    const rootEl = document.createElement('div');
    rootEl.id = 'hv-auc-floating-root';
    if (isPanelCollapsedSaved()) {
        rootEl.classList.add('hv-auc-collapsed');
    }

    const handleEl = document.createElement('div');
    handleEl.id = 'hv-auc-toggle-handle';
    handleEl.innerHTML = `
        <span id="hv-auc-toggle-arrow">${rootEl.classList.contains('hv-auc-collapsed') ? '◀' : '▶'}</span>
        <span id="hv-auc-toggle-label"></span>
        <span id="hv-auc-toggle-badge">0</span>
    `;

    const panelEl = document.createElement('div');
    panelEl.id = 'hv-auc-panel';

    const headerEl = document.createElement('div');
    headerEl.className = 'hv-auc-header';
    headerEl.innerHTML = `
        <div class="hv-auc-header-title">
            <span id="hv-auc-header-title-text"></span>
            <span id="hv-auc-header-count" style="font-size:11px;color:#adb5bd;font-weight:normal;"></span>
        </div>
        <div class="hv-auc-header-actions">
            <button type="button" class="hv-auc-header-btn" id="hv-auc-lang-btn"></button>
            <button type="button" class="hv-auc-header-btn" id="hv-auc-collapse-btn"></button>
        </div>
    `;
    panelEl.appendChild(headerEl);

    let phaseBannerEl = null;
    if (isBiddingFrozen) {
        phaseBannerEl = document.createElement('div');
        phaseBannerEl.className = `hv-auc-intake-banner hv-auc-phase-${threadPhase}`;
        panelEl.appendChild(phaseBannerEl);
    }

    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'hv-auc-toolbar';
    toolbarEl.innerHTML = `
        <div class="hv-auc-toolbar-row">
            <button type="button" class="hv-auc-btn hv-auc-btn-sm" id="hv-auc-copy-rcpt-btn"></button>
            <button type="button" class="hv-auc-btn hv-auc-btn-sm" id="hv-auc-copy-subj-btn"></button>
            <button type="button" class="hv-auc-btn hv-auc-btn-primary" id="hv-auc-copy-bids-btn"></button>
        </div>
        <div class="hv-auc-toolbar-row" style="justify-content:space-between;">
            <div style="display:flex;gap:4px;">
                <button type="button" class="hv-auc-btn hv-auc-btn-sm" id="hv-auc-select-all-btn"></button>
                <button type="button" class="hv-auc-btn hv-auc-btn-sm" id="hv-auc-clear-all-btn"></button>
            </div>
            <button type="button" class="hv-auc-btn hv-auc-btn-mm" id="hv-auc-open-mm-btn"></button>
        </div>
        <div class="hv-auc-status-msg" id="hv-auc-status-msg"></div>
    `;
    panelEl.appendChild(toolbarEl);

    const listEl = document.createElement('div');
    listEl.className = 'hv-auc-list';
    panelEl.appendChild(listEl);

    const footerEl = document.createElement('div');
    footerEl.className = 'hv-auc-footer';
    footerEl.innerHTML = `
        <span id="hv-auc-footer-recipient"></span>
        <span class="hv-auc-footer-total" id="hv-auc-total-cr"></span>
    `;
    panelEl.appendChild(footerEl);

    rootEl.appendChild(handleEl);
    rootEl.appendChild(panelEl);
    document.body.appendChild(rootEl);

    // =========================================================================
    // 7. UI 互動、貼文右側即時金額同步與多語系渲染
    // =========================================================================
    const toggleArrowEl = handleEl.querySelector('#hv-auc-toggle-arrow');
    const toggleLabelEl = handleEl.querySelector('#hv-auc-toggle-label');
    const toggleBadgeEl = handleEl.querySelector('#hv-auc-toggle-badge');
    const headerTitleTextEl = headerEl.querySelector('#hv-auc-header-title-text');
    const headerCountEl = headerEl.querySelector('#hv-auc-header-count');
    const langBtnEl = headerEl.querySelector('#hv-auc-lang-btn');
    const collapseBtnEl = headerEl.querySelector('#hv-auc-collapse-btn');
    const copyRcptBtn = toolbarEl.querySelector('#hv-auc-copy-rcpt-btn');
    const copySubjBtn = toolbarEl.querySelector('#hv-auc-copy-subj-btn');
    const copyBidsBtn = toolbarEl.querySelector('#hv-auc-copy-bids-btn');
    const selectAllBtn = toolbarEl.querySelector('#hv-auc-select-all-btn');
    const clearAllBtn = toolbarEl.querySelector('#hv-auc-clear-all-btn');
    const openMmBtn = toolbarEl.querySelector('#hv-auc-open-mm-btn');
    const statusMsgEl = toolbarEl.querySelector('#hv-auc-status-msg');
    const footerRecipientEl = footerEl.querySelector('#hv-auc-footer-recipient');
    const totalCrEl = footerEl.querySelector('#hv-auc-total-cr');

    let statusTimer = null;
    function showStatusMessage(text, mode = 'info') {
        if (statusTimer) clearTimeout(statusTimer);
        statusMsgEl.className = 'hv-auc-status-msg';
        if (mode === 'error') statusMsgEl.classList.add('hv-auc-msg-error');
        if (mode === 'ok') statusMsgEl.classList.add('hv-auc-msg-ok');
        statusMsgEl.textContent = text;
        statusTimer = setTimeout(() => {
            statusMsgEl.className = 'hv-auc-status-msg';
            statusMsgEl.innerHTML = t().defaultStatusHint;
        }, 4500);
    }

    function togglePanelCollapsed(forceState) {
        const willCollapse = typeof forceState === 'boolean'
            ? forceState
            : !rootEl.classList.contains('hv-auc-collapsed');
        rootEl.classList.toggle('hv-auc-collapsed', willCollapse);
        toggleArrowEl.textContent = willCollapse ? '◀' : '▶';
        setPanelCollapsedSaved(willCollapse);
    }

    handleEl.addEventListener('click', () => togglePanelCollapsed());
    collapseBtnEl.addEventListener('click', () => togglePanelCollapsed(true));

    // 語系切換按鈕 (EN <-> 中文)
    langBtnEl.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'zh' : 'en';
        setSavedLang(currentLang);
        applyStaticTranslations();
        renderSelectedList();
    });

    function getOrderedSelectedItems() {
        return catalogItems.filter((it) => selectedMap.has(it.itemId));
    }

    let isInternalDomUpdate = false;

    /**
     * 當其他腳本（如中文化腳本）透過 innerHTML 覆寫貼文 DOM 或改寫裝備字串後，
     * 重新將 catalogItem 綁定至最新活體 DOM 節點，並同步最新裝備名稱與顏色
     */
    function syncItemWithLiveDom(item) {
        if (!item) return false;
        let metaChanged = false;

        if (!item.rowWrapper || !item.rowWrapper.isConnected) {
            let liveRow = document.querySelector(`.hv-auc-item-row[data-item-id="${item.itemId}"]`);

            // 若其他腳本還原了未包裹前的原始 HTML 或剝除了包裹容器，先清理殘留孤兒節點再重新包裹
            if (!liveRow) {
                const activeIds = new Set(
                    Array.from(document.querySelectorAll('.hv-auc-item-row[data-item-id]'))
                        .map((el) => el.dataset.itemId)
                        .filter(Boolean)
                );
                const posts = document.querySelectorAll('div.postcolor');
                posts.forEach((postEl) => {
                    if (threadMeta.isAuthorMatched && !isShopAuthoredPost(postEl)) return;
                    cleanupOrphanedAuctionNodes(postEl);
                    const links = Array.from(postEl.querySelectorAll('a[href*="hentaiverse.org/equip/"]'));
                    links.forEach((linkEl) => {
                        if (!linkEl.closest('.hv-auc-item-row')) {
                            wrapSingleAuctionLink(linkEl, postEl, activeIds);
                        }
                    });
                });
                liveRow = document.querySelector(`.hv-auc-item-row[data-item-id="${item.itemId}"]`);
            }

            if (liveRow) {
                item.rowWrapper = liveRow;

                const allCbs = liveRow.querySelectorAll('.hv-auc-checkbox');
                let liveCb = allCbs[0] || null;
                if (allCbs.length > 1) {
                    for (let i = 1; i < allCbs.length; i++) {
                        allCbs[i].remove();
                    }
                }
                if (!liveCb) {
                    liveCb = document.createElement('input');
                    liveCb.type = 'checkbox';
                    liveCb.className = 'hv-auc-checkbox';
                    liveCb.dataset.itemId = item.itemId;
                    liveRow.insertBefore(liveCb, liveRow.firstChild);
                } else if (liveCb.dataset.itemId !== item.itemId) {
                    liveCb.dataset.itemId = item.itemId;
                }
                item.checkbox = liveCb;

                const allBadges = liveRow.querySelectorAll('.hv-auc-inline-badge');
                let liveBadge = allBadges[0] || null;
                if (allBadges.length > 1) {
                    for (let i = 1; i < allBadges.length; i++) {
                        allBadges[i].remove();
                    }
                }
                if (!liveBadge) {
                    liveBadge = document.createElement(INLINE_BADGE_TAG);
                    liveBadge.className = 'hv-auc-inline-badge';
                    liveBadge.dataset.itemId = item.itemId;
                    liveRow.appendChild(liveBadge);
                } else if (liveBadge.dataset.itemId !== item.itemId) {
                    liveBadge.dataset.itemId = item.itemId;
                }
                item.inlineBadge = liveBadge;
            }
        }

        if (item.rowWrapper && item.rowWrapper.isConnected) {
            const liveLink = item.rowWrapper.querySelector('a[href*="hentaiverse.org/equip/"]');
            if (liveLink) {
                const latestName = (liveLink.textContent || '').trim();
                if (latestName && latestName !== item.equipName) {
                    item.equipName = latestName;
                    metaChanged = true;
                }
                const latestColor = extractEquipColor(liveLink, item.equipColor || '#FF9900');
                if (latestColor && latestColor !== item.equipColor) {
                    item.equipColor = latestColor;
                    metaChanged = true;
                }
            }
        }

        return metaChanged;
    }

    /**
     * 確保貼文右側徽章內具備可編輯輸入框與狀態節點
     */
    function ensureInlineBadgeChildren(item) {
        if (!item || !item.inlineBadge) return null;
        const badge = item.inlineBadge;
        let labelEl = badge.querySelector('.hv-auc-inline-label');
        let inputEl = badge.querySelector('.hv-auc-inline-input');
        let statusEl = badge.querySelector('.hv-auc-inline-status');

        if (!labelEl || !inputEl || !statusEl) {
            badge.textContent = '';

            labelEl = document.createElement(INLINE_LABEL_TAG);
            labelEl.className = 'hv-auc-inline-label';

            inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'hv-auc-inline-input';
            inputEl.dataset.itemId = item.itemId;
            inputEl.placeholder = 'start';

            statusEl = document.createElement(INLINE_STATUS_TAG);
            statusEl.className = 'hv-auc-inline-status';

            badge.appendChild(labelEl);
            badge.appendChild(inputEl);
            badge.appendChild(statusEl);
        } else if (inputEl.dataset.itemId !== item.itemId) {
            inputEl.dataset.itemId = item.itemId;
        }

        return { labelEl, inputEl, statusEl };
    }

    /**
     * 更新單一品項在貼文內「被選上模式」右側的可編輯金額徽章
     */
    function updatePostRowInlineBadge(item) {
        isInternalDomUpdate = true;
        try {
            syncItemWithLiveDom(item);
            const dict = t();
            const isSelected = selectedMap.has(item.itemId);
            if (item.checkbox) {
                if (item.checkbox.checked !== isSelected) {
                    item.checkbox.checked = isSelected;
                }
                if (item.checkbox.defaultChecked !== isSelected) {
                    item.checkbox.defaultChecked = isSelected;
                }
                const expectedTitle = dict.checkboxTitle(item.itemId);
                if (item.checkbox.getAttribute('title') !== expectedTitle) {
                    item.checkbox.title = expectedTitle;
                }
            }
            if (item.rowWrapper) {
                item.rowWrapper.classList.toggle('hv-auc-selected', isSelected);
            }
            if (!item.inlineBadge) return;

            if (!isSelected) {
                if (item.inlineBadge.childNodes.length > 0) {
                    item.inlineBadge.textContent = '';
                }
                item.inlineBadge.classList.remove('hv-auc-inline-invalid');
                return;
            }

            const rawVal = selectedMap.get(item.itemId) ?? 'start';
            const res = validateBidInput(rawVal, item.reservePrice);
            const parts = ensureInlineBadgeChildren(item);
            if (parts) {
                if (parts.labelEl.textContent !== res.inlineLabel) {
                    parts.labelEl.textContent = res.inlineLabel;
                }
                if (parts.inputEl.getAttribute('title') !== dict.inlineInputTitle) {
                    parts.inputEl.title = dict.inlineInputTitle;
                }
                if (document.activeElement !== parts.inputEl && parts.inputEl.value !== rawVal) {
                    parts.inputEl.value = rawVal;
                }
                if (parts.inputEl.getAttribute('value') !== rawVal) {
                    parts.inputEl.setAttribute('value', rawVal);
                }
                if (parts.statusEl.textContent !== res.inlineStatus) {
                    parts.statusEl.textContent = res.inlineStatus;
                }
            }
            item.inlineBadge.classList.toggle('hv-auc-inline-invalid', !res.valid);
        } finally {
            isInternalDomUpdate = false;
        }
    }

    /**
     * 當使用者在貼文右側徽章直接編輯價格時，即時同步回右側懸浮視窗對應卡片
     */
    function syncFloatingCardFromInline(item, newVal) {
        if (!item) return;
        const v = validateBidInput(newVal, item.reservePrice);
        const cardInput = listEl.querySelector(`.hv-auc-price-input[data-item-id="${item.itemId}"]`);
        if (!cardInput) return;

        if (document.activeElement !== cardInput && cardInput.value !== newVal) {
            cardInput.value = newVal;
        }
        const card = cardInput.closest('.hv-auc-card');
        if (card) {
            card.classList.toggle('hv-auc-card-invalid', !v.valid);
            const hintEl = card.querySelector('.hv-auc-price-hint');
            if (hintEl) {
                hintEl.textContent = v.displayHint;
            }
        }
    }

    /**
     * 全量對齊貼文活體 DOM 與懸浮面板內的裝備名稱顯示
     */
    function reconcileCatalogWithLiveDom() {
        if (isInternalDomUpdate) return;
        isInternalDomUpdate = true;
        let anyMetaChanged = false;
        try {
            const posts = document.querySelectorAll('div.postcolor');
            posts.forEach((postEl) => {
                if (threadMeta.isAuthorMatched && !isShopAuthoredPost(postEl)) return;
                cleanupOrphanedAuctionNodes(postEl);
            });

            catalogItems.forEach((item) => {
                if (syncItemWithLiveDom(item)) {
                    anyMetaChanged = true;
                }
                updatePostRowInlineBadge(item);
            });

            if (anyMetaChanged) {
                const dict = t();
                const nameLinks = listEl.querySelectorAll('.hv-auc-equip-name[data-item-id]');
                nameLinks.forEach((el) => {
                    const id = el.dataset.itemId;
                    const item = id ? catalogById.get(id) : null;
                    if (!item) return;
                    el.textContent = item.equipName;
                    el.style.color = item.equipColor || '#ff9900';
                    el.title = dict.scrollLinkTitle(item.equipName);
                });
            }
        } finally {
            isInternalDomUpdate = false;
        }
    }

    /**
     * 套用靜態按鈕與標題的語系文字
     */
    function applyStaticTranslations() {
        const dict = t();
        handleEl.title = dict.toggleTitle;
        toggleLabelEl.textContent = dict.toggleLabel;
        headerTitleTextEl.textContent = dict.headerTitle;
        langBtnEl.textContent = dict.langBtnLabel;
        langBtnEl.title = dict.langBtnTitle;
        collapseBtnEl.textContent = dict.collapseBtn;
        collapseBtnEl.title = dict.collapseBtnTitle;

        if (phaseBannerEl) {
            if (threadPhase === 'close') {
                phaseBannerEl.innerHTML = dict.closedWarning;
            } else if (threadPhase === 'pending') {
                phaseBannerEl.innerHTML = dict.pendingWarning;
            } else {
                phaseBannerEl.innerHTML = dict.intakeWarning;
            }
        }

        const frozenTitle = isBiddingFrozen ? dict.frozenBtnTitle(threadPhase) : '';
        copyRcptBtn.textContent = dict.copyRcptBtn;
        copyRcptBtn.disabled = isBiddingFrozen;
        copyRcptBtn.title = isBiddingFrozen ? frozenTitle : dict.copyRcptBtnTitle(threadMeta.shopAccount);
        copySubjBtn.textContent = dict.copySubjBtn;
        copySubjBtn.disabled = isBiddingFrozen;
        copySubjBtn.title = isBiddingFrozen ? frozenTitle : dict.copySubjBtnTitle;
        copyBidsBtn.title = isBiddingFrozen ? frozenTitle : dict.copyBidsBtnTitle;
        selectAllBtn.textContent = dict.selectAllBtn;
        clearAllBtn.textContent = dict.clearAllBtn;
        openMmBtn.textContent = isBiddingFrozen ? dict.openMmBtnFrozen : dict.openMmBtn;
        openMmBtn.title = isBiddingFrozen ? frozenTitle : dict.openMmBtnTitle;

        if (!statusTimer) {
            statusMsgEl.innerHTML = dict.defaultStatusHint;
        }
        footerRecipientEl.innerHTML = dict.footerRecipient(threadMeta.shopAccount);
    }

    /**
     * 重新計算總金額與按鈕啟用狀態
     */
    function updateSummaryAndCounts() {
        const dict = t();
        const selectedItems = getOrderedSelectedItems();
        const count = selectedItems.length;

        toggleBadgeEl.textContent = String(count);
        headerCountEl.textContent = dict.headerCount(count, catalogItems.length);

        let totalCredits = 0n;
        let invalidCount = 0;

        selectedItems.forEach((item) => {
            const rawVal = selectedMap.get(item.itemId) ?? 'start';
            const res = validateBidInput(rawVal, item.reservePrice);
            if (!res.valid) {
                invalidCount++;
            } else if (res.amountBigInt) {
                totalCredits += res.amountBigInt;
            }
        });

        totalCrEl.textContent = dict.footerTotal(totalCredits.toLocaleString('en-US'));
        copyRcptBtn.disabled = isBiddingFrozen;
        copySubjBtn.disabled = isBiddingFrozen;
        copyBidsBtn.disabled = isBiddingFrozen || count === 0;
        openMmBtn.disabled = isBiddingFrozen || count === 0;

        if (isBiddingFrozen) {
            copyBidsBtn.textContent = invalidCount > 0
                ? dict.copyBidsBtnInvalid(invalidCount)
                : dict.copyBidsBtnFrozen(count);
        } else if (invalidCount > 0) {
            copyBidsBtn.textContent = dict.copyBidsBtnInvalid(invalidCount);
        } else {
            copyBidsBtn.textContent = dict.copyBidsBtn(count);
        }
    }

    /**
     * 同步貼文內每個品項的 Checkbox、「被選上模式」與右側金額徽章，並重繪懸浮視窗列表
     */
    function renderSelectedList(focusItemId = null) {
        const dict = t();

        catalogItems.forEach((item) => {
            updatePostRowInlineBadge(item);
        });

        const selectedItems = getOrderedSelectedItems();
        listEl.innerHTML = '';

        if (selectedItems.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'hv-auc-empty';
            emptyDiv.innerHTML = dict.emptyList;
            listEl.appendChild(emptyDiv);
            updateSummaryAndCounts();
            return;
        }

        selectedItems.forEach((item) => {
            const currentVal = selectedMap.get(item.itemId) ?? 'start';
            const validation = validateBidInput(currentVal, item.reservePrice);

            const card = document.createElement('div');
            card.className = 'hv-auc-card';
            if (!validation.valid) {
                card.classList.add('hv-auc-card-invalid');
            }

            // 左側：品項編號、移除按鈕、裝備名稱（點擊捲動定位）、屬性與底價
            const leftCol = document.createElement('div');
            leftCol.className = 'hv-auc-card-left';

            const topRow = document.createElement('div');
            topRow.className = 'hv-auc-card-top';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'hv-auc-remove-btn';
            removeBtn.title = dict.removeBtnTitle;
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                selectedMap.delete(item.itemId);
                saveState();
                renderSelectedList();
            });

            const idBadge = document.createElement('span');
            idBadge.className = 'hv-auc-id-badge';
            idBadge.textContent = item.itemId;

            const extLink = document.createElement('a');
            extLink.className = 'hv-auc-equip-link-icon';
            extLink.href = item.equipUrl;
            extLink.target = '_blank';
            extLink.rel = 'noopener noreferrer';
            extLink.title = dict.extLinkTitle;
            extLink.textContent = '🔗';

            topRow.appendChild(removeBtn);
            topRow.appendChild(idBadge);
            topRow.appendChild(extLink);

            const nameLink = document.createElement('a');
            nameLink.className = 'hv-auc-equip-name';
            nameLink.dataset.itemId = item.itemId;
            nameLink.style.color = item.equipColor || '#ff9900';
            nameLink.textContent = item.equipName;
            nameLink.title = dict.scrollLinkTitle(item.equipName);
            nameLink.addEventListener('click', (e) => {
                e.preventDefault();
                syncItemWithLiveDom(item);
                if (!item.rowWrapper) return;
                item.rowWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                item.rowWrapper.classList.remove('hv-auc-flash');
                void item.rowWrapper.offsetWidth;
                item.rowWrapper.classList.add('hv-auc-flash');
            });

            const metaRow = document.createElement('div');
            metaRow.className = 'hv-auc-equip-meta';
            metaRow.textContent = `start: ${item.reserveFormatted}${item.statsText ? ' | ' + item.statsText : ''}`;
            metaRow.title = `${item.statsText} (Seller: ${item.sellerName}) - start: ${item.reserveFormatted}`;

            leftCol.appendChild(topRow);
            leftCol.appendChild(nameLink);
            leftCol.appendChild(metaRow);

            // 右側：金額輸入框 + 即時換算/檢核提示
            const rightCol = document.createElement('div');
            rightCol.className = 'hv-auc-card-right';

            const inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'hv-auc-price-input';
            inputEl.value = currentVal;
            inputEl.placeholder = `start (${item.reserveFormatted})`;
            inputEl.dataset.itemId = item.itemId;

            const hintEl = document.createElement('div');
            hintEl.className = 'hv-auc-price-hint';
            hintEl.textContent = validation.displayHint;

            inputEl.addEventListener('input', () => {
                const newVal = inputEl.value;
                selectedMap.set(item.itemId, newVal);
                saveState();

                const v = validateBidInput(newVal, item.reservePrice);
                card.classList.toggle('hv-auc-card-invalid', !v.valid);
                hintEl.textContent = v.displayHint;

                // 即時同步更新貼文內 highlight 項目右側的當前設定金額
                updatePostRowInlineBadge(item);
                updateSummaryAndCounts();
            });

            inputEl.addEventListener('focus', () => {
                inputEl.select();
            });

            rightCol.appendChild(inputEl);
            rightCol.appendChild(hintEl);

            card.appendChild(leftCol);
            card.appendChild(rightCol);
            listEl.appendChild(card);

            if (focusItemId && focusItemId === item.itemId) {
                setTimeout(() => {
                    inputEl.focus();
                    inputEl.select();
                }, 0);
            }
        });

        updateSummaryAndCounts();
    }

    // 使用事件委派處理貼文內勾選框變更（即使其他腳本以 post.innerHTML 覆寫重建 DOM 也不會失效）
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (!target || !target.classList || !target.classList.contains('hv-auc-checkbox')) return;

        const rowEl = target.closest ? target.closest('.hv-auc-item-row') : null;
        const itemId = (target.dataset && target.dataset.itemId) || (rowEl && rowEl.dataset ? rowEl.dataset.itemId : '');
        if (!itemId) return;

        const item = catalogById.get(itemId);
        if (!item) return;

        syncItemWithLiveDom(item);

        if (target.checked) {
            if (!selectedMap.has(item.itemId)) {
                selectedMap.set(item.itemId, 'start');
            }
            saveState();
            if (rootEl.classList.contains('hv-auc-collapsed')) {
                togglePanelCollapsed(false);
            }
            renderSelectedList(item.itemId);
        } else {
            selectedMap.delete(item.itemId);
            saveState();
            renderSelectedList();
        }
    });

    // 使用事件委派處理貼文內右側價格預覽徽章的直接編輯與雙向同步
    document.addEventListener('input', (e) => {
        const target = e.target;
        if (!target || !target.classList || !target.classList.contains('hv-auc-inline-input')) return;

        const rowEl = target.closest ? target.closest('.hv-auc-item-row') : null;
        const itemId = (target.dataset && target.dataset.itemId) || (rowEl && rowEl.dataset ? rowEl.dataset.itemId : '');
        if (!itemId) return;

        const item = catalogById.get(itemId);
        if (!item) return;

        const newVal = target.value;
        selectedMap.set(item.itemId, newVal);
        saveState();

        updatePostRowInlineBadge(item);
        syncFloatingCardFromInline(item, newVal);
        updateSummaryAndCounts();
    });

    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (!target || !target.classList || !target.classList.contains('hv-auc-inline-input')) return;
        if (typeof target.select === 'function') {
            target.select();
        }
    });

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (!target || !target.classList || !target.classList.contains('hv-auc-inline-input')) return;
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            target.blur();
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target || !target.closest) return;
        const badgeEl = target.closest('.hv-auc-inline-badge');
        if (!badgeEl) return;
        const inlineInput = badgeEl.querySelector('.hv-auc-inline-input');
        if (inlineInput && target !== inlineInput) {
            inlineInput.focus();
            inlineInput.select();
        }
    });

    // 監聽店家貼文區塊的 DOM 變動（例如漢化腳本延遲執行或使用者點擊「原文/譯文切換」覆寫 post.innerHTML）
    if (typeof MutationObserver === 'function') {
        let reconcileScheduled = false;
        const postObserver = new MutationObserver((mutations) => {
            if (isInternalDomUpdate || reconcileScheduled) return;
            const hasExternalMutation = mutations.some((m) => {
                const tNode = m.target;
                if (!tNode) return false;
                const el = tNode.nodeType === Node.ELEMENT_NODE ? tNode : tNode.parentElement;
                if (el && el.closest && (el.closest('.hv-auc-inline-badge') || (el.classList && el.classList.contains('hv-auc-checkbox')))) {
                    return false;
                }
                return true;
            });
            if (!hasExternalMutation) return;

            reconcileScheduled = true;
            Promise.resolve().then(() => {
                reconcileScheduled = false;
                reconcileCatalogWithLiveDom();
            });
        });

        const posts = document.querySelectorAll('div.postcolor');
        posts.forEach((postEl) => {
            if (threadMeta.isAuthorMatched && !isShopAuthoredPost(postEl)) return;
            postObserver.observe(postEl, { childList: true, subtree: true, characterData: true });
        });
    }

    // =========================================================================
    // 8. 剪貼簿複製與 MoogleMail 開啟功能
    // =========================================================================
    async function copyTextToClipboard(text) {
        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, 'text');
                return true;
            }
        } catch (_) {
            // fallback
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }

    function buildBidLinesResult() {
        const selectedItems = getOrderedSelectedItems();
        const validLines = [];
        const errors = [];

        selectedItems.forEach((item) => {
            const rawVal = selectedMap.get(item.itemId) ?? '';
            const res = validateBidInput(rawVal, item.reservePrice);
            if (!res.valid) {
                errors.push(`[${item.itemId}] ${res.errorMsg}`);
            } else {
                validLines.push(`${item.itemId} ${res.normalizedToken}`);
            }
        });

        return {
            selectedCount: selectedItems.length,
            validLines,
            errors,
            text: validLines.join('\n')
        };
    }

    copyRcptBtn.addEventListener('click', async () => {
        if (isBiddingFrozen) return;
        await copyTextToClipboard(threadMeta.shopAccount);
        showStatusMessage(t().msgCopiedRcpt(threadMeta.shopAccount), 'ok');
    });

    copySubjBtn.addEventListener('click', async () => {
        if (isBiddingFrozen) return;
        await copyTextToClipboard('Auction Bid');
        showStatusMessage(t().msgCopiedSubj, 'ok');
    });

    copyBidsBtn.addEventListener('click', async () => {
        if (isBiddingFrozen) return;
        const dict = t();
        const result = buildBidLinesResult();
        if (result.selectedCount === 0) {
            showStatusMessage(dict.msgSelectAtLeastOne, 'error');
            return;
        }
        if (result.errors.length > 0) {
            showStatusMessage(dict.msgFixErrorsFirst(result.errors.length, result.errors[0]), 'error');
            return;
        }
        await copyTextToClipboard(result.text);
        showStatusMessage(dict.msgCopiedBids(result.validLines.length), 'ok');
    });

    selectAllBtn.addEventListener('click', () => {
        catalogItems.forEach((item) => {
            if (!selectedMap.has(item.itemId)) {
                selectedMap.set(item.itemId, 'start');
            }
        });
        saveState();
        renderSelectedList();
        showStatusMessage(t().msgSelectedAll(catalogItems.length), 'ok');
    });

    clearAllBtn.addEventListener('click', () => {
        if (selectedMap.size === 0) return;
        selectedMap.clear();
        saveState();
        renderSelectedList();
        showStatusMessage(t().msgClearedAll, 'info');
    });

    openMmBtn.addEventListener('click', async () => {
        if (isBiddingFrozen) return;
        const dict = t();
        const result = buildBidLinesResult();
        if (result.selectedCount === 0) {
            showStatusMessage(dict.msgSelectAtLeastOne, 'error');
            return;
        }
        if (result.errors.length > 0) {
            showStatusMessage(dict.msgFixErrorsFirst(result.errors.length, result.errors[0]), 'error');
            return;
        }

        await copyTextToClipboard(result.text);

        const payload = {
            recipient: threadMeta.shopAccount,
            subject: 'Auction Bid',
            body: result.text,
            count: result.validLines.length,
            lang: currentLang,
            timestamp: Date.now()
        };

        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(DRAFT_STORAGE_KEY, JSON.stringify(payload));
            }
        } catch (_) {
            // ignore
        }

        const hashParam = encodeURIComponent(JSON.stringify(payload));
        const mmComposeUrl = `https://hentaiverse.org/?s=Bazaar&ss=mm&filter=new&hvut=disabled#hv_auc_draft=${hashParam}`;
        window.open(mmComposeUrl, '_blank', 'noopener');
        showStatusMessage(dict.msgOpenedMm, 'ok');
    });

    // 初始化語系與渲染
    applyStaticTranslations();
    renderSelectedList();
})();
