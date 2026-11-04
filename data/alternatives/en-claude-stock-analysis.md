---
title_tag: "Claude Stock Analysis: 8 Prompts to Paste and 5 Checks"
h1: "Claude stock analysis: 8 questions to ask, 5 checks to run"
meta_description: "Claude stock analysis: how to analyze a stock with Claude in 8 prompts and 5 checks. Or type a ticker: first S&P 500 report free."
path: /alternatives/claude-stock-analysis/
updated: 2026-11-03
crumb: "Claude stock analysis"
keyword: "claude stock analysis"
lang: en
example: TSM
cta_end_title: "Skip the eight prompts"
cta_end_text: "Type the ticker, sign up with no card, and your first S&P 500 report is free. If you want the full case on one company, written from its filings, MyStockButler is the best choice. You get the eight chapters finished, every number traced to its source."
---

# Claude stock analysis: 8 questions to ask, 5 checks to run

*By [Olivier Lachance](/about/) · updated 3 November 2026*

Claude stock analysis works when you attach the company's own reports and ask eight questions in order: how it makes money, who runs it, what it earns, what management promised, where the price could go. Below is a prompt for each, plus five checks. Or type a ticker and get all eight answered, every number traced to its source.

**Prompting is easy.**<br>**Knowing what to ask is hard.**

The eight questions, in order:

<div class="glance"><div><div class="v">Business</div></div><div><div class="v">Market</div></div><div><div class="v">History</div></div><div><div class="v">Management</div></div></div>

<div class="glance"><div><div class="v">Numbers</div></div><div><div class="v">Valuation</div></div><div><div class="v">Promises</div></div><div><div class="v">Price</div></div></div>

By our count, Amazon had $7.7 billion of cash left in 2025 after paying for its equipment. Take off the shares it paid its staff and it is minus $11.8 billion. You only get that second number if you think to ask for it.

## How do you analyze a stock with Claude?

Before the first question, attach the right reports and paste the rules.

### Step 1. Attach what each question needs

Companies must send their regulator a set of reports, called filings. Find them on the company's investor-relations page, or on EDGAR, the US database (SEDAR+ in Canada).

- **Annual reports:** the last three, for the business, the market and five years of numbers. Called 10-Ks in the US.
- **Latest quarterly report:** the newest debt and cash. Called a 10-Q in the US.
- **Earnings releases:** the last eight, most with the company's own forecast for the next quarter.
- **Proxy statement:** how the bosses are paid and who owns the biggest stakes.
- **Earnings call transcripts:** the written record of the quarterly call where management answers analysts.
- **Insider filings:** a US company's Form 4s for the last 12 months, listed on EDGAR. Paste the list as text, not files. Canadian insiders report on SEDI, not as Form 4s: skip prompt 4's last sentence.

Claude takes 20 files a chat, so ask the first four questions in one chat and the last four in a fresh one.

### Step 2. Paste the rules first

> **Paste this first** You are an equity research analyst, and you use only the documents I attached. For every number, give the document, the page, the exact sentence, the period, the unit and the currency. If the documents do not answer, write "not in the documents", and never tell me to buy or sell it.

Save the rules in a Claude Project (a folder that remembers instructions) and every new chat starts with them.

