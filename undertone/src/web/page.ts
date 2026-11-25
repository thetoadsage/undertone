const FACE = `<svg class="face" viewBox="0 0 48 48" aria-hidden="true">
  <rect x="3" y="3" width="42" height="42" rx="14" fill="currentColor" />
  <g class="eyes" fill="var(--bg)">
    <rect x="15" y="17" width="6" height="13" rx="3" />
    <rect x="27" y="17" width="6" height="13" rx="3" />
  </g>
</svg>`;

export const SETUP_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#09090a" />
    <title>Undertone</title>
    <style>
      @font-face {
        font-family: "U Display";
        font-weight: 200 800;
        src: url(/undertone/font/display.woff2) format("woff2");
        font-display: swap;
      }
      @font-face {
        font-family: "U Text";
        font-weight: 300 900;
        src: url(/undertone/font/text.woff2) format("woff2");
        font-display: swap;
      }
      :root {
        --bg: #09090a;
        --s1: #101012;
        --s2: #151518;
        --s3: #1c1c20;
        --line: #ffffff12;
        --line2: #ffffff1f;
        --fg: #f4f4f5;
        --dim: #a3a3ab;
        --mut: #6c6c75;
        --acc: #ff6a3d;
        --warn: #f0b24a;
        --bad: #ff7a66;
        --ok: #6fd08c;
        --display: "U Display", -apple-system, "Segoe UI", Roboto, sans-serif;
        --text: "U Text", -apple-system, "Segoe UI", Roboto, sans-serif;
        --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      * {
        box-sizing: border-box;
      }
      html {
        -webkit-text-size-adjust: 100%;
        background: var(--bg);
      }
      body {
        margin: 0;
        font: 400 15px/1.55 var(--text);
        color: var(--fg);
        background: var(--bg);
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }
      button,
      input,
      select,
      textarea {
        font: inherit;
        color: inherit;
      }
      ::selection {
        background: color-mix(in srgb, var(--acc) 55%, transparent);
        color: #fff;
      }
      .hidden {
        display: none !important;
      }
      :focus-visible {
        outline: 2px solid var(--fg);
        outline-offset: 2px;
        border-radius: 6px;
      }
      h1,
      h2,
      h3 {
        font-family: var(--display);
        margin: 0;
        font-weight: 600;
      }
      h1 {
        font-size: clamp(40px, 6.4vw, 84px);
        line-height: 0.98;
        letter-spacing: -0.045em;
        text-wrap: balance;
      }
      h1 span {
        color: var(--mut);
      }
      h2 {
        font-size: 22px;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }
      h3 {
        font-size: 16px;
        line-height: 1.3;
        letter-spacing: -0.01em;
        font-family: var(--text);
      }
      .lede {
        color: var(--dim);
        font-size: clamp(16px, 1.5vw, 19px);
        line-height: 1.5;
        max-width: 33em;
        margin: 22px 0 0;
        text-wrap: pretty;
      }
      .sub {
        color: var(--mut);
        font-size: 14px;
      }

      .wrap {
        max-width: 1040px;
        margin: 0 auto;
        padding: 0 clamp(18px, 4vw, 36px);
      }
      .glow {
        position: absolute;
        inset: 0 0 auto 0;
        height: 620px;
        z-index: -1;
        pointer-events: none;
        overflow: hidden;
      }
      .glow::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -340px;
        width: 1100px;
        height: 640px;
        transform: translateX(-50%);
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--acc) 15%, transparent),
          transparent
        );
      }

      .bar {
        position: sticky;
        top: 0;
        z-index: 30;
        background: color-mix(in srgb, var(--bg) 72%, transparent);
        -webkit-backdrop-filter: saturate(1.6) blur(16px);
        backdrop-filter: saturate(1.6) blur(16px);
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
      }
      .bar.stuck {
        border-color: var(--line);
      }
      .bar .wrap {
        display: flex;
        align-items: center;
        gap: 22px;
        height: 60px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font: 600 17px/1 var(--display);
        letter-spacing: -0.03em;
        color: var(--fg);
        text-decoration: none;
      }
      .face {
        width: 26px;
        height: 26px;
        flex: none;
        color: var(--fg);
      }
      .fc {
        display: block;
        width: 100%;
        height: 100%;
      }
      .face .eyes {
        transition: transform 0.12s ease-out;
        transform-box: fill-box;
        transform-origin: center;
      }
      nav {
        display: flex;
        gap: 2px;
        margin-left: 14px;
      }
      nav button {
        all: unset;
        cursor: pointer;
        padding: 7px 12px;
        border-radius: 8px;
        color: var(--dim);
        font-size: 14px;
        font-weight: 500;
        transition:
          color 0.15s,
          background 0.15s;
      }
      nav button:hover {
        color: var(--fg);
      }
      nav button.on {
        color: var(--fg);
        background: var(--s3);
      }
      .me {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .me .who {
        display: flex;
        align-items: center;
        gap: 9px;
        color: var(--dim);
        font-size: 14px;
        padding-right: 8px;
      }
      .av {
        width: 28px;
        height: 28px;
        flex: none;
      }

      .hero {
        padding: clamp(48px, 9vw, 112px) 0 clamp(36px, 5vw, 60px);
      }
      .covers {
        overflow: hidden;
      }
      .covers {
        padding: 0 0 clamp(28px, 4vw, 44px);
      }
      .covers.gone {
        display: none;
      }
      .covers .track {
        display: flex;
        width: max-content;
        will-change: transform;
      }
      .covers.on .track {
        animation: slide 140s linear infinite;
      }
      .covers .grp {
        display: flex;
        gap: 10px;
        padding-right: 10px;
        flex: none;
      }
      .covers .cv {
        position: relative;
        width: clamp(96px, 11vw, 148px);
        aspect-ratio: 1;
        border-radius: 10px;
        flex: none;
        overflow: hidden;
      }
      .covers img {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.5s;
      }
      .covers img.shown {
        opacity: 1;
      }
      @keyframes slide {
        to {
          transform: translate3d(-50%, 0, 0);
        }
      }

      .sk {
        position: relative;
        overflow: hidden;
        background: var(--s2);
        border-radius: 8px;
      }
      .sk::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, #ffffff0f, transparent);
        transform: translateX(-100%);
        animation: shim 1.3s infinite;
      }
      @keyframes shim {
        to {
          transform: translateX(100%);
        }
      }
      .skrow {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 18px;
      }
      .skrow + .skrow {
        border-top: 1px solid var(--line);
      }

      .notice {
        margin-bottom: 14px;
        padding: 14px 16px;
        border-radius: 14px;
        background: color-mix(in srgb, var(--warn) 9%, var(--s1));
        border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
        color: var(--fg);
        font-size: 14.5px;
      }
      .notice button {
        all: unset;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .cmd {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 58px;
        padding: 0 8px 0 18px;
        border-radius: 14px;
        background: var(--s1);
        border: 1px solid var(--line2);
        box-shadow:
          0 1px 0 #ffffff0a inset,
          0 20px 40px -24px #000;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }
      .cmd:focus-within {
        border-color: #ffffff3d;
        box-shadow:
          0 1px 0 #ffffff0a inset,
          0 0 0 4px #ffffff0d,
          0 20px 40px -24px #000;
      }
      .cmd svg {
        width: 18px;
        height: 18px;
        color: var(--mut);
        flex: none;
      }
      .cmd input {
        all: unset;
        flex: 1;
        min-width: 0;
        font-size: 16px;
      }
      .cmd input::placeholder {
        color: var(--mut);
      }
      kbd {
        font: 500 12px/1 var(--text);
        color: var(--mut);
        padding: 5px 7px;
        border-radius: 6px;
        border: 1px solid var(--line2);
        background: var(--s2);
      }
      .result {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 10px;
        padding: 12px;
        border-radius: 14px;
        background: var(--s1);
        border: 1px solid var(--line);
        animation: in 0.35s var(--ease);
      }
      .result img {
        width: 52px;
        height: 52px;
        border-radius: 8px;
        object-fit: cover;
        background: var(--s2);
        flex: none;
      }
      .result .t {
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .result .m {
        color: var(--dim);
        font-size: 14px;
      }
      .result .via {
        margin-left: auto;
        text-align: right;
        font-size: 14px;
        color: var(--dim);
        white-space: nowrap;
        padding-right: 6px;
      }
      .result .via b {
        display: block;
        color: var(--fg);
        font-weight: 600;
      }
      .result .via.no b {
        color: var(--bad);
      }
      .busy {
        height: 2px;
        margin: 14px 6px 0;
        border-radius: 2px;
        background: linear-gradient(90deg, transparent, var(--fg), transparent) no-repeat;
        background-size: 30% 100%;
        animation: scan 1s linear infinite;
        opacity: 0.5;
      }
      @keyframes scan {
        from {
          background-position: -40% 0;
        }
        to {
          background-position: 140% 0;
        }
      }
      @keyframes in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }

      .sect {
        padding-top: clamp(36px, 5vw, 56px);
      }
      .secthead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .secthead p {
        margin: 4px 0 0;
      }
      .list {
        border-radius: 16px;
        background: var(--s1);
        border: 1px solid var(--line);
        overflow: hidden;
      }
      .item + .item,
      .list > .adder + .item,
      .item + .adder {
        border-top: 1px solid var(--line);
      }
      .item .head {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 18px;
        transition: background 0.15s;
      }
      .item .ctl {
        height: 44px;
      }
      .item .head:hover {
        background: #ffffff05;
      }
      .tile {
        width: 44px;
        height: 44px;
        flex: none;
      }
      .tile img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 13px;
      }
      .item .nm {
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .item .ds {
        color: var(--dim);
        font-size: 14px;
        margin-top: 1px;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .item .txt {
        min-width: 0;
        flex: 1;
      }
      .item.off .nm,
      .item.off .tile {
        opacity: 0.45;
      }
      .st {
        font-size: 13.5px;
        color: var(--mut);
        white-space: nowrap;
      }
      .st.warn {
        color: var(--warn);
      }
      .st.bad {
        color: var(--bad);
      }
      .st.ok {
        color: var(--ok);
      }
      .ib {
        all: unset;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        color: var(--mut);
        transition:
          background 0.15s,
          color 0.15s;
        flex: none;
      }
      .ib:hover:not(:disabled) {
        background: var(--s3);
        color: var(--fg);
      }
      .ib:disabled {
        opacity: 0.25;
        cursor: default;
      }
      .ib svg {
        width: 16px;
        height: 16px;
      }
      .ib.chev svg {
        transition: transform 0.25s var(--ease);
      }
      .item.open .ib.chev svg {
        transform: rotate(180deg);
      }
      .sw {
        position: relative;
        width: 40px;
        height: 24px;
        flex: none;
        display: block;
      }
      .sw input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 1;
      }
      .sw span {
        position: absolute;
        inset: 0;
        border-radius: 8px;
        background: var(--s3);
        box-shadow: inset 0 0 0 1px var(--line2);
        transition:
          background 0.2s,
          box-shadow 0.2s;
      }
      .sw span::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 5px;
        background: var(--dim);
        box-shadow: 0 1px 2px #0008;
        transition:
          transform 0.24s var(--ease),
          background 0.2s,
          width 0.15s;
      }
      .sw:hover span {
        box-shadow: inset 0 0 0 1px #ffffff38;
      }
      .sw:active span::after {
        width: 21px;
      }
      .sw:active input:checked + span::after {
        transform: translateX(13px);
      }
      .sw input:checked + span {
        background: var(--acc);
        box-shadow:
          inset 0 0 0 1px #ffffff26,
          inset 0 1px 0 #ffffff40;
      }
      .sw input:checked + span::after {
        transform: translateX(16px);
        background: #fff;
      }
      .sw input:focus-visible + span {
        outline: 2px solid var(--fg);
        outline-offset: 2px;
      }
      .body {
        padding: 6px 18px 20px 72px;
        animation: in 0.3s var(--ease);
      }
      .body .fields {
        max-width: 480px;
      }
      .from {
        margin-top: 16px;
        font-size: 13px;
        color: var(--mut);
        word-break: break-all;
      }
      .adder {
        display: flex;
        gap: 10px;
        align-items: center;
        padding: 14px 18px;
        background: #ffffff04;
      }
      .adder input {
        flex: 1;
        min-width: 0;
      }
      .adder.alt {
        flex-wrap: wrap;
        border-top: 1px solid var(--line);
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .empty {
        padding: 44px 24px;
        text-align: center;
        color: var(--dim);
      }
      .empty b {
        display: block;
        color: var(--fg);
        font: 600 18px/1.3 var(--display);
        letter-spacing: -0.02em;
        margin-bottom: 4px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 12px;
      }
      .pick {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 16px;
        border-radius: 16px;
        background: var(--s1);
        border: 1px solid var(--line);
        transition:
          border-color 0.15s,
          background 0.15s;
      }
      .pick:hover {
        border-color: var(--line2);
        background: var(--s2);
      }
      .pick .txt {
        flex: 1;
        min-width: 0;
      }
      .pick .nm {
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .pick .ds {
        color: var(--dim);
        font-size: 14px;
        margin-top: 2px;
      }
      .pick .btn {
        height: 34px;
        padding: 0 13px;
      }

      .f {
        display: block;
        margin-bottom: 16px;
      }
      .f > b {
        display: block;
        font-weight: 500;
        font-size: 14px;
        margin-bottom: 7px;
      }
      .f > b em {
        font-style: normal;
        font-weight: 400;
        color: var(--mut);
      }
      .f small,
      .tg small {
        display: block;
        color: var(--mut);
        font-size: 13.5px;
        margin-top: 6px;
        line-height: 1.45;
      }
      .in {
        width: 100%;
        height: 42px;
        background: var(--bg);
        border: 1px solid var(--line2);
        border-radius: 10px;
        padding: 0 13px;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .in:hover {
        border-color: #ffffff2e;
      }
      .in:focus {
        outline: none;
        border-color: #ffffff59;
        box-shadow: 0 0 0 4px #ffffff0f;
      }
      .in::placeholder {
        color: var(--mut);
      }
      select.in {
        appearance: none;
        -webkit-appearance: none;
        padding-right: 36px;
        background-image:
          linear-gradient(45deg, transparent 50%, var(--dim) 50%),
          linear-gradient(135deg, var(--dim) 50%, transparent 50%);
        background-position:
          calc(100% - 19px) 50%,
          calc(100% - 14px) 50%;
        background-size: 5px 5px;
        background-repeat: no-repeat;
      }
      textarea.in {
        height: auto;
        min-height: 110px;
        padding: 11px 13px;
        resize: vertical;
      }
      .tg {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .tg b {
        display: block;
        font-weight: 500;
        font-size: 14px;
      }
      .btn {
        all: unset;
        cursor: pointer;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 38px;
        padding: 0 15px;
        border-radius: 10px;
        background: var(--fg);
        color: #0a0a0b;
        font-weight: 600;
        font-size: 14px;
        white-space: nowrap;
        transition:
          transform 0.1s,
          background 0.15s,
          box-shadow 0.15s;
      }
      .btn:hover {
        background: #fff;
        box-shadow: 0 0 0 4px #ffffff14;
      }
      .btn:active {
        transform: scale(0.97);
      }
      .btn.alt {
        background: var(--s3);
        color: var(--fg);
        box-shadow: inset 0 0 0 1px var(--line2);
        font-weight: 500;
      }
      .btn.alt:hover {
        background: #26262b;
      }
      .btn.ghost {
        background: transparent;
        color: var(--dim);
        font-weight: 500;
        padding: 0 10px;
      }
      .btn.ghost:hover {
        background: var(--s3);
        color: var(--fg);
        box-shadow: none;
      }
      .btn.risk {
        background: transparent;
        color: var(--bad);
        font-weight: 500;
        padding: 0 10px;
      }
      .btn.risk:hover {
        background: color-mix(in srgb, var(--bad) 12%, transparent);
        box-shadow: none;
      }
      .btn.lg {
        height: 46px;
        border-radius: 12px;
        font-size: 15px;
        width: 100%;
      }
      .row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .row .sp {
        flex: 1;
      }
      .note {
        font-size: 13.5px;
        color: var(--dim);
        margin-top: 12px;
        min-height: 1.2em;
      }
      .note.ok {
        color: var(--ok);
      }
      .note.bad {
        color: var(--bad);
      }

      .prog {
        height: 4px;
        border-radius: 2px;
        background: var(--s3);
        margin-top: 18px;
        overflow: hidden;
      }
      .prog i {
        display: block;
        height: 100%;
        width: 0;
        background: var(--fg);
        border-radius: 2px;
        transition: width 0.3s;
      }
      .trk {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 11px 18px;
        font-size: 14.5px;
      }
      .trk + .trk {
        border-top: 1px solid var(--line);
      }
      .trk .n {
        color: var(--mut);
        font-variant-numeric: tabular-nums;
      }
      .trk .a {
        color: var(--dim);
      }
      .trk .t {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .phead {
        padding: clamp(40px, 7vw, 84px) 0 clamp(26px, 4vw, 40px);
      }
      .phead h1 {
        font-size: clamp(34px, 4.6vw, 56px);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
        align-items: start;
      }
      .card {
        border-radius: 16px;
        background: var(--s1);
        border: 1px solid var(--line);
        padding: 22px;
      }
      .card h2 {
        margin-bottom: 4px;
      }
      .card > p {
        color: var(--dim);
        margin: 0 0 18px;
        font-size: 14.5px;
      }
      .addr {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 10px 10px 20px;
        border-radius: 16px;
        background: var(--s1);
        border: 1px solid var(--line2);
      }
      .addr span {
        flex: 1;
        min-width: 0;
        font: 500 clamp(18px, 2.6vw, 28px)/1.2 var(--display);
        letter-spacing: -0.03em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .steps {
        list-style: none;
        counter-reset: n;
        margin: 16px 0 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .steps li {
        counter-increment: n;
        border-radius: 16px;
        background: var(--s1);
        border: 1px solid var(--line);
        padding: 20px;
        color: var(--dim);
        font-size: 14.5px;
      }
      .steps li::before {
        content: counter(n);
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: var(--s3);
        border: 1px solid var(--line2);
        color: var(--fg);
        font: 600 13px/1 var(--text);
        margin-bottom: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14.5px;
      }
      th {
        text-align: left;
        font-weight: 500;
        color: var(--mut);
        font-size: 13px;
        padding: 0 0 10px;
      }
      td {
        padding: 12px 0;
        border-top: 1px solid var(--line);
      }
      .tag {
        display: inline-block;
        font-size: 12.5px;
        line-height: 1;
        padding: 5px 8px;
        border-radius: 6px;
        background: var(--s2);
        border: 1px solid var(--line);
        color: var(--dim);
      }
      .tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .toast {
        position: fixed;
        left: 50%;
        bottom: 26px;
        transform: translate(-50%, 20px);
        z-index: 50;
        padding: 11px 16px;
        border-radius: 12px;
        background: var(--s3);
        border: 1px solid var(--line2);
        box-shadow: 0 20px 50px -10px #000;
        font-weight: 500;
        font-size: 14px;
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s var(--ease);
        max-width: 90vw;
      }
      .toast.on {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      .toast.bad {
        border-color: color-mix(in srgb, var(--bad) 50%, transparent);
        color: var(--bad);
      }
      footer {
        margin-top: clamp(64px, 9vw, 120px);
        padding: 22px 0 36px;
        border-top: 1px solid var(--line);
        color: var(--mut);
        font-size: 13.5px;
      }

      .gate {
        position: relative;
        min-height: 100vh;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        overflow: hidden;
      }
      .gate::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -30%;
        width: 1200px;
        height: 900px;
        transform: translateX(-50%);
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--acc) 13%, transparent),
          transparent
        );
        pointer-events: none;
      }
      .gate form {
        position: relative;
        width: 100%;
        max-width: 380px;
      }
      .gate .face {
        width: 52px;
        height: 52px;
        margin-bottom: 26px;
      }
      .gate h1 {
        font-size: 34px;
        letter-spacing: -0.035em;
        line-height: 1.05;
      }
      .gate form > p {
        color: var(--dim);
        margin: 10px 0 28px;
        min-height: 1.5em;
      }
      .gate .in {
        height: 46px;
        border-radius: 12px;
        font-size: 15.5px;
        background: var(--s1);
      }
      .swap {
        margin-top: 22px;
        color: var(--mut);
        font-size: 14px;
        text-align: center;
      }
      .swap button {
        all: unset;
        cursor: pointer;
        color: var(--fg);
        font-weight: 500;
      }
      .swap button:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      @media (max-width: 760px) {
        .bar .wrap {
          height: auto;
          flex-wrap: wrap;
          padding-top: 12px;
          gap: 10px;
        }
        nav {
          order: 3;
          width: 100%;
          margin: 0 -6px;
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .me .who span {
          display: none;
        }
        .item .head {
          flex-wrap: wrap;
          padding: 14px;
        }
        .item .txt {
          flex: 1 1 calc(100% - 60px);
        }
        .item .ctl {
          margin-left: 54px;
        }
        .body {
          padding: 4px 14px 18px;
        }
        .result {
          flex-wrap: wrap;
        }
        .result .via {
          margin-left: 66px;
          text-align: left;
        }
        .cmd kbd {
          display: none;
        }
        .adder {
          flex-wrap: wrap;
        }
        .adder .btn {
          width: 100%;
        }
      }
      .ctl {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ctl .sw {
        margin: 0 6px;
      }
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation: none !important;
          transition: none !important;
        }
      }
    </style>
  </head>
  <body>
    <div id="gate" class="gate hidden">
      <form id="authForm">
        ${FACE}
        <h1 id="authTitle">Sign in</h1>
        <p id="authHint"></p>
        <label class="f"
          ><b>Username</b
          ><input
            class="in"
            id="u"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
        /></label>
        <label class="f"
          ><b>Password</b><input class="in" id="p" type="password" autocomplete="current-password"
        /></label>
        <label class="f hidden" id="p2wrap"
          ><b>Confirm password</b
          ><input class="in" id="p2" type="password" autocomplete="new-password"
        /></label>
        <button class="btn lg" id="authGo" type="submit" style="margin-top: 8px">Sign in</button>
        <div class="note" id="authMsg"></div>
        <div class="swap hidden" id="authSwap">
          <span id="authSwapText"></span> <button id="authSwapBtn" type="button"></button>
        </div>
      </form>
    </div>

    <div id="app" class="hidden">
      <div class="glow"></div>
      <div class="bar" id="bar">
        <div class="wrap">
          <a class="brand" href="/setup"
            >${FACE}<span class="sname">Undertone</span></a
          >
          <nav id="nav">
            <button data-tab="sources" class="on">Connections</button>
            <button data-tab="import">Import</button>
            <button data-tab="connect">Apps</button>
            <button data-tab="account">Account</button>
            <button data-tab="admin" id="adminTab" class="hidden">People</button>
          </nav>
          <div class="me">
            <div class="who">
              <div class="av" id="av"></div>
              <span id="who"></span>
            </div>
            <button class="btn ghost" id="logout">Sign out</button>
          </div>
        </div>
      </div>

      <div data-pane="sources">
        <div class="wrap">
          <div class="phead">
            <h1>Connections</h1>
            <p class="lede">
              Each one links Undertone to a service you use, for audio, playlists or listening
              history. Nothing is built in.
            </p>
          </div>
        </div>
        <div class="covers" id="covers">
          <div class="track"><div class="grp" id="coverSk"></div></div>
        </div>
        <div class="wrap">
          <div class="notice hidden" id="noCatalog"></div>
          <label class="cmd">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="tryQ"
              placeholder="Try a song to see what plays it"
              autocomplete="off"
              spellcheck="false"
            />
            <kbd>Enter</kbd>
          </label>
          <div id="tryOut"></div>

          <div class="sect">
            <div class="secthead">
              <div>
                <h2>Installed</h2>
                <p class="sub" id="orderHint">Add one to start playing.</p>
              </div>
              <button class="btn" id="addOpen">Add connection</button>
            </div>
            <div class="list" id="list"></div>
            <div class="note" id="addMsg"></div>
          </div>
          <div class="sect hidden" id="shelf">
            <div class="secthead">
              <div>
                <h2>Available</h2>
                <p class="sub">
                  Picked by whoever runs this server. You can also paste a link to any other.
                </p>
              </div>
            </div>
            <div class="grid" id="shelfGrid"></div>
          </div>
        </div>
      </div>

      <div data-pane="import" class="hidden">
        <div class="wrap">
          <div class="phead">
            <h1>Import a playlist</h1>
            <p class="lede">
              Paste a playlist link, or a list of songs copied from any app. A link needs a
              connection for that service; a plain list always works.
            </p>
          </div>
          <div class="card">
            <textarea
              class="in"
              id="impIn"
              placeholder="https://…/playlist/…&#10;&#10;or one song per line:&#10;Artist - Title&#10;Artist - Title"
              spellcheck="false"
              style="min-height: 150px"
            ></textarea>
            <div class="row" style="margin-top: 14px">
              <button class="btn" id="impRead">Read it</button
              ><span class="note" id="impMsg" style="margin: 0"></span>
            </div>
          </div>
          <div id="impStage" class="hidden" style="margin-top: 16px">
            <div class="card">
              <label class="f"
                ><b>Playlist name</b><input class="in" id="impName" placeholder="Imported playlist"
              /></label>
              <label class="tg" style="margin-bottom: 18px"
                ><span class="sw"><input type="checkbox" id="impWarm" checked /><span></span></span
                ><span
                  ><b>Get the songs ready to play</b
                  ><small
                    >Each song is looked up on your connections now, so it starts at once later. One
                    set to “only cached” still downloads nothing.</small
                  ></span
                ></label
              >
              <div class="row">
                <button class="btn" id="impGo">Import</button
                ><span class="sub" id="impCount"></span>
              </div>
              <div class="prog hidden" id="impProg"><i></i></div>
            </div>
            <div class="list" id="impList" style="margin-top: 16px"></div>
          </div>
        </div>
      </div>

      <div data-pane="connect" class="hidden">
        <div class="wrap">
          <div class="phead">
            <h1>Apps</h1>
            <p class="lede">
              To a Jellyfin music app, Undertone is just another server. Add this address and sign
              in with your Undertone account.
            </p>
          </div>
          <div class="addr">
            <span id="srvUrl"></span><button class="btn" id="copyUrl">Copy</button>
          </div>
          <ol class="steps">
            <li>Open a Jellyfin music app, such as Finamp, Feishin, Symfonium or Manet.</li>
            <li>Add a server and paste the address above.</li>
            <li>Search for anything. What you play and favorite becomes your library.</li>
          </ol>
        </div>
      </div>

      <div data-pane="account" class="hidden">
        <div class="wrap">
          <div class="phead"><h1>Account</h1></div>
          <div class="cards">
            <div class="card">
              <h2>Playback</h2>
              <p>
                Direct is lighter on the server. Files that arrive as plain downloads are relayed
                either way, because most players refuse those.
              </p>
              <select class="in" id="mode">
                <option value="redirect">Direct when possible</option>
                <option value="proxy">Always through Undertone</option>
              </select>
              <div class="note" id="modeMsg"></div>
            </div>
            <div class="card">
              <h2>Password</h2>
              <p>Your apps stay signed in.</p>
              <label class="f"
                ><b>Current password</b
                ><input class="in" id="pwCur" type="password" autocomplete="current-password"
              /></label>
              <label class="f"
                ><b>New password</b
                ><input class="in" id="pwNew" type="password" autocomplete="new-password"
              /></label>
              <button class="btn alt" id="pwSave">Change password</button>
              <div class="note" id="pwMsg"></div>
            </div>
          </div>
        </div>
      </div>

      <div data-pane="admin" class="hidden">
        <div class="wrap">
          <div class="phead">
            <h1>People</h1>
            <p class="lede">Everyone has their own connections, library and settings.</p>
          </div>
          <div class="cards">
            <div class="card">
              <h2>Members</h2>
              <p>Who can sign in to this server.</p>
              <table id="userTable"></table>
              <label class="tg" style="margin: 22px 0 0"
                ><span class="sw"><input type="checkbox" id="openSignup" /><span></span></span
                ><span
                  ><b>Let anyone create an account</b
                  ><small
                    >The sign-in page offers “Create an account”. Turn it off to add people
                    yourself.</small
                  ></span
                ></label
              >
            </div>
            <div class="card">
              <h2>Catalog</h2>
              <p>
                Where search, artists, albums and artwork come from. One for the whole server,
                because everyone's library is built on it.
              </p>
              <div id="catNow" style="margin-bottom: 16px"></div>
              <div class="row" id="catPicks" style="margin-bottom: 12px"></div>
              <div class="row">
                <input
                  class="in"
                  id="catUrl"
                  placeholder="Paste the link to a catalog connection file"
                  spellcheck="false"
                  style="flex: 1; min-width: 0"
                /><button class="btn alt" id="catSet">Use it</button>
              </div>
              <div class="note" id="catMsg"></div>
            </div>
            <div class="card">
              <h2>Add a person</h2>
              <p>They sign in with these details.</p>
              <label class="f"
                ><b>Username</b
                ><input class="in" id="nuName" autocapitalize="none" spellcheck="false"
              /></label>
              <label class="f"
                ><b>Password</b
                ><input class="in" id="nuPw" type="password" autocomplete="new-password"
              /></label>
              <label class="tg"
                ><span class="sw"><input type="checkbox" id="nuAdmin" /><span></span></span
                ><span><b>Admin</b><small>Can add and remove people.</small></span></label
              >
              <button class="btn" id="nuBtn">Create account</button>
              <div class="note" id="nuMsg"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="wrap">
        <footer>
          Undertone plays nothing by itself. What you hear comes from what you connect.
        </footer>
      </div>
    </div>
    <div class="toast" id="toast"></div>

    <script>
      const $ = (id) => document.getElementById(id);
      let token = localStorage.getItem("undertone_token");
      let status = {},
        me = null,
        connections = [],
        open = {},
        results = {},
        coversDone = false,
        adding = false,
        authMode = "login",
        shelf = null;
      const DOES = {
        audio: "Audio",
        search: "Finds releases",
        history: "Listening history",
        playlists: "Reads playlists",
        lyrics: "Lyrics",
        catalog: "Catalog",
      };
      const I = {
        up:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 19V5M6 11l6-6 6 6"/>' +
          "</svg>",
        down:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 5v14M6 13l6 6 6-6"/>' +
          "</svg>",
        chev:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M6 9l6 6 6-6"/>' +
          "</svg>",
      };

      const FACE_SKINS = [
        ["#f4f4f5", "#09090a"],
        ["#ff6a3d", "#1c0a03"],
        ["#e9dcbd", "#1a1508"],
        ["#b7d8b0", "#0b1a0a"],
        ["#a8c8ee", "#07131f"],
        ["#cdbcf2", "#120b22"],
        ["#f3b6c4", "#220910"],
        ["#f1cf6a", "#1d1503"],
        ["#34343d", "#f4f4f5"],
        ["#8fd6cf", "#06191a"],
        ["#ffa98a", "#240d04"],
        ["#d7e86b", "#161a02"],
        ["#7fa7ff", "#050e24"],
        ["#e6a6ee", "#200a24"],
        ["#b99a7a", "#150d05"],
        ["#1f3b33", "#d9f2e6"],
        ["#3a2550", "#ecdcff"],
        ["#5b2a22", "#ffe1d6"],
        ["#c9c9d1", "#101014"],
        ["#9be0a8", "#07190c"],
      ];
      const FACE_EYES = [
        [
          [15, 17, 6, 13, 3],
          [27, 17, 6, 13, 3],
        ],
        [
          [14, 19, 8, 8, 2.5],
          [26, 19, 8, 8, 2.5],
        ],
        [
          [13, 21, 9, 5, 2.5],
          [26, 21, 9, 5, 2.5],
        ],
        [
          [15, 17, 6, 13, 3],
          [26, 21, 9, 5, 2.5],
        ],
        [
          [17, 18, 5, 11, 2.5],
          [26, 18, 5, 11, 2.5],
        ],
        [
          [13, 16, 8, 15, 4],
          [27, 16, 8, 15, 4],
        ],
        [
          [14, 20, 7, 10, 3],
          [27, 16, 7, 14, 3],
        ],
        [
          [11, 18, 6, 11, 3],
          [31, 18, 6, 11, 3],
        ],
        [
          [14, 22, 8, 4, 2],
          [26, 22, 8, 4, 2],
        ],
        [
          [15, 15, 5, 8, 2.5],
          [28, 15, 5, 8, 2.5],
        ],
        [
          [13, 18, 10, 10, 3],
          [27, 20, 6, 6, 2],
        ],
        [
          [16, 23, 5, 9, 2.5],
          [27, 23, 5, 9, 2.5],
        ],
        [
          [14, 18, 7, 12, 3.5],
          [27, 18, 7, 12, 3.5],
        ],
        [
          [12, 20, 9, 7, 3],
          [27, 20, 9, 7, 3],
        ],
      ];
      function faceHash(seed) {
        let h = 2166136261;
        const str = String(seed || "?").toLowerCase();
        for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return h >>> 0;
      }
      function faceOf(seed, taken) {
        const h = faceHash(seed);
        let skinI = h % FACE_SKINS.length,
          eyeI = (h >>> 5) % FACE_EYES.length;
        if (taken) {
          for (let n = 0; n < FACE_SKINS.length && taken["s" + skinI]; n++)
            skinI = (skinI + 7) % FACE_SKINS.length;
          for (let n = 0; n < FACE_EYES.length && taken["e" + eyeI]; n++)
            eyeI = (eyeI + 5) % FACE_EYES.length;
          taken["s" + skinI] = taken["e" + eyeI] = 1;
        }
        const skin = FACE_SKINS[skinI],
          eyes = FACE_EYES[eyeI],
          extra = (h >>> 11) % 10,
          tilt = ((h >>> 17) % 5) - 2;
        const r = (x, y, w, hh, rx, op, rot) =>
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          w +
          '" height="' +
          hh +
          '" rx="' +
          rx +
          '"' +
          (op ? ' opacity="' + op + '"' : "") +
          (rot ? ' transform="rotate(' + rot + " " + (x + w / 2) + " " + (y + hh / 2) + ')"' : "") +
          "/>";
        const top0 = Math.min(eyes[0][1], eyes[1][1]);
        let more = "",
          top = "";
        const low = Math.max(eyes[0][1] + eyes[0][3], eyes[1][1] + eyes[1][3]) > 31;
        if (extra === 1 && !low) more = r(20, 35, 8, 3, 1.5);
        else if (extra === 2 && top0 >= 18)
          more = r(14, top0 - 7, 8, 2.5, 1.25) + r(26, top0 - 7, 8, 2.5, 1.25);
        else if (extra === 3) more = r(9, 31, 6, 3.5, 1.75, 0.28) + r(33, 31, 6, 3.5, 1.75, 0.28);
        else if (extra === 4 && !low) more = r(21, 36, 6, 3.5, 1.75);
        else if (extra === 5) top = r(20, 0, 8, 7, 2.5);
        else if (extra === 6 && top0 >= 19)
          more = r(13, top0 - 8, 9, 2.5, 1.25, 0, -12) + r(26, top0 - 8, 9, 2.5, 1.25, 0, 12);
        else if (extra === 7) top = r(9, 0, 7, 8, 2.5) + r(32, 0, 7, 8, 2.5);
        else if (extra === 8 && !low) more = r(17, 36, 14, 3, 1.5);
        else if (extra === 9 && top0 >= 19)
          more = r(13, top0 - 8, 9, 2.5, 1.25, 0, 12) + r(26, top0 - 8, 9, 2.5, 1.25, 0, -12);
        return (
          '<svg class="fc" viewBox="0 0 48 48" aria-hidden="true">' +
          (top ? '<g fill="' + skin[0] + '">' + top + "</g>" : "") +
          '<rect x="3" y="3" width="42" height="42" rx="14" fill="' +
          skin[0] +
          '"/><g fill="' +
          skin[1] +
          '"' +
          (tilt ? ' transform="rotate(' + tilt * 2 + ' 24 24)"' : "") +
          ">" +
          eyes.map((e) => r(e[0], e[1], e[2], e[3], e[4])).join("") +
          more +
          "</g></svg>"
        );
      }

      const faces = Array.prototype.map.call(document.querySelectorAll("svg.face"), (svg) => {
        const eyes = svg.querySelector(".eyes");
        let x = 0,
          y = 0,
          shut = false,
          blink = false;
        const paint = () =>
          eyes.setAttribute(
            "style",
            "transform:translate(" +
              x.toFixed(2) +
              "px," +
              y.toFixed(2) +
              "px) scaleY(" +
              (shut || blink ? 0.12 : 1) +
              ")",
          );
        window.addEventListener(
          "pointermove",
          (e) => {
            if (!svg.getClientRects().length) return;
            const r = svg.getBoundingClientRect(),
              dx = e.clientX - (r.left + r.width / 2),
              dy = e.clientY - (r.top + r.height / 2),
              d = Math.hypot(dx, dy) || 1,
              k = Math.min(1, d / 160);
            x = (dx / d) * 2.6 * k;
            y = (dy / d) * 2.2 * k;
            paint();
          },
          { passive: true },
        );
        const loop = () => {
          blink = true;
          paint();
          setTimeout(() => {
            blink = false;
            paint();
          }, 130);
          setTimeout(loop, 2600 + Math.random() * 3200);
        };
        setTimeout(loop, 1800);
        return {
          shut: (on) => {
            shut = on;
            paint();
          },
        };
      });

      async function api(path, opts) {
        opts = opts || {};
        const res = await fetch("/undertone/api" + path, {
          method: opts.method || (opts.body ? "POST" : "GET"),
          headers: Object.assign(
            { "content-type": "application/json" },
            token ? { authorization: "Bearer " + token } : {},
          ),
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        if (res.status === 401 && token) {
          localStorage.removeItem("undertone_token");
          token = null;
          boot();
          throw new Error("Your session ended. Sign in again.");
        }
        const text = await res.text();
        let data;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = text;
        }
        if (!res.ok) throw new Error((data && data.error) || data || "HTTP " + res.status);
        return data;
      }
      function esc(s) {
        return String(s == null ? "" : s).replace(
          /[&<>"']/g,
          (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
        );
      }
      function say(el, text, ok) {
        el.textContent = text || "";
        el.className = "note" + (ok === undefined ? "" : ok ? " ok" : " bad");
      }
      let toastT;
      function toast(text, bad) {
        const t = $("toast");
        t.textContent = text;
        t.className = "toast on" + (bad ? " bad" : "");
        clearTimeout(toastT);
        toastT = setTimeout(() => (t.className = "toast"), 2800);
      }
      window.addEventListener(
        "scroll",
        () => $("bar").classList.toggle("stuck", window.scrollY > 8),
        { passive: true },
      );

      async function boot() {
        if (token) {
          $("gate").classList.add("hidden");
          $("app").classList.remove("hidden");
          $("list").innerHTML = [0, 1]
            .map(
              () =>
                '<div class="skrow">' +
                '<div class="sk" style="width:44px;height:44px;border-radius:13px">' +
                "</div>" +
                '<div style="flex:1">' +
                '<div class="sk" style="width:140px;height:14px">' +
                "</div>" +
                '<div class="sk" style="width:min(380px,70%);height:12px;margin-top:8px">' +
                "</div>" +
                "</div>" +
                '<div class="sk" style="width:40px;height:24px">' +
                "</div>" +
                "</div>",
            )
            .join("");
          try {
            status = JSON.parse(localStorage.getItem("undertone_status") || "{}");
          } catch (e) {}
        }
        const meP = token ? api("/me").catch(() => null) : null;
        status = await api("/status");
        localStorage.setItem("undertone_status", JSON.stringify(status));
        document.querySelectorAll(".sname").forEach((e) => (e.textContent = status.serverName));
        document.title = status.serverName;
        const r = meP ? await meP : null;
        if (r) render(r);
        else showGate();
      }

      function showGate() {
        $("app").classList.add("hidden");
        $("gate").classList.remove("hidden");
        authMode =
          !status.hasUsers || (status.signupOpen && !localStorage.getItem("undertone_known"))
            ? "register"
            : "login";
        paintGate();
      }
      function paintGate() {
        const first = !status.hasUsers,
          reg = authMode === "register";
        $("authTitle").textContent = first
          ? "Set up " + status.serverName
          : reg
            ? "Create your account"
            : "Sign in to " + status.serverName;
        $("authHint").textContent = first
          ? "Nobody is here yet. The first account becomes the admin."
          : reg
            ? "A username and a password is all it takes."
            : status.signupOpen
              ? ""
              : "Accounts on this server are created by its admin.";
        $("p2wrap").classList.toggle("hidden", !reg);
        $("p").autocomplete = reg ? "new-password" : "current-password";
        $("authGo").textContent = reg ? "Create account" : "Sign in";
        $("authSwap").classList.toggle("hidden", first || !status.signupOpen);
        $("authSwapText").textContent = reg ? "Already have an account?" : "New here?";
        $("authSwapBtn").textContent = reg ? "Sign in" : "Create an account";
        say($("authMsg"), "");
      }
      $("authSwapBtn").onclick = () => {
        authMode = authMode === "register" ? "login" : "register";
        paintGate();
        $("u").focus();
      };
      $("authForm").onsubmit = async (e) => {
        e.preventDefault();
        const reg = authMode === "register";
        if (reg && $("p").value !== $("p2").value)
          return say($("authMsg"), "Those two passwords don't match.", false);
        try {
          const r = await api("/" + (reg ? "register" : "login"), {
            body: { username: $("u").value, password: $("p").value },
          });
          token = r.token;
          localStorage.setItem("undertone_token", token);
          $("p").value = $("p2").value = "";
          boot();
        } catch (err) {
          say($("authMsg"), err.message, false);
        }
      };
      ["p", "p2"].forEach((id) => {
        $(id).onfocus = () => faces.forEach((f) => f.shut(true));
        $(id).onblur = () => faces.forEach((f) => f.shut(false));
      });

      function render(r) {
        me = r.user;
        connections = r.connections || [];
        localStorage.setItem("undertone_known", "1");
        $("gate").classList.add("hidden");
        $("app").classList.remove("hidden");
        $("who").textContent = me.name;
        $("av").innerHTML = faceOf(me.name);
        $("srvUrl").textContent = status.serverUrl;
        $("adminTab").classList.toggle("hidden", !me.isAdmin);
        $("mode").value = me.streamMode;
        $("openSignup").checked = !!status.signupOpen;
        renderCatalog();
        renderSources();
        loadCovers();
        loadShelf();
        if (me.isAdmin) loadUsers();
      }
      async function refresh() {
        render(await api("/me"));
      }
      function tab(t) {
        document
          .querySelectorAll("#nav button")
          .forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
        document
          .querySelectorAll("[data-pane]")
          .forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== t));
        window.scrollTo(0, 0);
      }
      document
        .querySelectorAll("#nav button")
        .forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
      $("copyUrl").onclick = () =>
        navigator.clipboard.writeText(status.serverUrl).then(() => toast("Address copied"));
      $("logout").onclick = () => {
        localStorage.removeItem("undertone_token");
        token = null;
        boot();
      };

      function paintCovers(urls) {
        const tile = (u) =>
          '<div class="cv sk"><img alt="" src="' +
          u +
          '" onload="this.classList.add(&quot;shown&quot;);this.parentNode.classList.remove(&quot;sk&quot;)" onerror="this.remove()"></div>';
        const grp = '<div class="grp">' + urls.map(tile).join("") + "</div>";
        const box = $("covers");
        box.firstElementChild.innerHTML = grp + grp;
        box.firstElementChild.style.animationDuration = Math.round(urls.length * 7) + "s";
        box.classList.add("on");
      }
      async function loadCovers() {
        if (coversDone) return;
        coversDone = true;
        let cached = null;
        try {
          cached = JSON.parse(localStorage.getItem("undertone_covers") || "null");
        } catch (e) {}
        if (cached && cached.length >= 10) paintCovers(cached);
        try {
          const res = await fetch(
            "/Items/Suggestions?Limit=40&api_key=" + encodeURIComponent(token),
          );
          const data = await res.json(),
            items = Array.isArray(data) ? data : data.Items || [];
          const seen = {},
            urls = [];
          items.forEach((it) => {
            const id = it.AlbumId || it.Id;
            if (id && !seen[id]) {
              seen[id] = 1;
              urls.push("/Items/" + id + "/Images/Primary?maxWidth=400");
            }
          });
          const list = urls.slice(0, 20);
          if (list.length < 10) {
            if (!cached) $("covers").classList.add("gone");
            return;
          }
          localStorage.setItem("undertone_covers", JSON.stringify(list));
          if (!cached || cached.join() !== list.join()) paintCovers(list);
        } catch (e) {
          if (!cached) $("covers").classList.add("gone");
        }
      }
      (function () {
        let h = "";
        for (let i = 0; i < 14; i++) h += '<div class="cv sk"></div>';
        $("coverSk").innerHTML = h;
      })();

      function isSecret(s) {
        return s.type === "password" || /token|key|secret|password/i.test(s.key);
      }
      function needs(a) {
        return a.enabled && a.missing && a.missing.length;
      }
      function stateOf(a) {
        if (!a.enabled) return ["", "Off"];
        if (needs(a)) return ["warn", "Needs " + a.missing.join(", ")];
        const r = results[a.id];
        if (r) return r.ok ? ["ok", "Connected"] : ["bad", r.message];
        return ["", ""];
      }
      function field(a, s) {
        const v =
          a.settings[s.key] != null ? a.settings[s.key] : s.default != null ? s.default : "";
        const id = "s_" + a.id + "_" + s.key,
          label = esc(s.label || s.key),
          help = s.help ? "<small>" + esc(s.help) + "</small>" : "";
        if (s.type === "toggle")
          return (
            '<label class="tg"><span class="sw"><input type="checkbox" id="' +
            id +
            '"' +
            (String(v) === "true" ? " checked" : "") +
            "><span></span></span><span><b>" +
            label +
            "</b>" +
            help +
            "</span></label>"
          );
        if (s.type === "select")
          return (
            '<label class="f"><b>' +
            label +
            '</b><select class="in" id="' +
            id +
            '">' +
            (s.options || [])
              .map(
                (o) =>
                  '<option value="' +
                  esc(o.value) +
                  '"' +
                  (String(o.value) === String(v) ? " selected" : "") +
                  ">" +
                  esc(o.label || o.value) +
                  "</option>",
              )
              .join("") +
            "</select>" +
            help +
            "</label>"
          );
        return (
          '<label class="f"><b>' +
          label +
          (s.required ? "" : " <em>(optional)</em>") +
          '</b><input class="in" id="' +
          id +
          '" type="' +
          (s.type === "number" ? "number" : isSecret(s) ? "password" : "text") +
          '" value="' +
          esc(v) +
          '" autocomplete="off" spellcheck="false">' +
          help +
          "</label>"
        );
      }
      function renderSources() {
        $("orderHint").textContent = !connections.length
          ? "Add one to start playing."
          : connections.length === 1
            ? "Add more and they are asked in order."
            : "Asked from the top down. The first one that has the song plays it.";
        const adder =
          adding || !connections.length
            ? '<div class="adder">' +
              '<input class="in" id="addUrl" placeholder="Paste the link to a connection file" spellcheck="false" autocapitalize="none">' +
              '<button class="btn" id="addBtn">Add</button>' +
              (connections.length
                ? '<button class="btn ghost" id="addCancel">Cancel</button>'
                : "") +
              "</div>" +
              '<div class="adder alt">' +
              '<span class="sub">No link? </span>' +
              '<button class="btn alt" id="addFile">Choose a file</button>' +
              '<button class="btn ghost" id="addPasteOpen">Paste its contents</button>' +
              '<input type="file" id="addFileIn" accept=".json,application/json" hidden>' +
              '<div id="addPasteBox" class="hidden" style="flex:1 1 100%">' +
              '<textarea class="in" id="addPaste" placeholder="Paste the contents of a connection file here" spellcheck="false" style="min-height:130px;margin-top:10px">' +
              "</textarea>" +
              '<div class="row" style="margin-top:10px">' +
              '<button class="btn" id="addPasteGo">Add</button>' +
              "</div>" +
              "</div>" +
              "</div>"
            : "";
        const taken = {};
        const rows = connections
          .map((a, i) => {
            const st = stateOf(a),
              isOpen = open[a.id] === undefined ? !!needs(a) : open[a.id];
            return (
              '<div class="item' +
              (a.enabled ? "" : " off") +
              (isOpen ? " open" : "") +
              '" data-id="' +
              a.id +
              '"><div class="head">' +
              '<div class="tile">' +
              (a.icon ? '<img alt="" src="' + esc(a.icon) + '">' : faceOf(a.name, taken)) +
              "</div>" +
              '<div class="txt"><div class="nm">' +
              esc(a.name) +
              '</div><div class="ds">' +
              esc(a.description || "") +
              '</div><div class="tags">' +
              (a.does || [])
                .map((d) => '<span class="tag">' + esc(DOES[d] || d) + "</span>")
                .join("") +
              "</div></div>" +
              '<div class="ctl">' +
              (st[1] ? '<span class="st ' + st[0] + '">' + esc(st[1]) + "</span>" : "") +
              (connections.length > 1
                ? '<button class="ib" data-act="up" aria-label="Move up" title="Ask earlier"' +
                  (i === 0 ? " disabled" : "") +
                  ">" +
                  I.up +
                  '</button><button class="ib" data-act="down" aria-label="Move down" title="Ask later"' +
                  (i === connections.length - 1 ? " disabled" : "") +
                  ">" +
                  I.down +
                  "</button>"
                : "") +
              '<label class="sw" title="' +
              (a.enabled ? "Turn off" : "Turn on") +
              '"><input type="checkbox" data-act="toggle"' +
              (a.enabled ? " checked" : "") +
              ' aria-label="Turn ' +
              esc(a.name) +
              ' on or off"><span></span></label>' +
              '<button class="ib chev" data-act="open" aria-label="Settings" title="Settings">' +
              I.chev +
              "</button></div></div>" +
              (isOpen
                ? '<div class="body"><div class="fields">' +
                  (a.settingsSchema || []).map((s) => field(a, s)).join("") +
                  "</div>" +
                  '<div class="row">' +
                  ((a.settingsSchema || []).length
                    ? '<button class="btn" data-act="save">Save</button>'
                    : '<button class="btn alt" data-act="test">Check connection</button>') +
                  "" +
                  (a.kind === "file"
                    ? ""
                    : '<button class="btn ghost" data-act="reload">Update</button>') +
                  '<span class="sp"></span><button class="btn risk" data-act="remove">Remove</button></div>' +
                  '<div class="note"></div><div class="from">' +
                  esc(a.kind === "file" ? "Added from a file" : a.url) +
                  "</div></div>"
                : "") +
              "</div>"
            );
          })
          .join("");
        $("list").innerHTML = adder + (rows || "");
        $("addOpen").classList.toggle("hidden", adding || !connections.length);
        if ($("addBtn")) {
          $("addBtn").onclick = async () => {
            const url = $("addUrl").value.trim();
            if (!url) return $("addUrl").focus();
            try {
              say($("addMsg"), "Reading it…");
              const a = await api("/connections", { body: { url: url } });
              say($("addMsg"), "");
              adding = false;
              open[a.id] = true;
              toast(a.name + " added");
              refresh();
            } catch (e) {
              say($("addMsg"), e.message, false);
            }
          };
          $("addUrl").onkeydown = (e) => {
            if (e.key === "Enter") $("addBtn").click();
            if (e.key === "Escape" && connections.length) {
              adding = false;
              renderSources();
            }
          };
          if ($("addCancel"))
            $("addCancel").onclick = () => {
              adding = false;
              say($("addMsg"), "");
              renderSources();
            };
          const addDoc = async (text) => {
            let doc;
            try {
              doc = JSON.parse(text);
            } catch (e) {
              return say($("addMsg"), "That isn't a connection file: it has to be JSON.", false);
            }
            try {
              say($("addMsg"), "Reading it…");
              const a = await api("/connections", { body: { json: doc } });
              say($("addMsg"), "");
              adding = false;
              open[a.id] = true;
              toast(a.name + " added");
              refresh();
            } catch (e) {
              say($("addMsg"), e.message, false);
            }
          };
          $("addFile").onclick = () => $("addFileIn").click();
          $("addFileIn").onchange = async () => {
            const f = $("addFileIn").files[0];
            if (f) addDoc(await f.text());
          };
          $("addPasteOpen").onclick = () => {
            $("addPasteBox").classList.toggle("hidden");
            $("addPaste").focus();
          };
          $("addPasteGo").onclick = () => {
            const t = $("addPaste").value.trim();
            if (t) addDoc(t);
            else $("addPaste").focus();
          };
          if (adding) $("addUrl").focus();
        }
        $("list")
          .querySelectorAll(".item")
          .forEach((row) => {
            const id = row.dataset.id,
              a = connections.find((x) => x.id === id),
              note = row.querySelector(".note");
            const collect = () => {
              const s = {};
              (a.settingsSchema || []).forEach((f) => {
                const i = $("s_" + id + "_" + f.key);
                if (i) s[f.key] = f.type === "toggle" ? String(i.checked) : i.value.trim();
              });
              return s;
            };
            const test = async () => {
              if (note) say(note, "Checking…");
              const r = await api("/connections/" + id + "/test", { body: {} });
              results[id] = r;
              return r;
            };
            row.querySelectorAll("[data-act]").forEach((b) => {
              const run = async () => {
                const act = b.dataset.act;
                try {
                  if (act === "open") {
                    open[id] = !(open[id] === undefined ? !!needs(a) : open[id]);
                    return renderSources();
                  }
                  if (act === "up" || act === "down")
                    await api("/connections/" + id + "/move", {
                      body: { dir: act === "up" ? -1 : 1 },
                    });
                  else if (act === "toggle")
                    await api("/connections/" + id, { body: { enabled: b.checked } });
                  else if (act === "remove") {
                    if (!confirm("Remove " + a.name + "?")) return;
                    await api("/connections/" + id, { method: "DELETE" });
                    toast(a.name + " removed");
                  } else if (act === "reload") {
                    await api("/connections/" + id + "/refresh", { body: {} });
                    toast(a.name + " is up to date");
                  } else if (act === "save") {
                    await api("/connections/" + id, { body: { settings: collect() } });
                    const r = await test();
                    open[id] = !r.ok;
                    toast(r.ok ? a.name + " is connected" : r.message, !r.ok);
                  } else if (act === "test") {
                    const r = await test();
                    toast(r.ok ? a.name + " is connected" : r.message, !r.ok);
                  }
                  refresh();
                } catch (e) {
                  if (note) say(note, e.message, false);
                  else toast(e.message, true);
                }
              };
              if (b.type === "checkbox") b.onchange = run;
              else b.onclick = run;
            });
          });
      }
      $("addOpen").onclick = () => {
        adding = true;
        renderSources();
      };
      async function loadShelf() {
        if (shelf === null) {
          try {
            shelf = (await api("/catalog")).connections || [];
          } catch (e) {
            shelf = [];
          }
        }
        const have = {};
        connections.forEach((a) => (have[a.url] = 1));
        const rest = shelf.filter((x) => !have[x.url] && (x.does || []).indexOf("catalog") < 0);
        renderCatalog();
        $("shelf").classList.toggle("hidden", !rest.length);
        const taken = {};
        $("shelfGrid").innerHTML = rest
          .map(
            (x, i) =>
              '<div class="pick"><div class="tile">' +
              faceOf(x.name, taken) +
              '</div><div class="txt"><div class="nm">' +
              esc(x.name) +
              '</div><div class="ds">' +
              esc(x.description) +
              '</div><div class="tags">' +
              (x.does || [])
                .map((d) => '<span class="tag">' + esc(DOES[d] || d) + "</span>")
                .join("") +
              '</div></div><button class="btn alt" data-pick="' +
              i +
              '">Add</button></div>',
          )
          .join("");
        $("shelfGrid")
          .querySelectorAll("[data-pick]")
          .forEach(
            (b) =>
              (b.onclick = async () => {
                const x = rest[Number(b.dataset.pick)];
                b.textContent = "Adding…";
                try {
                  const a = await api("/connections", { body: { url: x.url } });
                  open[a.id] = true;
                  toast(a.name + " added");
                  await refresh();
                  document
                    .querySelector('[data-id="' + a.id + '"]')
                    .scrollIntoView({ behavior: "smooth", block: "center" });
                } catch (e) {
                  b.textContent = "Add";
                  toast(e.message, true);
                }
              }),
          );
      }
      async function trySong() {
        const out = $("tryOut"),
          q = $("tryQ").value.trim();
        if (!q) return;
        out.innerHTML = '<div class="busy"></div>';
        try {
          const r = await api("/try?q=" + encodeURIComponent(q));
          if (!r.found) {
            out.innerHTML = '<div class="note bad">Nothing in the catalog matches that.</div>';
            return;
          }
          out.innerHTML =
            '<div class="result"><img alt="" src="' +
            esc(r.track.image || "") +
            '"><div><div class="t">' +
            esc(r.track.title) +
            '</div><div class="m">' +
            esc(r.track.artist) +
            " · " +
            esc(r.track.album) +
            "</div></div>" +
            (r.resolved
              ? '<div class="via"><b>' +
                esc(r.resolved.connection) +
                "</b>" +
                esc(String(r.resolved.container || "").toUpperCase()) +
                " · " +
                (r.ms / 1000).toFixed(1) +
                " s</div>"
              : '<div class="via no"><b>Nothing has it</b>' +
                (r.ms / 1000).toFixed(1) +
                " s</div>") +
            "</div>";
        } catch (e) {
          out.innerHTML = '<div class="note bad">' + esc(e.message) + "</div>";
        }
      }
      $("tryQ").onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          trySong();
        }
      };

      let imp = null;
      function impRow(t, i) {
        return (
          '<div class="trk" id="imp_' +
          i +
          '"><span class="n">' +
          (i + 1) +
          '</span><span class="t">' +
          esc(t.title) +
          (t.artist ? ' <span class="a">' + esc(t.artist) + "</span>" : "") +
          '</span><span class="st"></span></div>'
        );
      }
      function impState(i, cls, text) {
        const el = $("imp_" + i);
        if (el) {
          const s = el.lastElementChild;
          s.className = "st " + cls;
          s.textContent = text;
        }
      }
      $("impRead").onclick = async () => {
        const raw = $("impIn").value.trim();
        if (!raw) return $("impIn").focus();
        say($("impMsg"), "Reading…");
        try {
          const isLink = /^https?:[/][/][^ ]+$/.test(raw);
          const r = await api("/import/read", { body: isLink ? { url: raw } : { text: raw } });
          imp = r;
          say(
            $("impMsg"),
            r.tracks.length +
              (r.tracks.length === 1 ? " song" : " songs") +
              (r.via ? ", read by " + r.via : ""),
            true,
          );
          $("impName").value = r.name || "";
          $("impCount").textContent = "";
          $("impProg").classList.add("hidden");
          $("impGo").disabled = false;
          $("impGo").textContent =
            "Import " + r.tracks.length + (r.tracks.length === 1 ? " song" : " songs");
          $("impList").innerHTML = r.tracks.map(impRow).join("");
          $("impStage").classList.remove("hidden");
        } catch (e) {
          say($("impMsg"), e.message, false);
        }
      };
      $("impGo").onclick = async () => {
        if (!imp) return;
        const tracks = imp.tracks,
          warm = $("impWarm").checked,
          ids = new Array(tracks.length).fill(null),
          bar = $("impProg").firstElementChild;
        let done = 0,
          ready = 0;
        const total = tracks.length * (warm ? 2 : 1);
        $("impGo").disabled = true;
        $("impProg").classList.remove("hidden");
        bar.style.width = "0";
        const tick = () => {
          done++;
          bar.style.width = Math.round((done / total) * 100) + "%";
        };
        const pool = async (n, job) => {
          let next = 0;
          await Promise.all(
            Array.from({ length: n }, async () => {
              while (next < tracks.length) {
                const i = next++;
                await job(i);
              }
            }),
          );
        };
        await pool(3, async (i) => {
          impState(i, "", "Looking up…");
          try {
            const r = await api("/import/match", { body: tracks[i] });
            if (r.found) {
              ids[i] = r.id;
              impState(i, "", "Found");
            } else impState(i, "bad", "Not in the catalog");
          } catch (e) {
            impState(i, "bad", "Not in the catalog");
          }
          tick();
        });
        const found = ids.filter(Boolean);
        if (!found.length) {
          $("impCount").textContent = "None of these songs are in the catalog.";
          $("impGo").disabled = false;
          return;
        }
        try {
          const saved = await api("/import/save", {
            body: { name: $("impName").value, ids: found },
          });
          $("impCount").textContent =
            "Saved “" + saved.name + "” with " + saved.count + " of " + tracks.length + " songs.";
        } catch (e) {
          $("impCount").textContent = e.message;
          $("impGo").disabled = false;
          return;
        }
        if (warm) {
          await pool(2, async (i) => {
            if (!ids[i]) return tick();
            impState(i, "", "Checking…");
            try {
              const r = await api("/import/warm", { body: { id: ids[i] } });
              if (r.ready) {
                ready++;
                impState(i, "ok", "Ready on " + r.connection);
              } else impState(i, "warn", "Not available yet");
            } catch (e) {
              impState(i, "warn", "Not available yet");
            }
            tick();
          });
          $("impCount").textContent += " " + ready + " ready to play.";
        }
        bar.style.width = "100%";
        toast("Playlist imported");
      };

      $("mode").onchange = async () => {
        try {
          await api("/settings", { body: { streamMode: $("mode").value } });
          toast("Saved");
        } catch (e) {
          say($("modeMsg"), e.message, false);
        }
      };
      $("pwSave").onclick = async () => {
        try {
          await api("/password", { body: { current: $("pwCur").value, next: $("pwNew").value } });
          $("pwCur").value = $("pwNew").value = "";
          say($("pwMsg"), "Password changed.", true);
        } catch (e) {
          say($("pwMsg"), e.message, false);
        }
      };
      function renderCatalog() {
        const c = status.catalog;
        const n = $("noCatalog");
        n.classList.toggle("hidden", !!c);
        if (!c) {
          n.innerHTML =
            "This server has no catalog yet, so searching finds nothing. " +
            (me.isAdmin
              ? '<button id="goCatalog">Choose one</button>'
              : "Ask its admin to choose one.");
          if ($("goCatalog")) $("goCatalog").onclick = () => tab("admin");
        }
        $("catNow").innerHTML = c
          ? '<div style="display:flex;gap:12px;align-items:center"><div class="tile">' +
            faceOf(c.name) +
            '</div><div><div style="font-weight:600">' +
            esc(c.name) +
            '</div><div class="sub">' +
            esc(c.description) +
            "</div></div></div>"
          : '<span class="sub">None chosen.</span>';
        const picks = (shelf || []).filter(
          (x) => (x.does || []).indexOf("catalog") >= 0 && (!c || c.url !== x.url),
        );
        $("catPicks").innerHTML = picks
          .map(
            (x, i) =>
              '<button class="btn alt" data-cat="' + i + '">Use ' + esc(x.name) + "</button>",
          )
          .join("");
        $("catPicks")
          .querySelectorAll("[data-cat]")
          .forEach((b) => (b.onclick = () => useCatalog(picks[Number(b.dataset.cat)].url)));
      }
      async function useCatalog(url) {
        if (!url) return;
        if (
          status.catalog &&
          !confirm(
            "Change the catalog? Libraries and playlists made with the current one will no longer open.",
          )
        )
          return;
        try {
          say($("catMsg"), "Reading it…");
          const r = await api("/server/catalog", { body: { url: url } });
          status.catalog = r.catalog;
          $("catUrl").value = "";
          say($("catMsg"), "");
          toast(r.catalog.name + " is now the catalog");
          renderCatalog();
          coversDone = false;
          localStorage.removeItem("undertone_covers");
          loadCovers();
        } catch (e) {
          say($("catMsg"), e.message, false);
        }
      }
      $("catSet").onclick = () => useCatalog($("catUrl").value.trim());

      async function loadUsers() {
        const users = await api("/users"),
          seen = {};
        $("userTable").innerHTML =
          "<tr><th>Name</th><th>Role</th><th>Last seen</th><th></th></tr>" +
          users
            .map(
              (u) =>
                '<tr><td style="font-weight:500"><span style="display:flex;align-items:center;gap:10px"><span class="av">' +
                faceOf(u.name, seen) +
                "</span>" +
                esc(u.name) +
                '</span></td><td style="color:var(--dim)">' +
                (u.is_admin ? "Admin" : "Member") +
                '</td><td style="color:var(--mut)">' +
                (u.last_login
                  ? new Date(u.last_login).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })
                  : "Never") +
                '</td><td style="text-align:right">' +
                (u.id === me.id
                  ? '<span class="sub">You</span>'
                  : '<button class="btn risk" style="height:30px" data-del="' +
                    u.id +
                    '" data-name="' +
                    esc(u.name) +
                    '">Remove</button>') +
                "</td></tr>",
            )
            .join("");
        $("userTable")
          .querySelectorAll("[data-del]")
          .forEach(
            (b) =>
              (b.onclick = async () => {
                if (
                  confirm(
                    "Remove " +
                      b.dataset.name +
                      " and everything in their account? This can't be undone.",
                  )
                ) {
                  await api("/users/" + b.dataset.del, { method: "DELETE" });
                  loadUsers();
                }
              }),
          );
      }
      $("openSignup").onchange = async () => {
        try {
          const r = await api("/server", { body: { signupOpen: $("openSignup").checked } });
          status.signupOpen = r.signupOpen;
          toast(r.signupOpen ? "Anyone can create an account now" : "Sign-up is closed");
        } catch (e) {
          toast(e.message, true);
        }
      };
      $("nuBtn").onclick = async () => {
        try {
          await api("/users", {
            body: {
              username: $("nuName").value,
              password: $("nuPw").value,
              admin: $("nuAdmin").checked,
            },
          });
          say($("nuMsg"), "Account created.", true);
          $("nuName").value = $("nuPw").value = "";
          $("nuAdmin").checked = false;
          loadUsers();
        } catch (e) {
          say($("nuMsg"), e.message, false);
        }
      };

      boot();
    </script>
  </body>
</html>
`;
