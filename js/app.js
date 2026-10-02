/* AI TRACE v2 — CASE #01 「낯선 DM」
 * 한 화면 = 한 장면. 관찰 → 발견 → 판단 → 단서 축적 → 해결.
 * 흐름: 프롤로그(하람의 폰, 낯선 DM) → T1 어떻게 알아봤나 → T2 사진 → T3 로그인 → T4 어떻게 나갔나
 *       → CASE REPORT → 이럴 땐 이렇게 → 실제 사례 → 끝
 * 교사용: Shift+1~8 로 장면 이동 (주소 뒤 ?s=pro|t1|t2|t3|t4|report|safe|real 과 같음)
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const ic = (id, cls = '') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
  const S = window.Sound;

  /* ───────── 무대 맞춤 (1600×900) ───────── */
  const stage = $('#stage'), main = $('#main');
  const typing_ = () => /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
  function fit() {
    if (typing_()) return;   // 화상 키보드가 뜰 때 무대가 줄어들지 않게
    const k = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${k})`;
  }
  window.addEventListener('resize', fit); fit();
  document.addEventListener('focusout', () => setTimeout(fit, 60));

  /* ───────── 공용 ───────── */
  const mode = m => { stage.dataset.mode = m; };
  let toastTimer = null;
  function toast(msg, kind = '', ms = 2600) {
    const t = $('#toast');
    t.className = ''; t.innerHTML = msg; if (kind) t.classList.add(kind);
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  // 새 장면: 이전 장면은 서서히 사라진다
  async function beat(html, m) {
    if (m) mode(m);
    $$('.beat', main).forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 460); });
    const b = el('div', 'beat', html);
    main.appendChild(b);
    await wait(30); b.classList.add('in');
    return b;
  }
  function tapOnce(target) {
    return new Promise(r => target.addEventListener('click', e => { S.play('ui_click'); r(e); }, { once: true }));
  }
  async function nextBtn(host, label = '다음', cls = 'primary', style) {
    const bar = el('div', 'nextbar', `<button class="act ${cls}">${label}${ic('i-arrow')}</button>`);
    if (style) Object.assign(bar.style, style);
    host.appendChild(bar);
    await tapOnce($('button', bar));
    bar.remove();
  }
  function fadeIn(host, node) { host.appendChild(node); node.classList.add('fade'); requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('in'))); return node; }

  // 인물 말풍선
  function say(host, pos, who, img, text) {
    const s = el('div', 'say', `<div class="av"><img src="assets/img/${img}.webp" alt=""></div><div class="bub"><div class="who">${who}</div>${text}</div>`);
    Object.assign(s.style, pos);
    S.play('evidence_found', { gain: .6 });
    return fadeIn(host, s);
  }

  /* 질문 카드 — 정답이 아니면 이유를 보여 주고 다시 고르게 한다 (점수 없음)
   * o: { label, q, opts:[{t, ok, fb}], next:'다음' | false, grid, cls } → {el, i} */
  function ask(host, pos, o) {
    return new Promise(resolve => {
      const a = el('div', 'ask panel ' + (o.cls || ''));
      Object.assign(a.style, pos);
      a.innerHTML = `${o.label ? `<div class="ql">${o.label}</div>` : ''}<div class="q">${o.q}</div>
        <div class="opts ${o.grid ? 'grid3' : ''}"></div><div class="fb"></div><div class="row"></div>`;
      const opts = $('.opts', a), fb = $('.fb', a), row = $('.row', a);
      o.opts.forEach((op, i) => {
        const b = el('button', 'opt', op.t); b.dataset.ok = op.ok ? 1 : 0;
        b.addEventListener('click', () => {
          if (a.classList.contains('done')) return;
          if (op.ok) {
            b.classList.add('yes'); a.classList.add('done');
            fb.className = 'fb ok'; fb.innerHTML = op.fb || '';
            S.play(op.snd || 'evidence_found');
            if (o.next === false) { setTimeout(() => resolve({ el: a, i }), o.delay || 900); return; }
            const nb = el('button', 'act primary', `${o.next || '다음'}${ic('i-arrow')}`);
            row.appendChild(nb);
            nb.addEventListener('click', () => { S.play('ui_click'); resolve({ el: a, i }); }, { once: true });
          } else {
            b.classList.add('no');
            fb.className = 'fb'; fb.innerHTML = op.fb || '다시 생각해 보자.';
            S.play('ui_click');
          }
        });
        opts.appendChild(b);
      });
      fadeIn(host, a);
    });
  }

  /* 여러 개 고르는 질문 카드 — 맞는 것을 빠짐없이 골라야 넘어간다
   * o: { label, q, opts:[{t, ok, fb}], go:'버튼 글자', miss:'덜 골랐을 때 안내' } → 고른 보기 글자 배열 */
  function askMulti(host, pos, o) {
    return new Promise(resolve => {
      const a = el('div', 'ask panel');
      Object.assign(a.style, pos);
      a.innerHTML = `${o.label ? `<div class="ql">${o.label}</div>` : ''}<div class="q">${o.q}</div>
        <div class="opts"></div><div class="fb"></div><div class="row"><button class="act primary">${o.go || '확인'}${ic('i-arrow')}</button></div>`;
      const opts = $('.opts', a), fb = $('.fb', a), go = $('.row button', a);
      const btns = o.opts.map(op => {
        const b = el('button', 'opt', op.t);
        b.addEventListener('click', () => { if (a.classList.contains('done')) return; b.classList.toggle('sel'); S.play('ui_click'); });
        opts.appendChild(b); return b;
      });
      go.addEventListener('click', () => {
        if (a.classList.contains('done')) return;
        const bad = o.opts.findIndex((op, i) => !op.ok && btns[i].classList.contains('sel'));
        if (bad >= 0) {
          btns[bad].classList.remove('sel'); btns[bad].classList.add('no');
          fb.className = 'fb'; fb.innerHTML = o.opts[bad].fb || '다시 생각해 보자.'; S.play('ui_click'); return;
        }
        if (o.opts.some((op, i) => op.ok && !btns[i].classList.contains('sel'))) {
          fb.className = 'fb'; fb.innerHTML = o.miss || '아직 더 있다. 빠짐없이 골라 보자.'; S.play('ui_click'); return;
        }
        a.classList.add('done'); btns.forEach((b, i) => { b.classList.remove('sel'); if (o.opts[i].ok) b.classList.add('yes'); });
        S.play('evidence_found');
        setTimeout(() => resolve(o.opts.filter(op => op.ok).map(op => op.t)), 700);
      });
      fadeIn(host, a);
    });
  }

  /* 글자 입력 — 버튼이나 Enter로 확인. 맞을 때까지 기다린다 (한글 조합 중 Enter는 무시)
   * check(값) → true면 통과, 'more'면 입력칸만 비우고 계속 받는다, 아니면 흔들린다 */
  // 띄어쓰기·문장부호는 따지지 않는다 (가운뎃점은 자판마다 다르게 찍혀서 비슷한 글자를 모두 뺀다)
  const norm = s => s.replace(/[\s?？!,.~·ㆍ・･‧∙•\-\/]/g, '');
  function typed(inp, btn, check) {
    return new Promise(resolve => {
      const go = async () => {
        if (inp.disabled) return;
        const r = await check(inp.value);
        if (r === true) { inp.disabled = true; btn.disabled = true; inp.blur(); resolve(inp.value); return; }
        if (r === 'more') { inp.value = ''; return; }
        inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake');
        S.play('ui_click');
      };
      btn.addEventListener('click', go);
      inp.addEventListener('input', () => inp.classList.remove('shake'));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
    });
  }

  /* 보기를 보고 직접 쓰는 질문 카드 — 보기는 누를 수 없고, 하나를 골라 입력칸에 그대로 쓴다
   * o: ask()와 같다 { label, q, opts:[{t, ok, fb, snd}], next } → {el, i} */
  function askType(host, pos, o) {
    return new Promise(resolve => {
      const a = el('div', 'ask panel type');
      Object.assign(a.style, pos);
      a.innerHTML = `${o.label ? `<div class="ql">${o.label}</div>` : ''}<div class="q">${o.q}</div>
        <div class="th">보기 중 하나를 골라 아래 칸에 직접 쓰자.</div><div class="opts grid3"></div>
        <div class="trow"><input class="tin" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="여기에 쓰기">
          <button class="act primary">확인</button></div><div class="fb"></div><div class="row"></div>`;
      const opts = $('.opts', a), fb = $('.fb', a), row = $('.row', a), inp = $('.tin', a);
      const chips = o.opts.map(op => { const c = el('div', 'opt', op.t); opts.appendChild(c); return c; });
      fadeIn(host, a);
      setTimeout(() => inp.focus({ preventScroll: true }), 450);
      let pick = -1;
      typed(inp, $('.trow button', a), v => {
        const i = o.opts.findIndex(op => norm(op.t) === norm(v));
        if (i < 0) { fb.className = 'fb'; fb.innerHTML = '보기 중 하나를 골라 그대로 쓰자.'; return false; }
        if (!o.opts[i].ok) {
          chips[i].classList.add('no');
          fb.className = 'fb'; fb.innerHTML = o.opts[i].fb || '다시 생각해 보자.';
          S.play('ui_click'); return 'more';
        }
        pick = i; return true;
      }).then(() => {
        const op = o.opts[pick];
        chips[pick].classList.add('yes'); a.classList.add('done');
        fb.className = 'fb ok'; fb.innerHTML = op.fb || '';
        S.play(op.snd || 'evidence_found');
        const nb = el('button', 'act primary', `${o.next || '다음'}${ic('i-arrow')}`);
        row.appendChild(nb);
        nb.addEventListener('click', () => { S.play('ui_click'); resolve({ el: a, i: pick }); }, { once: true });
      });
    });
  }

  function banner(host, o) {
    const b = el('div', 'banner', `<div class="ap" style="background:${o.bg}">${o.icon ? ic(o.icon) : o.ap}</div>
      <div><div class="t">${o.app}<span>${o.time || '지금'}</span></div><div class="m">${o.msg}</div></div>`);
    if (o.left) b.style.left = o.left;
    host.appendChild(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('in')));
    S.play(o.snd || 'impact');
    return b;
  }

  /* ───────── 수사 노트 ───────── */
  const TRACES = {
    1: { title: '나를 알아볼 수 있는 정보가 있나?', short: '하나 + 여러 정보를 합친 경우', sub: '이름이 없어도 <b class="am">여러 정보를 합치면</b> 누구인지 알 수 있다.', icon: 'i-search' },
    2: { title: '다른 사람의 정보가 있나?', short: '친구·가족의 얼굴, 이름', sub: '사진·글·대화 속에 <b class="am">친구·가족 등 다른 사람</b>의 얼굴이나 이름이 있는지 확인한다.', icon: 'i-users' },
    3: { title: '중요 정보는 처음부터 넣지 않았나?', short: '비밀번호·주민번호·계좌', sub: '비밀번호·주민등록번호·계좌정보는 가리거나 나중에 지우는 게 아니라 <b class="am">처음부터 넣지 않는다.</b>', icon: 'i-lock' },
    4: { title: '답변에 나나 남의 정보가 있으면 공유, 게시하지 않나?', short: '공유 링크·캡처 보내기 전에', sub: 'AI에게 보낼 때만이 아니라, AI 대화를 <b class="am">다른 사람에게 보여줄 때도</b> 확인한다.', icon: 'i-share' },
  };
  (function buildRules() {
    const box = $('#nt-rules');
    [1, 2, 3, 4].forEach(n => box.appendChild(el('div', 'nrule', `<div class="ic">${ic(TRACES[n].icon)}</div><div><div class="no">TRACE 0${n}</div><div class="tx">${n <= 0 ? '' : '???'}</div></div>`)));
    $$('.nrule', box).forEach((r, i) => r.dataset.n = i + 1);
  })();
  function note(label, kind = '', tag = '', quiet) {
    const box = $('#nt-clues');
    const e = $('.nt-empty', box); if (e) e.remove();
    box.appendChild(el('div', 'nclue ' + kind, `${label}${tag ? `<span class="tg">${tag}</span>` : ''}`));
    box.scrollTop = box.scrollHeight;
    $('#nt-ct').textContent = box.children.length;
    if (!quiet) S.play('evidence_register', { delay: 120 });
  }
  function rule(n) { const r = $(`.nrule[data-n="${n}"]`); r.classList.add('on'); $('.tx', r).textContent = TRACES[n].title; }
  function mission(n) { $(`.mis[data-m="${n}"]`).classList.add('done'); }
  function setProgress(cur) {
    $$('.pnode').forEach(n => { const i = +n.dataset.n; n.classList.toggle('done', i < cur); n.classList.toggle('current', i === cur); });
    $$('.pline').forEach(l => l.classList.toggle('done', +l.dataset.n < cur));
  }
  // TRACE 기준 발견 — 수사 노트에 등록
  async function stamp(n) {
    const T = TRACES[n], s = $('#stamp');
    s.innerHTML = `<div class="card"><div class="sys-label">TRACE 0${n} · 기준 발견</div><div class="ic">${ic(T.icon)}</div>
      <div class="target"><span class="tg">따라 쓸 문장</span><h2>${T.title}</h2></div>
      <div class="copy"><div class="cl2">상자 안의 문장을 아래 칸에 그대로 따라 쓰자.</div>
        <input class="tin" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="여기에 쓰기">
        <div class="cf"></div></div>
      <p class="sub">${T.sub}</p>
      <div style="margin-top:16px"><button class="act amber">수사 노트에 기록${ic('i-arrow')}</button></div></div>`;
    S.play('trace_unlock');
    await wait(30); s.classList.add('show');
    const inp = $('.tin', s), cf = $('.cf', s);
    setTimeout(() => inp.focus({ preventScroll: true }), 450);
    await typed(inp, $('button', s), v => {
      if (norm(v) === norm(T.title)) return true;
      cf.textContent = norm(v) ? '글자가 다르다. 상자 안의 문장을 보고 똑같이 쓰자.' : '상자 안의 문장을 따라 써야 기록된다.';
      return false;
    });
    S.play('evidence_register');
    s.classList.remove('show'); rule(n); setProgress(n + 1);
    await wait(380); s.innerHTML = '';
  }

  /* ───────── 사운드 컨트롤 ───────── */
  const soundBtn = $('#soundBtn'), vol = $('#volume');
  function paintSound() {
    soundBtn.classList.toggle('muted', !S.enabled);
    $('.on', soundBtn).classList.toggle('hidden', !S.enabled);
    $('.off', soundBtn).classList.toggle('hidden', S.enabled);
  }
  vol.value = S.volume; paintSound();
  soundBtn.addEventListener('click', () => { S.setEnabled(!S.enabled); paintSound(); if (S.enabled) S.play('ui_click'); });
  vol.addEventListener('input', () => S.setVolume(+vol.value));

  /* ───────── 폰 조각 ───────── */
  const PHONE = (inner, style = '') => `<div class="phone" style="${style}"><div class="notch"></div><div class="scr"><div class="sbar"><span>9:03</span><span>●●● 5G</span></div>${inner}</div></div>`;
  function bubble(list, cls, html) {
    const b = el('div', 'bub2 ' + cls, html);
    list.appendChild(b);
    S.play(cls === 'in' ? 'evidence_found' : 'ui_click', { gain: .55 });
    return b;
  }
  async function typing(list, ms) {
    const t = el('div', 'bub2 in typing', '<i></i><i></i><i></i>');
    list.appendChild(t); await wait(ms); t.remove();
  }
  async function typeText(node, text, speed = 60) {
    for (const ch of text) { node.textContent += ch; await wait(speed); }
  }

  /* ───────── 타이틀·엔딩 연출 ─────────
   * 시작·엔딩 화면의 움직임은 Web Animations API로 준다. 윈도우 "애니메이션 효과"가 꺼진 PC에서는
   * style.css 맨 끝 규칙이 CSS 애니메이션을 1ms로 줄이는데, 여기 움직임은 그 규칙과 상관없이 보여야 해서다.
   * 전부 느리고 작은 움직임만 쓴다. */
  const anim = (node, frames, o) => node.animate(frames, Object.assign({ fill: 'both', easing: 'cubic-bezier(.2,.7,.2,1)' }, o));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const RISE = [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }];
  // 천천히 떠오르는 먼지 입자. box: 입자가 놓일 범위(%) [x0, x1, y0, y1]
  function motes(host, n, box) {
    for (let i = 0; i < n; i++) {
      const m = el('i', 'mote'), s = rnd(2, 5), peak = rnd(.25, .7);
      Object.assign(m.style, { left: rnd(box[0], box[1]) + '%', top: rnd(box[2], box[3]) + '%', width: s + 'px', height: s + 'px' });
      host.appendChild(m);
      anim(m, [{ opacity: 0, transform: 'translate(0, 0)' }, { opacity: peak, offset: .3 }, { opacity: peak * .8, offset: .7 },
        { opacity: 0, transform: `translate(${rnd(-30, 30)}px, ${-rnd(50, 120)}px)` }],
        { duration: rnd(7000, 13000), delay: rnd(0, 6000), iterations: Infinity, easing: 'linear' });
    }
  }
  // 마우스를 따라 이미지가 반대쪽으로 조금 움직인다 (터치에서는 끔). 돌려받은 함수를 부르면 멈춘다
  function parallax(host, img, max) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, on = true;
    const move = e => {
      if (e.pointerType !== 'mouse') return;
      const r = host.getBoundingClientRect();
      tx = -((e.clientX - r.left) / r.width - .5) * 2 * max;
      ty = -((e.clientY - r.top) / r.height - .5) * 2 * max * .6;
    };
    const tick = () => {
      if (!on) return;
      x += (tx - x) * .06; y += (ty - y) * .06;
      img.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    host.addEventListener('pointermove', move); tick();
    return () => { on = false; cancelAnimationFrame(raf); host.removeEventListener('pointermove', move); };
  }
  // 사진 조각 위로 지나가는 옅은 빛 한 줄. rest: 한 번 지나간 뒤 쉬는 비율
  const sweepFrames = rest => {
    const a = 'translateX(480px) skewX(-14deg)', z = 'translateX(1700px) skewX(-14deg)', k = 1 - rest;
    const f = [{ transform: a, opacity: 0, offset: 0 }, { opacity: 1, offset: .18 * k }, { opacity: 1, offset: .8 * k }, { transform: z, opacity: 0, offset: k }];
    if (rest) f.push({ transform: z, opacity: 0, offset: 1 });
    return f;
  };
  function titleFx(g) {
    anim($('.kv', g), [{ opacity: 0, transform: 'scale(1.05)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1800 });
    anim($('.kv-drift', g), [{ transform: 'scale(1) translate(0, 0)' }, { transform: 'scale(1.035) translate(-8px, -5px)' }],
      { duration: 24000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    [$('.logo', g), $('p', g), $('.tap', g)].forEach((n, i) => anim(n, RISE, { duration: 900, delay: 500 + 300 * i }));
    anim($('.tap', g), [{ boxShadow: '0 0 0 0 rgba(86,195,255,0)' }, { boxShadow: '0 0 0 10px rgba(86,195,255,.12)' }],
      { duration: 1600, delay: 2000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    anim($('.kv-sweep', g), sweepFrames(.66), { duration: 7000, delay: 2200, iterations: Infinity, easing: 'linear' });
    motes($('.kv-motes', g), 14, [40, 96, 12, 96]);
    return parallax(g, $('.kv img', g), 8);
  }
  function endingFx(e) {
    anim($('.kv', e), [{ opacity: 0 }, { opacity: 1 }], { duration: 2000, easing: 'ease-out' });
    anim($('.kv-drift', e), [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], { duration: 30000, easing: 'cubic-bezier(.2,.6,.3,1)' });   // 복도 끝 빛 쪽으로, 한 번만
    anim($('.glow', e), [{ opacity: .12 }, { opacity: .5 }], { duration: 6000, delay: 1500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    motes($('.kv-motes', e), 16, [54, 96, 8, 82]);
    [$('.c', e), ...$$('h2 span', e)].forEach((n, i) => anim(n, RISE, { duration: 900, delay: 900 + 600 * i }));
    anim($('.again', e), RISE, { duration: 900, delay: 3600 });
  }

  /* ═════════════ 프롤로그 — 하람의 폰 ═════════════ */
  async function prologue() {
    S.setAmbience(.7, 2000);
    const b = await beat(`<div class="pro-bg"></div>
      <div class="pro-cap"><div class="when">9월 29일 (월) 저녁 9:03</div>
        <div class="cap" id="pcap">숙제를 하던 <b class="cy">하람</b>의 폰에<br>알림이 하나 왔다.<small>학생들은 지금 하람의 폰을 보고 있다.</small></div></div>
      ${PHONE(`<div class="lock"><div class="tm">9:03</div><div class="dt">9월 29일 월요일</div>
        <div class="notif" id="pnotif"><div class="ap">DM</div><div><div class="t">메시지 요청<span>지금</span></div><div class="m">study_0927: 하람이 맞지? 😊</div></div></div>
        <div class="hint hidden" id="phint">알림을 눌러 열어 보자</div></div>`, 'left:1000px;top:35px')}`, 'dark');
    await wait(1400);
    $('#pnotif', b).classList.add('in'); S.play('evidence_register');
    await wait(900); $('#phint', b).classList.remove('hidden');
    await tapOnce($('#pnotif', b));

    // DM 화면
    $('.scr', b).innerHTML = `<div class="sbar"><span>9:03</span><span>●●● 5G</span></div>
      <div class="dm-head">${ic('i-back', 'bk')}<div class="pf">${ic('i-user')}</div><div><div class="nm">study_0927</div><div class="sub">모르는 계정 · 팔로우하지 않음</div></div></div>
      <div class="dm-list" id="dml"><div class="dm-req">이 계정은 모르는 사람이 보낸<br>메시지 요청입니다.</div></div>
      <div class="dm-input">메시지 보내기…</div>`;
    const list = $('#dml', b);
    bubble(list, 'in', '하람이 맞지? 😊');
    await wait(900);
    const lines = ['6학년 3반 이어달리기 마지막 주자 ㅎㅎ', '월·수에 별빛수학 다니지?', 'JC공원 근처 살고'];
    for (const l of lines) { await typing(list, 1000); bubble(list, 'in', l); await wait(500); }
    await S.duck(700, 300, .05);
    $('#pcap', b).innerHTML = '…누구지?<small>하람은 이 사람을 모른다. 그런데 이 사람은 하람을 안다.</small>';
    await wait(1400);
    bubble(list, 'out', '누구세요…?');
    await wait(700); list.appendChild(el('div', 'seen', '읽음'));
    await wait(1100);
    await typing(list, 1300);
    bubble(list, 'in', 'ㅎㅎ 그건 비밀~');
    S.restore(1200);
    await wait(900);

    // 판단: 지금 어떻게 해야 할까?
    $('.pro-cap', b).style.opacity = 0;
    await ask(b, { left: '90px', top: '170px', width: '760px' }, {
      label: '판단', q: '하람이라면, 지금 어떻게 해야 할까?',
      opts: [
        { t: '누구인지 계속 물어보며 대화해 본다.', fb: '대화를 이어 갈수록 상대에게 내 반응과 정보를 더 주게 된다.' },
        { t: '어떻게 알았는지 따지고 화를 낸다.', fb: '따지는 것도 대화를 이어 가는 것이다. 상대가 원하는 반응일 수 있다.' },
        { t: '더 답하지 않고, 화면을 캡처해 보호자·선생님께 알린다.', ok: true,
          fb: '맞아. 혼자 해결하려 하지 않는다. <b class="am">답하지 않기 · 캡처 · 차단·신고 · 어른께 알리기</b>.' },
      ], next: '계속',
    });
    $$('.ask', b).forEach(a => a.remove());

    // 의문
    say(b, { left: '90px', top: '260px', maxWidth: '780px' }, '하람', 'haram_thinking',
      '나는 저 사람한테 아무 말도 한 적 없는데…<br>내 <b class="am">반, 계주, 학원, 사는 곳</b>까지.<br>이 사람은 어떻게 알았지?');
    await nextBtn(b, '수사 시작', 'primary', { left: '90px', right: 'auto', bottom: '220px' });
    await titleCard();
  }

  async function titleCard() {
    const b = await beat(`<div class="title-card">
      <div class="logo fade" id="tl1">AI <b>TRACE</b></div>
      <div class="case fade" id="tl2">CASE #01</div>
      <h1 class="fade" id="tl3">낯선 DM</h1>
      <div class="q fade" id="tl4">모르는 사람이 하람에 대해 너무 많이 알고 있다.<br>하람의 정보는 어디에서 새어 나갔을까?</div>
      <div class="mis-big">
        <div class="fade"><span>MISSION 1</span>어떻게 하람을 알아봤나?</div>
        <div class="fade"><span>MISSION 2</span>무엇이 드러나 있었나?</div>
        <div class="fade"><span>MISSION 3</span>어떻게 밖으로 나갔나?</div>
      </div></div>`, 'dark');
    S.play('case_open');
    for (const id of ['#tl1', '#tl2', '#tl3']) { $(id, b).classList.add('in'); await wait(420); }
    await wait(300); $('#tl4', b).classList.add('in'); await wait(900);
    for (const m of $$('.mis-big div', b)) { m.classList.add('in'); S.play('evidence_found', { gain: .5 }); await wait(380); }
    await nextBtn(b, 'TRACE 01 조사 시작', 'primary', { right: '50%', transform: 'translateX(50%)', bottom: '90px' });
    await trace1();
  }

  /* ═════════════ TRACE 01 — 어떻게 알아봤나 ═════════════ */
  const CONVS = [
    { k: 'A', date: '09.12', tag: '주말 산책',
      parts: [['p', '주말에 산책하고 싶어.'], ['c', 'park', '우리 집이 JC공원에서 걸어서 3분 정도인데'], ['p', '가까운 산책 코스 추천해 줘.']],
      ai: 'JC공원 둘레길을 한 바퀴 도는 코스를 추천할게요.', hint: '어디에 사는지 알 수 있는 말은 없을까?' },
    { k: 'B', date: '09.18', tag: '체육대회',
      parts: [['p', '내일 우리 학교 체육대회야.'], ['c', 'class', '나는 6학년 3반이고'], ['c', 'anchor', '이어달리기 마지막 주자인데'], ['p', '너무 떨려.'], ['p', '안 떨리는 방법 알려 줘.']],
      ai: '마지막 주자를 위한 호흡법과 바통 받는 연습 방법이에요.', hint: '학년·반, 맡은 역할처럼 나를 좁히는 말은?' },
    { k: 'C', date: '09.23', tag: '공부 계획',
      parts: [['p', '방과 후에'], ['c', 'academy', '별빛수학학원 월·수 5시 반 수업'], ['p', '가야 하는데'], ['p', '학원 일정에 맞춰 공부 계획 짜 줘.']],
      ai: '월·수 학원 시간을 뺀 주간 공부 계획을 만들어 볼게요.', hint: '언제, 어디에 가는지 알 수 있는 말은?' },
  ];
  const CLUES = {
    park:    { note: 'JC공원 도보 3분', n: 80, lb: '그중 <span class="am">JC공원 근처</span>에 사는 학생' },
    class:   { note: '6학년 3반', n: 6, lb: '그중 <span class="am">6학년 3반</span>' },
    anchor:  { note: '이어달리기 마지막 주자', n: 2, lb: '그중 <span class="am">이어달리기 마지막 주자</span>' },
    academy: { note: '별빛수학 월·수 5:30', n: 1, lb: '그중 <span class="am">별빛수학 월·수</span>' },
  };
  const PLAIN_FB = ['누구나 쓸 수 있는 말이다.', '이 말로는 작성자를 좁힐 수 없다.', '평범한 부탁이다. 다른 말을 찾아보자.'];

  // 사람 수 게이지
  const DOTS = 300, ME = 157;
  const ORDER = (() => { const a = [...Array(DOTS).keys()].filter(i => i !== ME); let s = 7; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return [ME, ...a]; })();
  let gaugeN = 600;
  function gaugeHTML() {
    return `<div class="gauge panel"><div class="lb"><b>MATCH</b><span id="g-lb">우리 학교 전체 학생</span></div>
      <div class="num" id="g-num">600<small>명</small></div><div class="dots" id="g-dots">${'<i></i>'.repeat(DOTS)}</div></div>`;
  }
  function setGauge(host, n, lb) {
    const num = $('#g-num', host), dots = $$('#g-dots i', host);
    const on = new Set(ORDER.slice(0, n >= 20 ? Math.round(n / 2) : n));
    dots.forEach((d, i) => { d.classList.toggle('off', !on.has(i)); d.classList.toggle('me', n === 1 && i === ME); });
    $('#g-lb', host).innerHTML = lb;
    const from = gaugeN, t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / 900), v = Math.round(from + (n - from) * (1 - Math.pow(1 - k, 3)));
      num.innerHTML = `${v}<small>명</small>`;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
    num.classList.toggle('one', n === 1);
    gaugeN = n;
    S.play(n === 1 ? 'identity_match' : 'connection', { gain: n === 1 ? .7 : .6 });
  }

  async function trace1() {
    setProgress(1); gaugeN = 600;
    // ① 검색
    let b = await beat(`<div class="head"><div class="eyebrow">TRACE 01 · 이름 없는 대화</div><h1>DM 속 말로 검색해 보자.</h1></div>
      <div class="browser"><div class="bar"><i></i><i></i><i></i><div class="url">search.example</div></div>
        <div class="body"><div class="sbox">${ic('i-search')}<span id="sq"></span><span class="caret"></span></div><div id="sr"></div></div></div>`, 'trace');
    await wait(700);
    await typeText($('#sq', b), '6학년 3반 이어달리기 마지막 주자 별빛수학', 55);
    await wait(500); S.play('scan');
    const sr = $('#sr', b);
    sr.innerHTML = `
      <div class="sres dim"><div class="u">school.example/notice</div><div class="t">가을 체육대회 안내</div><div class="s">학년별 이어달리기 일정과 준비물을 안내합니다…</div></div>
      <div class="sres glow" id="hit"><div class="u">chat-ai.example/share/7f3a9c · AI 대화 공유 페이지</div><div class="t">"내일 우리 학교 체육대회야. 나는 6학년 3반이고…"</div>
        <div class="s">… <mark>이어달리기 마지막 주자</mark>인데 너무 떨려 … <mark>별빛수학</mark>학원 월·수 5시 반 … JC공원에서 걸어서 3분 …</div></div>
      <div class="sres dim"><div class="u">starmath.example</div><div class="t">별빛수학학원 초등부 시간표</div><div class="s">월·수 5:30 초6 심화반 …</div></div>`;
    [...sr.children].forEach((c, i) => { c.classList.add('fade'); setTimeout(() => c.classList.add('in'), 120 * i); });
    await wait(900);
    toast('DM에 나온 말이 그대로 들어 있는 페이지가 있다. 눌러서 열어 보자.');
    await tapOnce($('#hit', b));
    // ② 공유 페이지 첫인상
    $('.url', b).textContent = 'chat-ai.example/share/7f3a9c';
    $('.body', b).innerHTML = `<div class="shp-h fade" style="display:flex;gap:16px;align-items:center;padding-bottom:18px;border-bottom:1px solid #e1e6ef">
        <div style="width:58px;height:58px;border-radius:50%;background:#dfe4ec;display:grid;place-items:center;color:#9aa4b5">${ic('i-user')}</div>
        <div><div style="font-size:26px;font-weight:800">공유된 AI 대화</div><div style="font-size:18px;color:#6b7280;margin-top:2px">작성자 표시 없음 · 대화 4개 · 링크가 있으면 누구나 볼 수 있음</div></div>
        <div style="margin-left:auto;padding:8px 14px;border-radius:10px;background:#fff1e0;color:#b45309;font-weight:800;font-size:17px">검색됨</div></div>
      <div class="fade" style="margin-top:28px;font-size:24px;line-height:1.7;color:#4a5568">
        09.12 주말 산책 · 09.18 체육대회 · 09.23 공부 계획 · 09.27 로그인 문제<br><br>
        <b style="color:#1b2433">이름은 어디에도 없다.</b> 그런데 DM 보낸 사람은 이 페이지만 보고 하람을 찾아냈다.</div>`;
    $$('.fade', b).forEach((f, i) => setTimeout(() => f.classList.add('in'), 100 + 300 * i));
    $('.head h1', b).textContent = '이름 없는 대화가 검색된다.';
    note('검색되는 AI 대화', 'cy', '?');
    await wait(1200);
    await nextBtn(b, '대화 A부터 살펴보기', 'primary', { right: '78px', bottom: '70px' });

    // ③ 대화 A·B·C — 한 장씩
    b = await beat(`${gaugeHTML()}<div id="t1c"></div>`, 'trace');
    for (let i = 0; i < CONVS.length; i++) await convBeat(b, CONVS[i], i);
    await suspects(b);
  }

  function convBeat(b, c, idx) {
    return new Promise(async done => {
      const host = $('#t1c', b);
      host.innerHTML = '';
      const card = el('div', 'convbig panel', `<div class="ch"><b>대화 ${c.k}</b><span>${c.date} · ${idx + 1} / 3</span><span class="tag">${c.tag}</span></div>
        <div class="umsg"><div class="who">${ic('i-user')}작성자 UNKNOWN</div><span class="mm"></span></div>
        <div class="aimsg"><div class="b">AI</div><div>${c.ai}</div></div>
        <div class="tip">${ic('i-hand')}<span class="tt">작성자가 누구인지 알 수 있는 말을 찾아 눌러 보자.</span></div>`);
      fadeIn(host, card);
      const mm = $('.mm', card), tip = $('.tt', card);
      const need = c.parts.filter(p => p[0] === 'c').length;
      let got = 0, plain = 0;
      c.parts.forEach((p, i) => {
        if (i) mm.appendChild(document.createTextNode(' '));
        const s = el('span', 'frag', p[0] === 'c' ? p[2] : p[1]); if (p[0] === 'c') s.dataset.c = 1;
        mm.appendChild(s);
        s.addEventListener('click', async () => {
          if (s.classList.contains('got') || s.classList.contains('seen') || got === need) return;
          if (p[0] === 'p') {
            s.classList.add('seen'); S.play('ui_click');
            toast(PLAIN_FB[plain++ % PLAIN_FB.length]);
            if (plain >= 2) tip.innerHTML = `힌트 — ${c.hint}`;
            return;
          }
          s.classList.add('got'); got++;
          S.play('evidence_found');
          const C = CLUES[p[1]];
          const steps = c.parts.filter(q => q[0] === 'c').map(q => CLUES[q[1]].n);   // 누르는 순서와 상관없이 이 대화에서 줄어드는 숫자
          note(C.note, '', 'T1');
          setGauge(b, steps[got - 1], C.lb);
          if (got < need) { tip.innerHTML = '하나 더 있다. 계속 찾아보자.'; return; }
          tip.innerHTML = '<b>단서를 찾았다.</b> 게이지를 보자 — 몇 명으로 줄었나?';
          await wait(1100);
          if (c.k === 'A') {
            await ask(card, { right: '30px', bottom: '24px', width: '560px' }, {
              label: '판단', q: '이 정보 하나만으로 작성자를 알 수 있을까?',
              opts: [
                { t: '알 수 있다. 사는 곳이 나왔으니까.', fb: 'JC공원 근처에 사는 학생만 해도 80명쯤 된다.' },
                { t: '아직 모른다. 하지만 범위가 확 줄었다.', ok: true, fb: '맞아. 하나만으로는 모르지만 600명이 <b class="am">80명</b>으로 줄었다.' },
              ], next: '대화 B',
            });
          } else if (c.k === 'B') {
            await ask(card, { right: '30px', bottom: '24px', width: '560px' }, {
              label: '판단', q: '정보가 하나씩 더해질 때 무슨 일이 생기고 있지?',
              opts: [
                { t: '그대로다. 흔한 정보라 상관없다.', fb: '게이지를 다시 보자. 80명이 몇 명이 됐나?' },
                { t: '해당하는 사람이 점점 줄어든다.', ok: true, fb: '맞아. 흔한 정보도 <b class="am">겹칠수록</b> 사람이 줄어든다. 이제 2명.' },
              ], next: '대화 C',
            });
          } else {
            await wait(900);
            toast('조건에 맞는 학생이 한 명 남았다.', 'amber');
            await nextBtn(card, '후보 기록 대조하기', 'amber', { right: '30px', bottom: '24px' });
          }
          done();
        });
      });
    });
  }

  // 후보 대조 → 작성자 지목
  const CANDS = [
    { id: 'jiyu',    name: '지유', f: [['동네', 'JC공원 근처'], ['반', '6학년 3반'], ['계주', '마지막 주자'], ['학원', '푸른수학 화·목', 'x']], why: '학원이 다르다' },
    { id: 'doyun',   name: '도윤', f: [['동네', 'JC공원 근처'], ['반', '6학년 3반'], ['계주', '첫 주자', 'x'], ['학원', '별빛수학 월·수']], why: '계주 순서가 다르다' },
    { id: 'haram',   name: '하람', f: [['동네', 'JC공원 근처'], ['반', '6학년 3반'], ['계주', '마지막 주자'], ['학원', '별빛수학 월·수']] },
    { id: 'seoyeon', name: '서연', f: [['동네', '한빛공원 근처', 'x'], ['반', '6학년 3반'], ['계주', '마지막 주자'], ['학원', '별빛수학 월·수']], why: '사는 곳이 다르다' },
  ];
  const SUSPECT_LIVES = 2;
  function suspects(b) {
    return new Promise(resolve => {
      const host = $('#t1c', b); host.innerHTML = '';
      const wrap = el('div', '', `<div class="cands"></div>
        <div class="tip" style="position:absolute;left:48px;bottom:134px;font-size:22px;color:var(--text2);display:flex;gap:10px;align-items:center">${ic('i-hand')}<span id="stip">DM을 보낸 사람은 이 네 명의 기록과 수사 노트의 단서만으로 한 명을 찾아냈다. 네 명을 모두 눌러 보자.</span></div>
        <div class="guess panel" id="guess"><div class="lives" id="g-life">${'●'.repeat(SUSPECT_LIVES)}</div>
          <input class="tin" type="text" id="g-in" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="네 명을 다 열면 이름을 쓸 수 있다" disabled>
          <button class="act amber" id="g-go" disabled>작성자로 지목${ic('i-arrow')}</button></div>`);
      fadeIn(host, wrap);
      $('#toast').classList.remove('show');   // 앞 장면 안내가 입력칸을 가리지 않게
      $('.tip svg', wrap).style.cssText = 'width:24px;height:24px;color:var(--cyan)';
      const cands = $('.cands', wrap);
      const inp = $('#g-in', wrap), go = $('#g-go', wrap);
      let opened = 0, lives = SUSPECT_LIVES;
      const cardOf = id => $(`.cand[data-id="${id}"]`, cands);
      const setLives = n => { $('#g-life', wrap).textContent = '●'.repeat(Math.max(n, 0)) + '○'.repeat(SUSPECT_LIVES - Math.max(n, 0)); };
      CANDS.forEach(c => {
        const d = el('div', 'cand', `<div class="pic"><img src="assets/img/${c.id}.webp" alt=""></div>
          <div class="nm">${c.name}</div><div class="closed">눌러서 기록 보기</div>`);
        d.dataset.id = c.id;
        cands.appendChild(d);
        d.addEventListener('click', () => {
          if (d.dataset.open) return;
          d.dataset.open = 1; opened++;
          $('.closed', d).remove();
          S.play('evidence_found', { gain: .5 });
          const prof = el('div', 'prof', c.f.map(([k, v]) => `<div><span class="k">${k}</span><span class="kv">${v}</span></div>`).join(''));
          d.appendChild(prof);
          if (opened === CANDS.length) {
            $('#stip', wrap).textContent = '수사 노트의 단서와 하나씩 맞춰 보고, 작성자 이름을 써 보자.';
            inp.disabled = false; go.disabled = false; inp.placeholder = '작성자 이름 쓰기';
            setTimeout(() => inp.focus({ preventScroll: true }), 150);
          }
        });
      });
      typed(inp, go, async name => {
        const nm = norm(name);
        if (nm === '하람') return true;
        const wrong = CANDS.find(c => c.id !== 'haram' && c.name === nm);
        if (!wrong) { if (nm) $('#stip', wrap).innerHTML = '네 명 중 한 명의 이름을 쓰자.'; return false; }   // 빈칸이면 앞의 안내를 그대로 둔다
        inp.value = '';
        // 이미 틀렸던 이름을 또 쓰면 목숨은 그대로
        if (cardOf(wrong.id).classList.contains('out')) { $('#stip', wrap).innerHTML = `<b style="color:#ffb3b3">${wrong.name}</b>${(wrong.name.charCodeAt(wrong.name.length - 1) - 0xAC00) % 28 ? '은' : '는'} 이미 아니라고 확인했다. 남은 후보를 단서와 맞춰 보자.`; return false; }
        lives--; setLives(lives);
        S.play('remove_information', { gain: .5 });
        cardOf(wrong.id).classList.add('out');
        $('#stip', wrap).innerHTML = `<b style="color:#ffb3b3">${wrong.name}</b> — ${wrong.why}. 수사 노트의 단서와 맞지 않는다.`;
        if (lives <= 0) { inp.blur(); await gameOver(); }
        return false;
      }).then(async () => {
        $$('.cand', cands).forEach(x => x.classList.add('out'));
        cardOf('haram').classList.remove('out'); cardOf('haram').classList.add('pick');
        $('#guess', wrap).remove();
        await S.duck(500, 250);
        const m = el('div', 'match', `<div class="sys-label">IDENTITY MATCH</div><b>하람</b>`);
        wrap.appendChild(m); S.play('identity_match');
        await wait(40); m.classList.add('in');
        S.restore(1200);
        await wait(1800);
        m.classList.remove('in');
        await reveal1(wrap);
        resolve();
      });
    });
  }
  async function gameOver() {
    S.setAmbience(.1, 800);
    const b = await beat(`<div class="fin"><div class="c">INVESTIGATION FAILED</div>
      <h2>단서가 부족했다.<br>수사 실패 — 처음부터 다시 증거를 모으자.</h2>
      <div class="again"><button class="act" id="retry">처음부터 다시</button></div></div>`, 'dark');
    S.play('impact');
    await tapOnce($('#retry', b));
    location.href = location.pathname;
  }
  async function reveal1(wrap) {
    $('.cands', wrap).style.opacity = .25; $('.tip', wrap).style.opacity = 0;
    say(wrap, { left: '60px', top: '90px' }, '하람', 'haram_surprised', '어떻게 나인 줄 알았어?<br>내 이름은 한 번도 안 썼는데?');
    await ask(wrap, { left: '160px', top: '290px', width: '760px' }, {
      label: '하람에게 대답하기', q: '이름이 없었는데 어떻게 하람을 찾았을까?',
      opts: [
        { t: '대화 어딘가에 이름이 적혀 있었어.', fb: '다시 떠올려 보자. 이름은 한 번도 나오지 않았다.' },
        { t: '누군가 너를 몰래 따라다녔어.', fb: '따라다닌 게 아니다. 대화 속 말만으로 찾아냈다.' },
        { t: '하나씩은 흔한 정보인데, 합치니까 너 한 명만 남았어.', ok: true,
          fb: '동네 · 반 · 계주 · 학원. 따로 보면 별거 아닌 정보가 <b class="am">합쳐지자 600명 중 1명</b>이 됐다.' },
      ], next: '기준 확인',
    });
    mission(1);
    await stamp(1);
    await trace2();
  }

  /* ═════════════ TRACE 02 — 사진 ═════════════ */
  const PW = 1536, PH = 1024, VW = 1050, K = VW / PW;
  const SPOTS = [
    { id: 'jiyu_tag',   r: [230, 596, 112, 84],  kind: 'other', note: '친구 이름표 "지유"', lab: '다른 사람 · 이름', fb: '이름표에 친구 이름이 보인다.' },
    { id: 'jiyu_face',  r: [196, 180, 250, 290], kind: 'other', note: '친구 얼굴 — 지유', lab: '다른 사람 · 얼굴', fb: '지유의 얼굴이다. 하람의 정보가 아니다.' },
    { id: 'seoyeon_face', r: [800, 262, 262, 290], kind: 'other', note: '친구 얼굴 — 서연', lab: '다른 사람 · 얼굴', fb: '서연의 얼굴이다.' },
    { id: 'doyun_face', r: [1096, 206, 312, 310], kind: 'other', note: '친구 얼굴 — 도윤', lab: '다른 사람 · 얼굴', fb: '도윤의 얼굴이다.' },
    { id: 'haram_face', r: [486, 140, 262, 280], kind: 'self', lab: '하람 본인', fb: '바통을 든 아이가 하람이다.' },
    { id: 'haram_tag',  r: [582, 592, 136, 80],  kind: 'self', lab: '하람 이름표', fb: '하람 본인의 이름표다.' },
    { id: 'baton',      r: [452, 672, 116, 200], kind: 'none', lab: '', fb: '바통은 사람 정보가 아니다.' },
    { id: 'sign',       r: [1010, 70, 330, 180], kind: 'info' },
  ];
  const WHO_OPTS = { self: '하람 본인의 정보', other: '다른 사람의 정보', none: '사람 정보가 아니다' };
  const WRONG = {
    other: { self: '하람은 가운데에서 바통을 든 아이다. 이 사람은 하람이 아니다.', none: '사람의 얼굴이나 이름은 그 사람의 정보다.' },
    self: { other: '다시 보자. 가운데 바통을 든 아이가 하람이다.', none: '하람의 얼굴·이름도 개인정보다.' },
    none: { self: '바통은 물건이다. 누구인지 알려 주지 않는다.', other: '바통은 물건이다. 누구인지 알려 주지 않는다.' },
  };
  async function trace2() {
    setProgress(2);
    let b = await beat(`<div class="head"><div class="eyebrow">TRACE 02 · 사진 속에는 나만 있을까?</div><h1>공유된 대화의 두 번째 기록</h1></div>
      <div class="convbig panel" style="bottom:130px">
        <div class="ch"><b>대화 B</b><span>09.18 · 이어서</span><span class="tag">체육대회</span></div>
        <div class="umsg" style="font-size:28px"><div class="who">${ic('i-user')}하람</div>우리 반 체육대회 사진이야. 이 사진 보고 재미있는 제목 좀 만들어줘!
          <img src="assets/img/photo_sports.webp" alt="" style="width:330px;border-radius:12px;margin-top:14px"></div>
        <div class="aimsg"><div class="b">AI</div><div>「6학년 3반, 마지막 바통은 우리가 쥔다!」 어때요?</div></div></div>`, 'trace');
    await wait(900);
    await ask(b, { right: '48px', bottom: '28px', width: '560px' }, {
      label: '예상', q: '이 사진이 공개되면, 드러나는 건 하람의 정보뿐일까?',
      opts: [
        { t: '하람이 올렸으니 하람의 정보뿐이다.', ok: true, fb: '정말 그럴까? 사진을 직접 살펴보자.' },
        { t: '다른 사람의 정보도 있을 것 같다.', ok: true, fb: '그럴지도. 사진을 직접 살펴보자.' },
      ], next: '사진 조사하기',
    });

    b = await beat(`<div class="pcount"><div><h1>하람 말고, 누구의 정보가 보일까?</h1><p>사진 위를 손가락(마우스)으로 비추고, 사람이나 글자가 보이면 눌러 보자.</p></div>
        <div class="ct">다른 사람의 정보 <b id="p-ct">0</b> / 4</div></div>
      <div class="photo" id="ph" style="top:118px"><img src="assets/img/photo_sports.webp" alt="체육대회 단체 사진"><div class="dark"></div><div class="ring"></div></div>`, 'trace');
    const ph = $('#ph', b);
    [[236, 602, 98, 70, '지유'], [590, 600, 122, 64, '하람']].forEach(([x, y, w, h, n]) => {
      const t = el('div', 'nametag', `<span><small>6-3</small>${n}</span>`);
      Object.assign(t.style, { left: x * K + 'px', top: y * K + 'px', width: w * K + 'px', height: h * K + 'px', fontSize: (h * K * .5) + 'px' });
      ph.insertBefore(t, $('.dark', ph));
    });
    const done = new Set(); let busy = false, objN = 0, found = 0;
    const setLight = (x, y) => { ph.style.setProperty('--x', x + 'px'); ph.style.setProperty('--y', y + 'px'); };
    setLight(VW / 2, 350);
    const local = e => { const r = ph.getBoundingClientRect(), k = VW / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
    let down = null;
    ph.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, moved: false }; ph.setPointerCapture(e.pointerId); setLight(...local(e)); });
    ph.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' || down) setLight(...local(e));
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.moved = true;
    });

    await new Promise(resolve => {
      ph.addEventListener('pointerup', async e => {
        const d = down; down = null;
        if (!d || d.moved || busy) return;
        const [vx, vy] = local(e), px = vx / K, py = vy / K;
        const hit = SPOTS.find(s => px >= s.r[0] && px <= s.r[0] + s.r[2] && py >= s.r[1] && py <= s.r[1] + s.r[3]);
        if (!hit) {
          const p = el('div', 'ping'); p.style.left = vx + 'px'; p.style.top = vy + 'px'; ph.appendChild(p); setTimeout(() => p.remove(), 620);
          S.play('ui_click', { gain: .5 });
          toast(['운동장 풍경이다. 사람 정보는 보이지 않는다.', '여기엔 특별한 정보가 없다.', '사람의 얼굴이나 글자를 찾아보자.'][objN++ % 3]);
          return;
        }
        if (done.has(hit.id)) { toast('이미 조사한 곳이다.'); return; }
        if (hit.kind === 'info') { S.play('scan'); toast('"6-3" 팻말 — 사진 속 아이들이 모두 6학년 3반이라는 게 드러난다.'); return; }
        busy = true;
        S.play('photo_focus'); setTimeout(() => S.play('scan'), 90);
        // 누구의 정보? — 사진 옆에 판단 카드
        const cx = 110 + (hit.r[0] + hit.r[2] / 2) * K, cy = 118 + (hit.r[1] + hit.r[3] / 2) * K;
        const left = cx < 110 + VW / 2 ? Math.min(cx + 90, 1270 - 470) : Math.max(cx - 530, 20);
        const top = Math.max(20, Math.min(cy - 160, 828 - 360));
        const hl = el('div', 'frame', ''); Object.assign(hl.style, { left: hit.r[0] * K + 'px', top: hit.r[1] * K + 'px', width: hit.r[2] * K + 'px', height: hit.r[3] * K + 'px' });
        ph.appendChild(hl);
        await ask(b, { left: left + 'px', top: top + 'px' }, {
          cls: 'pop', label: '판단', q: '이건 누구의 정보일까?',
          opts: Object.entries(WHO_OPTS).map(([k, t]) => ({ t, ok: k === hit.kind, fb: k === hit.kind ? hit.fb : WRONG[hit.kind][k] })),
          next: false, delay: 1300,
        });
        $$('.ask.pop', b).forEach(a => a.remove());
        done.add(hit.id);
        hl.className = 'frame ' + (hit.kind === 'other' ? 'am' : hit.kind === 'self' ? 'self' : '') + (hit.r[1] + hit.r[3] > 900 ? ' up' : '');
        if (hit.kind === 'none') hl.remove();
        else hl.innerHTML = `<div class="lab">${hit.lab}</div>`;
        if (hit.kind === 'other') {
          found++; $('#p-ct', b).textContent = found;
          note(hit.note, '', 'T2');
        }
        busy = false;
        if (found === 4) resolve();
      });
    });
    await wait(500);
    ph.classList.add('lit'); await S.duck(500, 250);
    S.play('identity_match', { gain: .7 });
    toast('잠깐. 공개된 건 하람의 정보만이 아니었다.', 'amber', 3200);
    S.restore(1200);
    await wait(2600);

    // 피해 비트: 지유에게도
    b = await beat(`<div class="head"><div class="eyebrow">TRACE 02</div><h1>같은 날 밤, 지유의 폰</h1></div>
      <img src="assets/img/photo_sports.webp" alt="" style="position:absolute;left:48px;top:150px;width:520px;border-radius:14px;opacity:.55">`, 'trace');
    await wait(500);
    banner(b, { app: '메시지 요청 · study_0927', ap: 'DM', bg: 'linear-gradient(135deg,#6e5cff,#d14fa7)', msg: '너 지유지? 하람이랑 같은 반 ㅎㅎ 사진 봤어~', snd: 'impact', left: '900px' });
    await wait(1400);
    say(b, { left: '620px', top: '190px', maxWidth: '580px' }, '지유', 'jiyu_surprised', '나는 이 사진 어디에도 올린 적 없는데…?<br>이 사람이 내 얼굴이랑 이름을 어떻게 알아?');
    await wait(1200);
    await ask(b, { left: '620px', top: '420px', width: '600px' }, {
      label: '판단', q: '무엇이 문제였을까?',
      opts: [
        { t: '사진을 AI에게 보낸 것 자체가 잘못이다.', fb: '사진이 문제가 아니다. 사진 속에 <b>누가 담겼는지</b>가 문제다.' },
        { t: '사진 속에 친구의 얼굴과 이름이 있는데 확인하지 않았다.', ok: true, fb: '맞아. 내 정보만이 아니라 <b class="am">다른 사람의 정보</b>도 확인해야 한다.' },
      ], next: '기준 확인',
    });
    await stamp(2);
    await trace3();
  }

  /* ═════════════ TRACE 03 — 로그인 ═════════════ */
  const PIECES = [
    { id: 'q', html: 'AIEP 로그인이 계속 안 돼. 뭐가 문제인지 봐줘.', ok: [0], res: 'keep',
      fb: '문제를 설명하는 말이다. 이게 있어야 AI가 도울 수 있다.', no: { 1: '이 말이 없으면 AI가 무엇을 도와야 할지 모른다.', 2: '위험한 정보가 들어 있지 않다. 다시 보자.' } },
    { id: 'id', html: '아이디: <span class="kv">haram_63</span>', ok: [1, 2], res: 'cut',
      fb: '없어도 로그인 문제는 물어볼 수 있다. 게다가 <b class="am">haram_63</b>에는 이름과 반(6-3)이 담겨 있다.', no: { 0: '로그인이 안 되는 이유를 묻는 데 아이디가 꼭 필요할까?' } },
    { id: 'pw', html: '비밀번호: <span class="kv">haram0615!</span><span class="fake">(가상 비밀번호)</span>', ok: [2], res: 'danger', snd: 'sensitive_information',
      fb: '비밀번호를 알면 <b class="rd">누구든 하람 계정에 들어갈 수 있다.</b> 절대 넣으면 안 되는 중요 정보다.',
      no: { 0: '비밀번호가 있어야 AI가 도울 수 있을까? 다시 생각해 보자.', 1: '없어도 되는 정도가 아니다. 더 심각하다. 다시 골라 보자.' } },
    { id: 'when', html: '어제까진 됐는데 오늘 갑자기 안 돼.', ok: [0], res: 'keep',
      fb: '언제부터 안 됐는지는 원인을 찾는 데 도움이 된다.', no: { 1: '언제부터 문제가 생겼는지 알면 원인을 찾기 쉽다.', 2: '위험한 정보가 들어 있지 않다.' } },
  ];
  async function trace3() {
    setProgress(3);
    let b = await beat(`<div class="head"><div class="eyebrow">TRACE 03 · 로그인이 안 돼</div><h1>하람이 AI에게 보낸 글을 한 조각씩 살펴보자.</h1></div>
      <div class="composer panel"><div class="ch"><img src="assets/img/haram.webp" alt="">09.27 · 하람이 AI에게 보낸 글</div><div id="pcs" style="display:flex;flex-direction:column;gap:12px"></div></div>`, 'trace');
    const pcs = $('#pcs', b);
    const els = PIECES.map(p => { const d = el('div', 'pc', p.html); pcs.appendChild(d); return d; });
    const labels = ['필요해', '없어도 돼', '넣으면 위험해'];
    for (let i = 0; i < PIECES.length; i++) {
      const p = PIECES[i], d = els[i];
      d.classList.add('cur'); S.play('scan', { gain: .6 });
      await askType(b, { left: '730px', top: '150px', width: '490px' }, {
        label: `조각 ${i + 1} / 4`, q: 'AI가 로그인 문제를 해결하는 데 이 말이 필요할까?',
        opts: labels.map((t, k) => ({ t, ok: p.ok.includes(k), fb: p.ok.includes(k) ? p.fb : p.no[k], snd: p.snd })),
        next: i < 3 ? '다음 조각' : '정리 끝',
      });
      $$('.ask', b).forEach(a => a.remove());
      d.classList.remove('cur');
      if (p.res === 'danger') { d.classList.add('shake'); note('비밀번호', 'red', 'T3'); }
      if (p.id === 'id') note('아이디 haram_63', '', 'T3');
      d.classList.add(p.res);
      if (p.res !== 'keep') S.play('remove_information');
      await wait(300);
    }
    const res = el('div', 'result', `<span class="sys-label">보내도 되는 글</span>AIEP 로그인이 계속 안 돼. 뭐가 문제인지 봐줘. 어제까진 됐는데 오늘 갑자기 안 돼.`);
    fadeIn($('.composer', b), res);
    S.play('evidence_register');
    await wait(900);
    say(b, { left: '730px', top: '160px', maxWidth: '490px' }, '하람', 'haram_thinking', '근데 AI한테만 보여주는 건데도 안 돼?');
    await wait(900);
    await ask(b, { left: '730px', top: '340px', width: '490px' }, {
      label: '하람에게 대답하기', q: '뭐라고 말해 줄까?',
      opts: [
        { t: 'AI한테만이면 괜찮아. 나중에 지우면 되지.', fb: '보낸 대화는 지워도 어딘가에 남거나, 다른 사람에게 보일 수 있다.' },
        { t: '비밀번호 같은 중요 정보는 처음부터 넣지 않아.', ok: true, fb: '가리거나 나중에 지우는 게 아니라, <b class="am">처음부터 안 넣기.</b>' },
      ], next: '기준 확인',
    });
    await stamp(3);

    // 피해 비트: 실제로는 비밀번호가 그대로 남아 있었다
    b = await beat(`<div class="head"><div class="eyebrow">TRACE 03</div><h1>그런데 실제로 하람이 보낸 글에는<br>비밀번호가 그대로 있었다.</h1></div>
      <div class="composer panel" style="top:220px;width:640px;bottom:auto"><div class="ch"><img src="assets/img/haram.webp" alt="">09.27 · 실제로 보낸 글</div>
        <div class="pc keep">AIEP 로그인이 계속 안 돼. 뭐가 문제인지 봐줘.</div><div class="pc keep">아이디: <span class="kv">haram_63</span></div>
        <div class="pc keep" style="border-color:rgba(255,107,107,.7)">비밀번호: <span class="kv">haram0615!</span><span class="fake">(가상)</span></div><div class="pc keep">어제까진 됐는데 오늘 갑자기 안 돼.</div></div>`, 'trace');
    await wait(1600);
    banner(b, { app: 'AIEP 보안 알림', icon: 'i-shield', bg: '#c2410c', time: '9:12', msg: '새 기기에서 로그인 시도가 있었어요. 본인이 아니라면 비밀번호를 바꾸세요.', left: '935px' });
    await wait(1300);
    say(b, { left: '740px', top: '300px', maxWidth: '480px' }, '하람', 'haram_surprised', '뭐야… 나 해킹당한 거야?!');
    await nextBtn(b, 'TRACE 04 · 정말 해킹일까?');
    await trace4();
  }

  /* ═════════════ TRACE 04 — 어떻게 밖으로 나갔나 ═════════════ */
  async function trace4() {
    setProgress(4);
    // ① 해킹일까?
    let b = await beat(`<div class="head"><div class="eyebrow">TRACE 04 · 어떻게 밖으로 나갔나</div><h1>정말 해킹일까? 보안 기록부터 보자.</h1></div>
      <div class="sec-card panel"><div class="sys-label">AIEP · 계정 보안 기록</div><h3>haram_63</h3>
        <div class="sec-row"><span>로그인 시도</span><b class="warn">1번 (9/29 21:12, 새 기기)</b></div>
        <div class="sec-row"><span>비밀번호 틀린 횟수</span><b class="warn">0번 — 처음부터 정확</b></div>
        <div class="sec-row"><span>로그인 결과</span><b class="ok">추가 확인 단계에서 막힘</b></div>
        <div class="sec-row" style="border:0"><span>비밀번호 변경</span><b class="ok">없음</b></div></div>`, 'trace');
    await wait(800);
    await ask(b, { left: '690px', top: '150px', width: '530px' }, {
      label: '판단', q: '누군가 하람 계정을 몰래 뚫은(해킹한) 걸까?',
      opts: [
        { t: '맞아, 해킹당한 거야.', fb: '해킹이라면 비밀번호를 알아내려고 여러 번 틀렸을 것이다. 이 사람은 <b>한 번에 맞혔다.</b>' },
        { t: '아니, 하람이 적어 둔 비밀번호를 누군가 본 거야.', ok: true,
          fb: '맞아. 비밀번호는 하람의 AI 대화 안에 있었다. 그리고 그 대화는 <b class="am">검색으로 찾을 수 있었다.</b>' },
      ], next: '계속',
    });
    note('해킹 아님 — 비밀번호를 본 것', 'cy', 'T4');
    $$('.ask', b).forEach(a => a.remove());
    const q = el('div', 'cap', '그렇다면, 하람만 보던 AI 대화가<br>어떻게 인터넷에 나왔을까?<small>9월 28일 하람의 기록을 따라가 보자. 이번엔 <b class="cy">여러분이 하람</b>이다.</small>');
    Object.assign(q.style, { position: 'absolute', left: '690px', top: '170px', width: '540px' });
    fadeIn(b, q);
    await nextBtn(b, '하람이 되어 보기');

    // ② 재연 — 하람이 되어 공유하기
    b = await beat(`<div class="head" style="right:440px"><div class="eyebrow">TRACE 04 · 9월 28일 (일) 저녁</div><h1>도윤이 공부 계획을 물어본다.</h1></div>
      <div class="aiapp"><div class="ah"><b>AI 도우미</b><span>하람의 대화</span><button class="sharebtn" id="shb">${ic('i-share')}공유</button></div>
        <div class="ab">
          <div class="old">주말에 산책하고 싶어. 우리 집이 JC공원에서…</div>
          <div class="old">우리 반 체육대회 사진이야 📷</div>
          <div class="old">AIEP 로그인이 계속 안 돼… 비밀번호: ●●●●</div>
          <div class="u2">시험 공부 계획 다시 정리해 줘!</div>
          <div class="a2">좋아요! 이번 주 계획이에요.<ol><li>월·수: 학원 끝나고 복습 30분</li><li>화·목: 수학 문제 20개</li><li>금: 영어 단어 50개</li></ol></div>
        </div>
        <div class="sheet" id="sheet"><h4>대화 공유 링크 만들기</h4><div class="fine">링크가 있는 사람은 누구나 이 대화를 볼 수 있어요.</div>
          <div class="lnk">chat-ai.example/share/7f3a9c</div><button class="mk" id="mk">${ic('i-copy')}링크 만들고 복사하기</button></div></div>
      ${PHONE(`<div class="dm-head">${ic('i-back', 'bk')}<div class="pf"><img src="assets/img/doyun.webp" alt=""></div><div><div class="nm">도윤</div><div class="sub">친구</div></div></div>
        <div class="dm-list" id="dml"></div><button class="sendbtn" id="snd" disabled>${ic('i-send')}도윤에게 보내기</button>`, '')}`, 'trace');
    const phone = $('.phone', b); phone.classList.add('t4-phone');
    const list = $('#dml', b);
    await wait(700);
    await typing(list, 900);
    bubble(list, 'in', '야 너 시험 공부 계획 어떻게 짰어?');
    await wait(900);
    toast('AI가 짜 준 계획을 도윤에게 보여 주자. <b style="color:var(--cyan-2)">공유</b> 버튼을 눌러 보자.', '', 4000);
    const shb = $('#shb', b); shb.classList.add('glow');
    await tapOnce(shb); shb.classList.remove('glow');
    $('#sheet', b).classList.add('in'); S.play('evidence_found', { gain: .5 });
    const mk = $('#mk', b); mk.classList.add('glow');
    await tapOnce(mk); mk.classList.remove('glow');
    $('#sheet', b).classList.remove('in');
    toast('링크가 복사되었습니다.');
    const snd = $('#snd', b); snd.disabled = false; snd.classList.add('glow');
    await tapOnce(snd);
    bubble(list, 'out', 'AI가 정리 잘해줬다. 이것 봐봐<span class="lnkbub">chat-ai.example/share/7f3a9c</span>');
    await wait(700); list.appendChild(el('div', 'seen', '읽음'));
    note('공유 링크 → 도윤', 'cy', 'T4');
    await wait(900);
    const pred = await ask(b, { left: '48px', top: '380px', width: '700px' }, {
      label: '예상', q: '도윤이 이 링크를 열면 무엇이 보일까?',
      opts: [
        { t: 'AI가 짜 준 공부 계획 답변만', ok: true, fb: '도윤의 화면으로 확인해 보자.' },
        { t: '하람이 AI와 나눈 대화 전체', ok: true, fb: '도윤의 화면으로 확인해 보자.' },
      ], next: '도윤의 화면 보기',
    });

    // ③ 받는 사람의 화면 — 위로 올려 보기
    b = await beat(`<div class="head" style="right:440px"><div class="eyebrow">TRACE 04 · 도윤의 화면</div><h1>링크를 열었다.</h1></div>
      <div class="recv"><div class="rh"><span class="u">chat-ai.example/share/7f3a9c</span><span class="pub">링크 공개</span><span class="who">공유된 대화 · 링크가 있는 누구나 볼 수 있음</span></div>
        <div class="rv"><div class="track" id="trk">
          <div class="rsec"><div class="d">09.12 · 주말 산책</div><div class="m">주말에 산책하고 싶어. <mark>우리 집이 JC공원에서 걸어서 3분</mark> 정도인데…</div><div class="tg">TRACE 01 · 사는 곳</div></div>
          <div class="rsec"><div class="d">09.18 · 체육대회</div><div class="m">나는 <mark>6학년 3반</mark>이고 <mark>이어달리기 마지막 주자</mark>인데… 우리 반 체육대회 사진이야!</div><div class="ph"></div><div class="tg">TRACE 01·02 · 반 · 계주 · 친구 얼굴과 이름</div></div>
          <div class="rsec"><div class="d">09.23 · 공부 계획</div><div class="m">방과 후에 <mark>별빛수학학원 월·수 5시 반</mark> 수업 가야 하는데…</div><div class="tg">TRACE 01 · 학원 시간</div></div>
          <div class="rsec"><div class="d">09.27 · 로그인 문제</div><div class="m">AIEP 로그인이 계속 안 돼. <mark class="r">아이디: haram_63</mark> <mark class="r">비밀번호: haram0615!</mark></div><div class="tg">TRACE 03 · 아이디 · 비밀번호</div></div>
          <div class="rsec ans"><div class="d">09.28 · 공부 계획 다시</div><div class="m">좋아요! 이번 주 계획이에요. 월·수: 학원 끝나고 복습 30분 …</div><div style="margin-top:8px;font-size:15px;font-weight:800;color:#1a47c7">← 하람이 보여 주려던 것</div></div>
        </div></div></div>
      <div class="cap" id="rcap" style="position:absolute;left:830px;top:170px;width:390px;font-size:26px">처음 보이는 건 하람이 보여 주려던 <b class="cy">답변</b>이다.<small>그런데 위로 올려 보면?</small></div>`, 'trace');
    const trk = $('#trk', b), rv = $('.rv', b), secs = $$('.rsec', trk);
    await wait(60);
    const off = s => Math.max(0, Math.min(trk.scrollHeight - rv.clientHeight, s.offsetTop - 20));
    let y = trk.scrollHeight - rv.clientHeight; trk.style.transition = 'none'; trk.style.transform = `translateY(${-y}px)`;
    await wait(50); trk.style.transition = '';
    const bar = el('div', 'nextbar', `<button class="act primary">${ic('i-arrow')}위로 올려 보기</button>`);
    Object.assign(bar.style, { left: '830px', right: 'auto', bottom: '60px' });
    $('svg', bar).style.transform = 'rotate(-90deg)';
    b.appendChild(bar);
    const btn = $('button', bar);
    for (let i = secs.length - 2; i >= 0; i--) {
      await tapOnce(btn);
      y = off(secs[i]); trk.style.transform = `translateY(${-y}px)`;
      await wait(500); secs[i].classList.add('hl');
      S.play(i === 3 ? 'sensitive_information' : 'evidence_found');
      $('#rcap', b).innerHTML = ['동네까지 다 보인다.', '반, 계주, 그리고 <b class="am">친구들의 얼굴과 이름</b>까지.', '학원 요일과 시간도.', '<b class="rd">비밀번호</b>가 그대로 있다.'][i] + '<small>' + (i ? '더 올려 보자.' : '대화 전체가 링크 하나에 담겨 있었다.') + '</small>';
    }
    bar.remove();
    await wait(900);
    say(b, { left: '830px', top: '430px', maxWidth: '400px' }, '하람', 'haram_thinking', '나는 AI 답변만 보여주려고 했는데…');
    await wait(800);
    toast(pred.i === 0 ? '하람도 "답변만" 보일 거라고 생각했다.' : '맞다. 링크 하나에 대화 전체가 담겨 있었다.', 'amber', 3200);
    await nextBtn(b, '링크는 어디로 갔을까?', 'primary', { left: '830px', right: 'auto' });

    // ④ 퍼지는 경로
    b = await beat(`<div class="head"><div class="eyebrow">TRACE 04 · 링크의 이동 경로</div><h1>링크 하나가 어디까지 갔을까?</h1></div>
      <div class="spread" id="spr"><svg id="spsvg"></svg></div>`, 'trace');
    const spr = $('#spr', b), svg = $('#spsvg', b);
    const NODES = [
      { x: 0,   y: 0,   img: 'haram', b: '하람', s: '링크를 만들어 도윤에게' },
      { x: 480, y: 0,   img: 'doyun', b: '도윤', s: '반 단톡방에 "이거 봐"' },
      { x: 960, y: 0,   icon: 'i-users', b: '반 단톡방', s: '누군가 게시판에 옮김' },
      { x: 960, y: 160, icon: 'i-share', b: '공개 게시판', s: '누구나 볼 수 있는 곳' },
      { x: 480, y: 160, icon: 'i-search', b: '검색 결과', s: '검색하면 나오게 됨' },
      { x: 0,   y: 160, icon: 'i-user', b: '모르는 사람', s: '하람에게 DM', hot: true },
    ];
    const nodeEls = NODES.map(n => {
      const d = el('div', 'snode' + (n.hot ? ' hot' : ''), `<div class="ic">${n.img ? `<img src="assets/img/${n.img}.webp" alt="">` : ic(n.icon)}</div><b>${n.b}</b><span>${n.s}</span>`);
      d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; spr.appendChild(d); return d;
    });
    for (let i = 0; i < NODES.length; i++) {
      if (i) {
        const a = NODES[i - 1], c = NODES[i];
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', `M${a.x + 90},${a.y + 70} L${c.x + 90},${c.y + 70}`);
        svg.appendChild(p); requestAnimationFrame(() => p.classList.add('in'));
      }
      nodeEls[i].classList.add('in');
      S.play(i === NODES.length - 1 ? 'impact' : 'connection', { gain: .6 });
      await wait(i === NODES.length - 2 ? 1100 : 750);
    }
    await wait(600);
    await ask(b, { left: '48px', top: '420px', width: '1174px' }, {
      label: '판단', q: '하람이 공유하기 전에 했어야 할 일은?', grid: true,
      opts: [
        { t: '도윤에게만 보냈으니 괜찮았다.', fb: '링크는 받은 사람이 얼마든지 다시 보낼 수 있다. 한 번 나간 링크는 멈추기 어렵다.' },
        { t: '문제가 생기면 그때 링크를 지운다.', fb: '이미 복사·전달된 뒤에는 지워도 늦을 수 있다.' },
        { t: '공유 전에 대화 안에 나·남의 정보가 있는지 확인하고, 필요한 답변만 골라 보여 준다.', ok: true,
          fb: '맞아. AI에게 보낼 때만이 아니라 <b class="am">다른 사람에게 보여줄 때도</b> 한 번 더 확인한다.' },
      ], next: '기준 확인',
    });
    mission(2); mission(3);
    await stamp(4);
    await report();
  }

  /* ═════════════ CASE REPORT ═════════════ */
  async function report() {
    const b = await beat(`<div class="rp-wrap">
      <div class="report panel"><div class="hd"><div><div class="eyebrow">CASE #01 · 낯선 DM</div><h1>CASE REPORT</h1></div><div class="stamp2" id="rps">UNRESOLVED</div></div>
        <div class="q3"><div><div class="sys-label">MISSION 1</div><h3>어떻게 하람을 알아봤나?</h3></div><div class="slot" data-q="1">질문에 답하면 채워진다</div></div>
        <div class="q3"><div><div class="sys-label">MISSION 2</div><h3>무엇이 드러나 있었나?</h3></div><div class="slot" data-q="2">질문에 답하면 채워진다</div></div>
        <div class="q3"><div><div class="sys-label">MISSION 3</div><h3>어떻게 밖으로 나갔나?</h3></div><div class="slot" data-q="3">질문에 답하면 채워진다</div></div>
        <div class="rp-guide" id="rpg">오른쪽 질문에 답하면 보고서가 한 칸씩 채워진다.</div></div>
      <div class="checklist panel wait" id="rpc"><div class="eyebrow">TRACE 01 — 04</div><h2>AI에게 보내기 전, 보여주기 전<br>확인할 4가지</h2><div class="cl-items" id="cli"></div>
        <div class="resolved" id="rpr"><div class="r">RESOLVED</div><div class="go"><button class="act primary" id="goSafe">이럴 땐 이렇게${ic('i-arrow')}</button></div></div></div></div>`, 'full');
    const cli = $('#cli', b);
    [1, 2, 3, 4].forEach(n => cli.appendChild(el('div', 'cl', `<div class="ic">${ic(TRACES[n].icon)}</div><div><div class="no">TRACE 0${n}</div><div class="tx">${TRACES[n].title}</div></div>`)));
    // 미션을 한 문항씩 묻고, 답할 때마다 보고서 칸을 채운다
    const pos = { left: '960px', top: '30px', width: '600px' };
    const fill = (q, list) => {
      const slot = $(`.slot[data-q="${q}"]`, b);
      slot.textContent = ''; slot.classList.add('filled');
      list.forEach(t => slot.appendChild(el('span', 'piece', t)));
      S.play('evidence_register');
      $$('.ask', b).forEach(a => a.remove());
    };
    const M1 = '흩어진 정보를 합쳐서 (동네·반·계주·학원)', M3 = '정보가 남은 AI 대화를 링크로 공유함';
    await wait(500);
    await ask(b, pos, {
      label: 'MISSION 1 / 3', q: '모르는 사람은 어떻게 하람을 알아봤나?',
      opts: [
        { t: '대화에 하람의 이름이 적혀 있어서', fb: '다시 떠올려 보자. 이름은 한 번도 나오지 않았다.' },
        { t: M1, ok: true, fb: '하나씩은 흔한 정보가 합쳐지자 <b class="am">600명 중 1명</b>이 됐다.' },
        { t: '누군가 하람을 몰래 따라다녀서', fb: '따라다닌 게 아니다. 대화 속 말만으로 찾아냈다.' },
      ], next: '보고서에 적기',
    });
    fill(1, [M1]);
    await wait(400);
    const m2 = await askMulti(b, pos, {
      label: 'MISSION 2 / 3', q: '공유된 대화에 무엇이 드러나 있었나?<br><span style="font-size:20px;color:var(--muted);font-weight:600">맞는 것을 모두 고르자.</span>',
      opts: [
        { t: '하람을 알아볼 수 있는 정보', ok: true },
        { t: '부모님의 직업과 전화번호', fb: '다시 떠올려 보자. 대화에 그런 정보는 없었다.' },
        { t: '친구의 얼굴과 이름', ok: true },
        { t: '아이디 · 비밀번호', ok: true },
      ], go: '보고서에 적기', miss: '아직 더 있다. TRACE 01~03에서 찾은 것을 떠올려 빠짐없이 골라 보자.',
    });
    fill(2, m2);
    await wait(400);
    await ask(b, pos, {
      label: 'MISSION 3 / 3', q: '하람의 정보는 어떻게 밖으로 나갔나?',
      opts: [
        { t: '누군가 하람의 계정을 해킹해서', fb: '보안 기록을 떠올려 보자. 비밀번호를 한 번에 맞혔다 — 해킹이 아니었다.' },
        { t: 'AI가 마음대로 퍼뜨려서', fb: '링크를 만든 건 하람이었다. AI가 스스로 퍼뜨린 게 아니다.' },
        { t: M3, ok: true, fb: '답변만 보여 주려던 링크에 <b class="am">대화 전체</b>가 담겨 있었다.' },
      ], next: '보고서에 적기',
    });
    fill(3, [M3]);
    $('#rpg', b).textContent = '보고서 완성';
    $('#rpc', b).classList.remove('wait');
    await wait(400);
    $('#rps', b).textContent = 'COMPLETE'; $('#rps', b).classList.add('ok'); S.play('connection');
    await wait(700);
    for (const c of $$('.cl', cli)) { c.classList.add('in'); S.play('evidence_found', { gain: .8 }); await wait(420); }
    await S.duck(400, 250, .1);
    S.play('case_resolved'); $('#rpr', b).classList.add('in'); $('#rps', b).textContent = 'RESOLVED';
    S.restore(1500);
    await tapOnce($('#goSafe', b));
    await safe();
  }

  /* ═════════════ 이럴 땐 이렇게 ═════════════ */
  async function safe() {
    const b = await beat(`<div class="safe"><h1>모르는 사람이 내 정보를 알고 연락해 오면</h1>
      <div class="sub">하람처럼 당황하지 말고, 이렇게 한다.</div>
      <div class="steps">
        <div class="step"><div class="ic">${ic('i-x')}</div><div class="n">STEP 1</div><b>답하지 않기</b><p>누구인지 묻거나 따지지 않는다. 대화를 이어 가지 않는다.</p></div>
        <div class="step"><div class="ic">${ic('i-camera')}</div><div class="n">STEP 2</div><b>화면 캡처</b><p>받은 메시지와 계정 이름을 캡처해 둔다.</p></div>
        <div class="step"><div class="ic">${ic('i-block')}</div><div class="n">STEP 3</div><b>차단·신고</b><p>앱의 차단·신고 기능을 쓴다. 비밀번호가 새었다면 바로 바꾼다.</p></div>
        <div class="step"><div class="ic">${ic('i-adult')}</div><div class="n">STEP 4</div><b>어른께 알리기</b><p>보호자·선생님께 바로 알린다. 혼자 해결하지 않는다.</p></div>
      </div>
      <div class="tel">개인정보 침해 상담 <b>☎ 118</b> (한국인터넷진흥원, 24시간)</div>
      <div class="go"><button class="act" id="goReal">그런데…${ic('i-arrow')}</button></div></div>`, 'full');
    for (const s of $$('.step', b)) { await wait(350); s.classList.add('in'); S.play('evidence_found', { gain: .6 }); }
    await tapOnce($('#goReal', b));
    await real();
  }

  /* ═════════════ 실제 사례 ═════════════ */
  async function real() {
    S.setAmbience(.08, 1500);
    const b = await beat(`<div class="real-pre" id="rp"><p>그런데…</p><p>이 사건은 완전히 꾸며낸 이야기만은 아닙니다.</p></div>
      <div class="real-card panel" id="rc"><div class="yr">REAL CASE · 2025</div><h3>AI 공유 대화가 검색 결과에 나타난 일</h3>
        <p>2025년 여름, ChatGPT에는 대화를 링크로 공유할 때 <b>'검색엔진에서 찾을 수 있게' 하는 선택 기능</b>이 잠시 있었습니다.
          이 기능을 켜고 공유된 대화 약 4,500건이 Google 검색 결과에 나타났고, 그중에는 이름 같은 <b>개인정보가 담긴 대화</b>도 있었습니다.
          OpenAI는 곧 이 기능을 없애고 검색 결과에서 지우는 조치를 했습니다.</p>
        <p>하람 사건은 이 일에서 <b>모티브를 얻어 재구성한 이야기</b>입니다.</p>
        <div class="src"><div class="sl">기사 출처 (영문)</div>
          <a href="https://www.engadget.com/ai/openai-is-removing-chatgpt-conversations-from-google-194735704.html" target="_blank" rel="noopener">OpenAI is removing ChatGPT conversations from Google <span>Engadget · 2025.08</span></a>
          <a href="https://searchengineland.com/chatgpt-kills-google-indexable-chats-459874" target="_blank" rel="noopener">ChatGPT kills Google-indexable chats over privacy fears <span>Search Engine Land · 2025.08</span></a>
          <a href="https://www.pcgamer.com/software/ai/chatgpt-removes-the-ability-for-conversations-to-be-displayed-by-search-engines-as-nearly-4-500-conversations-indexed-by-google/" target="_blank" rel="noopener">ChatGPT removes the ability for conversations to be displayed by search engines <span>PC Gamer · 2025.08</span></a></div>
        <div class="foot"><button class="act" id="goEnd">수사 마치기${ic('i-arrow')}</button></div></div>`, 'dark');
    await wait(800);
    const ps = $$('#rp p', b);
    ps[0].classList.add('in'); await wait(1500);
    ps[1].classList.add('in'); await wait(1700);
    $('#rp', b).classList.add('up'); await wait(500);
    $('#rc', b).classList.add('in'); S.play('evidence_register', { gain: .6 });
    await tapOnce($('#goEnd', b));
    const e = await beat(`<div class="fin end"><div class="kv"><div class="kv-drift"><img src="assets/img/ending.webp" alt=""></div></div>
      <div class="glow"></div><div class="kv-motes"></div><div class="shade"></div>
      <div class="tx"><div class="c">AI TRACE 수사 완료</div>
        <h2><span>AI에게 보내기 전,</span><span>그리고 다른 사람에게 보여주기 전 —</span><span>한 번 더 <b>TRACE</b>.</span></h2>
        <div class="again"><button class="act" id="again">처음부터 다시</button></div></div></div>`, 'dark');
    endingFx(e);
    S.setAmbience(S.musicOn ? .2 : .4, 2000);
    S.setMusic('ending', 3000);
    $('#again', e).addEventListener('click', () => { location.href = location.pathname; });
  }

  /* ═════════════ 교사용 바로가기 ═════════════ */
  // 중간부터 열 때 앞 단계의 수사 노트를 채워 둔다
  function prefill(upto) {
    if (upto >= 1) note('검색되는 AI 대화', 'cy', '?', true);
    if (upto >= 2) { ['JC공원 도보 3분', '6학년 3반', '이어달리기 마지막 주자', '별빛수학 월·수 5:30'].forEach(t => note(t, '', 'T1', true)); rule(1); mission(1); }
    if (upto >= 3) { ['친구 이름표 "지유"', '친구 얼굴 — 지유', '친구 얼굴 — 서연', '친구 얼굴 — 도윤'].forEach(t => note(t, '', 'T2', true)); rule(2); }
    if (upto >= 4) { note('아이디 haram_63', '', 'T3', true); note('비밀번호', 'red', 'T3', true); rule(3); }
    if (upto >= 5) { note('해킹 아님 — 비밀번호를 본 것', 'cy', 'T4', true); note('공유 링크 → 도윤', 'cy', 'T4', true); rule(4); mission(2); mission(3); }
  }
  const SCENES = {
    pro: [prologue, 0], t1: [() => { mode('trace'); return trace1(); }, 0], t2: [trace2, 2], t3: [trace3, 3], t4: [trace4, 4],
    report: [report, 5], safe: [safe, 5], real: [real, 5],
  };
  const KEYS = ['pro', 't1', 't2', 't3', 't4', 'report', 'safe', 'real'];
  document.addEventListener('keydown', e => {
    if (!e.shiftKey || typing_()) return;   // 입력칸에서 Shift+숫자(!, @ 등)를 칠 때 장면이 넘어가지 않게
    const m = /^Digit([1-8])$/.exec(e.code);
    if (m) { e.preventDefault(); location.href = location.pathname + '?s=' + KEYS[m[1] - 1]; }
  });
  window.__trace = { SCENES, SPOTS, K };   // 자동 점검용

  const qs = new URLSearchParams(location.search).get('s');
  const start = SCENES[qs] ? qs : 'pro';
  const gate = $('#startGate');
  const stopTitleFx = titleFx(gate);
  new Image().src = 'assets/img/ending.webp';   // 엔딩 이미지를 미리 읽어 둔다
  // 브라우저는 첫 클릭 전에는 소리를 못 낸다. 음악이 있고 처음부터 시작할 때만 두 번 누른다:
  // 첫 번째에 음악이 켜지고, 두 번째(「수사 시작」)에 넘어간다. 교사용 바로가기(?s=)는 한 번에 들어간다.
  const twoStep = S.musicOn && !SCENES[qs];
  let phase = 0;   // 0 대기 → 1 소리 켜는 중 → 2 「수사 시작」 대기 → 3 넘어가는 중
  function enter() {
    phase = 3; gate.style.pointerEvents = 'none';
    stopTitleFx();
    S.setMusic(null, 1500); S.setAmbience(.7, 1500); S.play('scan', { gain: .6 });
    anim($('.gate', gate), [{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
    anim($('.kv', gate), [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.14)' }], { duration: 900, easing: 'cubic-bezier(.5,0,.75,.3)' });   // 아이의 눈 쪽으로
    anim(gate, [{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: 0 }], { duration: 900, easing: 'linear' });
    setTimeout(() => gate.remove(), 920);
    prefill(SCENES[start][1]);
    if (SCENES[start][1] >= 1) setProgress(Math.min(SCENES[start][1], 5));
    SCENES[start][0]();
  }
  gate.addEventListener('click', async () => {
    if (phase === 2) return enter();
    if (phase !== 0) return;
    phase = 1;
    await S.unlock();
    if (!twoStep) return enter();
    S.setMusic('title', 2500);
    const tap = $('.tap', gate);
    tap.classList.add('go'); $('span', tap).textContent = '수사 시작';
    anim($('.kv-sweep', gate), sweepFrames(0), { duration: 2200, fill: 'none', easing: 'linear' });
    phase = 2;
  });
})();