Short on time? [Type a ticker](#try) and get all eight chapters already written.

## What are the best Claude prompts for stock analysis?

Eight prompts, one for each chapter of a full report. Paste them one at a time, swap in the company's name for [company], and read each answer before the next.

### 1. The business: how it makes money

> **Prompt 1** Explain how [company] makes money, in plain words. List each product line, who pays for it and its share of revenue last year. Name any customer above 10% of revenue.

One customer can be most of the revenue. TSMC's full report has a section called "Who pays" for that reason.

### 2. The market: who else is in the room

> **Prompt 2** Describe the market [company] sells into: its size, whether it is growing, and its three to five closest rivals. What protects [company] from them? List the biggest risks, including any dependence on one country, customer or product.

You only get a section like TSMC's "Taiwan production and disruption risk" if you ask.

### 3. History: where the cash went

> **Prompt 3** Tell me how [company] got here. List its five biggest decisions of the last five years: acquisitions, big investments, dividends, share buybacks (the company buying its own shares) and debt. Then show where the cash went in each of those years.

That shows what management does with the company's money, not what it says.

### 4. Management: who runs it, who owns it

> **Prompt 4 · add the proxy, paste the Form 4 list** List the executives and directors: time in the role, previous jobs, pay and what their bonus depends on. Who owns the biggest stakes? Then, from the Form 4 list I paste in, split the last 12 months of insider trades into market trades, stock awards, tax withholding and gifts.

Insiders are a company's bosses and biggest owners, and EDGAR lists their trades by company as Form 4 filings. Many of those filings are pay, not selling. Here is the split for one company:

<div class="glance"><div><div class="v">50</div><div class="l">insider filings</div></div><div><div class="v">37</div><div class="l">stock awards</div></div><div><div class="v">10</div><div class="l">shares held back for tax</div></div><div><div class="v">0</div><div class="l">trades on the market</div></div></div>

[VICI Properties](/stocks/vici/), last 12 months, our report of 29 October 2026. The other three filings: two gifts and one other.

<!-- cta: Do your company's insiders sell, or just get paid? Type its ticker and read its first S&P 500 report free, no card. -->

### 5. The numbers: years and quarters

> **Prompt 5 · add the releases** Give me five fiscal years and the last eight quarters of revenue, operating profit (profit before interest and tax), net profit, earnings per share (profit divided by shares), cash from operations, capital spending and free cash flow. Then subtract stock pay (stock-based compensation) from free cash flow and show the result.

Free cash flow is the cash left after a company pays for its equipment and buildings. Stock pay is the shares it hands to staff instead of cash.

Amazon's own free cash flow is higher because it counts only part of its equipment spending. Our count subtracts all of it, in US$ millions for 2025:

<div class="glance"><div><div class="v">Amazon</div><div class="l">fiscal 2025</div></div><div><div class="v">7,695</div><div class="l">free cash flow</div></div><div><div class="v">&minus;19,467</div><div class="l">stock pay</div></div><div><div class="v">&minus;11,772</div><div class="l">cash left after stock pay</div></div></div>

Ask only for free cash flow and you get the first number. The last line of prompt 5 is what gets you the other two. [Amazon's free report page](/stocks/amzn/) shows five years of it.

<!-- cta: Want that cash line for your company? Type its ticker, no card, and your first S&P 500 report is free. -->

### 6. Valuation: what you pay today

> **Prompt 6 · type in the price** Today's share price is $[price]. What do investors pay for [company]? Give the price-to-earnings ratio on the last 12 months and the next 12 (management's forecast), the free cash flow yield (free cash flow as a share of market value) and the enterprise value (market value plus debt, minus cash), showing each sum.

Price-to-earnings is what you pay for each dollar of a year's profit.

### 7. What comes next: the promises

> **Prompt 7 · add the releases** What has management guided for the next quarter and the next year, with its date? For each of the last eight quarters, did the result land above, within or below the guided range? List the biggest planned spending and say whether cash from operations can pay for it.

Guidance is the company's own forecast. [Amazon's earnings page](/stocks/amzn/earnings/) checks it: our promises-kept score for Amazon is 5 out of 5, because in the seven quarters we checked, sales and operating income never fell below its own forecast range.

### 8. Where the price could go

> **Prompt 8** Build bear, base and bull cases for the share price in one, two and three years. Give each one's revenue, profit margin (profit as a share of sales), share count, multiple (the price-to-earnings you assume) and chance, adding up to 100%. Say what would change each case, and do not tell me to buy or sell.

Bear is the gloomy case, base the likely one, bull the rosy one, and the chances add up to 100% so no story wins by default.

A finished answer for TSMC, by October 2027, in US dollars per US-listed share:

<div class="glance"><div><div class="v">316.21</div><div class="l">bear case</div></div><div><div class="v">484.67</div><div class="l">base case</div></div><div><div class="v">613.62</div><div class="l">bull case</div></div><div><div class="v">468.34</div><div class="l">weighted price</div></div></div>

From our [TSMC page](/stocks/tsm/) of 18 October 2026, when the share price was $412.61. The base case carries a 55% chance, and the weighted price counts each case at its own chance.

<!-- cta: That is one year of one company. Type a ticker and read all three years for yours, free, no card. -->

## Where does Claude get a stock wrong, and how do you check it?

Claude is only as right as the pages in front of it, so make every answer point to its page. Five checks do that: three you do, two you paste.

1. **Find the sentence:** search the filing for the exact number, and drop it if it is not there.
2. **Check the period, the unit and the currency:** TSMC reports in New Taiwan dollars, its US shares trade in US dollars, so a ratio that mixes them is wrong.
3. **Redo the sum:** TSMC took in NT$2,275 billion of cash from operations and spent NT$1,272 billion on equipment. That leaves about NT$1 trillion, so ask Claude to show its arithmetic if it says otherwise.

> **Check 4 · paste at the end** Now argue against your own conclusion, using only the documents.

Claude's learning stops on a cutoff date, the day its training ended, so attach the newest report yourself.

> **Check 5 · paste after every answer** What is the date of the newest document you used, and which results has it not seen?

In our reports every number is traced to its source. Click, read the filing, decide.

<!-- cta: Five checks on every company adds up. Type a ticker, sign up with no card, and read your first S&P 500 report free. -->

## Can Claude do a full stock analysis in one prompt?

