---
title_tag: "Methodology: How a MyStockButler Report Is Made"
h1: "How a MyStockButler report is made"
meta_description: "An AI system writes each report from the company's filings and results. Where the numbers come from, how they are traced and how the scenarios work."
path: /methodology/
updated: 2026-11-01
lang: en
---

# How a MyStockButler report is made

MyStockButler is an AI stock research agent: an AI system writes each report from the company's own filings and results. This page explains where the numbers come from, how they are traced and how the price scenarios work. Nothing in a report is investment advice.

## Where the numbers come from

The system reads what the company publishes: annual reports, quarterly results, and filings with the SEC or other regulators. The kind of company decides which tables it fills, because a bank, an insurer and a mining company are not measured the same way. Figures for a rival come from that rival's own reports.

Today's share price and the analysts' estimates come from a market data feed. When a company reports in one currency and its shares trade in another, the report uses a dated exchange rate. A figure the company does not print, such as a margin, is worked out from its reported numbers with a fixed formula.

## How a number is traced

For each number in its tables, the system keeps the line it copied and the address of the page it came from. Our software then opens each cited page and records whether that line is there. Every report ends with a list of its sources, so you can open them and check a number yourself.

## How the report is written

The chapters are written around those tables, in the order an analyst works: the company first, the price last. Under each table, a fold-out explains each row in plain words.

When the report is finished, a last AI pass reads all of it, tables included, searches the web and corrects or deletes any statement it finds plainly untrue. AI systems still make mistakes, which is why the sources are listed and why we ask you to [report any error you find](/corrections/).

## How the price scenarios work

The forecast chapter sets out three scenarios for the share price: bear, base and bull. The AI system writes a story for each one and fills in its assumptions year by year, such as sales growth, margins and the valuation multiple, with its reasons. Our software does the arithmetic: the price at dates up to about three years out, and the return with dividends. The AI system then gives each scenario a probability, and the software works out the weighted price.

Scenarios are scenarios, not predictions. They show what would have to happen for the price to reach each level.

## How reports stay current

Each company page shows the date of the report it quotes. The reports in the library are redone as companies publish new results.

## What a report is not

A report shows facts, numbers and scenarios with their sources. It is AI-generated research for information only, not investment advice, and the decision is yours. Check the cited documents before making an investment decision.

*By [Olivier Lachance](/about/) · updated on 1 November 2026.*