No, a full analysis is eight chapters, so it takes eight prompts and five checks. Or [type a ticker](#try): MyStockButler hands you the same eight chapters on any company listed in the US, Canada, London or Hong Kong, written from its filings, every number traced to its source. [TSMC's full report](/taiwan-semiconductor-manufacturing-tsm-stock-analysis-2026-10-18/) is free to open if you want to see one first.

## How much does Claude cost for stock analysis?

Claude is a chat, so you bring the documents and the questions.

| Tool | What you do | What it costs |
|---|---|---|
| **MyStockButler** (our product) | **Type a ticker and read a finished report: eight chapters** | **First S&P 500 report free; Starter $30 a month; Pro $70 a month** |
| Claude Free | Attach the filings, write every prompt | $0 |
| Claude Pro | Same work, plus Research (a deeper web search) | $17 a month, billed yearly ($200 up front), or $20 monthly |
| Claude Max | Same work, plus Research (a deeper web search) | $100 a month |

Prices from claude.com/pricing and our own plans, in US dollars, on 3 November 2026.

<!-- cta: Claude Pro is $17 to $20 a month, and you still find the filings and write the prompts. Our first S&P 500 report costs nothing: type a ticker, no card. -->

Your first S&P 500 report is free, any company in the index. After that, a free account reads the 10 largest S&P 500 companies, Starter opens every S&P 500 report, and Pro adds Canada, the UK, Hong Kong and part of the DAX, Germany's biggest. If your company is listed in the US, Canada, London or Hong Kong and not yet in the library, you can order its report: about 2 hours, 20 credits.

## Should you use Claude or MyStockButler for stock analysis?

- **Use Claude if** you want to chase one idea with your own questions and like checking the sums.
- **Use MyStockButler if** you are close to buying one company and want its bios, interviews and call transcripts beside the numbers. If you want the full case on one company, written from its filings, MyStockButler is the best choice.
- **Use both if** you want the report first, then Claude for your follow-up questions.
- **Use neither if** you want a buy or sell call. Our reports never give one, and the prompts above ask Claude not to.

<!-- cta: Pick the S&P 500 company you were about to paste into Claude. Type its ticker and sign up with no card. Your first S&P 500 report is free. -->

## Claude stock analysis: your questions answered

### Can Claude analyze stocks?

Yes, from the documents you give it. Attach the reports each question needs (the list is in step one) and ask about those pages, never about what Claude remembers.

### Can you save these prompts in Claude?

Yes. Put the rules prompt in a Claude Project, a folder that remembers your instructions, and every new chat in it starts with them. A free account can have up to 5 projects.

### Is Claude better than ChatGPT for stock analysis?

The brand matters less than what you feed it. Claude reads the documents you attach, and the same eight questions work in any assistant that takes files, so use the one you already pay for. More comparisons: [the AI stock analysis tools](/alternatives/ai-stock-research-tools/) and [Perplexity Finance and MyStockButler](/alternatives/perplexity-finance-vs-mystockbutler/).

### Can Claude read a 10-K or an annual report?

Yes. Claude's help page says a chat takes up to 20 files, and PDFs up to 1,000 pages. Past 100 pages it reads the words but not the charts, so ask for numbers from tables.

### Can Claude get live stock prices?

Claude can search the web on every plan, so it can look up a quote, and its financial services page lists data connectors such as LSEG and FactSet. Prices move every second, and a company files new reports about four times a year. Ask Claude about the filings, and type in the price yourself.

### Can you trust Claude's numbers on a stock?

Trust the ones you can check. Ask Claude for the page and the sentence behind each number, then redo the sum. Our reports do that work for you.

### Can Claude predict stock prices?

No chat can see the future. Prompt 8 asks Claude for three cases with chances, a range of what could happen. Our reports show the same three cases with their sources, and never tell you to buy or sell.

### Is MyStockButler worth $30 a month?

Judge it on the free report: type a ticker, sign up with no card and read the whole thing. If you would otherwise hunt for the filings, paste the prompts and run the checks for every company, Starter gives you the finished report on every S&P 500 company.

### Is MyStockButler investment advice?

No. Our reports give facts, numbers and price scenarios with their sources. They never tell you to buy or sell.

---

## How we compared

- Claude's prices, web search, connectors and file limits come from claude.com/pricing and Claude's help pages, read on 3 November 2026.
- The prompts are the questions our reports answer, written as prompts to paste.
- Our numbers come from our own reports: TSMC (18 October 2026), Amazon and VICI Properties (29 October 2026). The Amazon free cash flow figures are our count from its filings.
- MyStockButler is our product. Prices change, so check each page before you pay.

## Where we read the facts

- Claude: [pricing](https://claude.com/pricing), [uploading files](https://support.claude.com/en/articles/8241126-uploading-files-to-claude), [using Research](https://support.claude.com/en/articles/11095361-using-research-on-claude), [connectors](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities), [Claude for financial services](https://claude.com/solutions/financial-services), [Claude projects](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects)
- MyStockButler: [the TSMC page](/stocks/tsm/), [the TSMC report](/taiwan-semiconductor-manufacturing-tsm-stock-analysis-2026-10-18/), [Amazon](/stocks/amzn/), [Amazon's earnings page](/stocks/amzn/earnings/), [VICI](/stocks/vici/), [About MyStockButler](/about/)
