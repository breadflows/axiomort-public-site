import {QUESTIONS, SURVEY_VERSION, feedbackPayload, sendFeedback, allowSurveyNavigation} from './feedback-model.js?v=20260922-audit';

// Answers and contact details live only in memory, never in browser storage or URLs.
export function createFeedback({onOpen = () => {}, onClose = () => {}} = {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'playtest-survey';
  dialog.setAttribute('aria-labelledby','survey-title');
  dialog.innerHTML = `<div class="survey-shell"><aside class="survey-intro" aria-hidden="true"><span class="survey-brand">AXIOMORT</span><div><p>CAMPAIGN COMPLETE</p><strong>END OF DEMO</strong></div><small>© 2026 BreadFlows</small></aside><section class="survey-form"><div class="survey-top"><span>AXIOMORT</span><button type="button" data-close aria-label="Close survey">Close ×</button></div>
    <div class="survey-progress" aria-hidden="true"><span></span></div>
    <p class="survey-step"></p><h2 id="survey-title" tabindex="-1"></h2>
    <div class="survey-content"></div><p class="survey-status" role="status" aria-live="polite"></p>
    <div class="survey-nav"><button type="button" data-back>Back</button><button type="button" data-skip>Skip question</button><button type="button" data-next>Next →</button></div></section></div>`;
  document.body.append(dialog);
  const find = s => dialog.querySelector(s);
  let step = 0, answers = {}, extras = {comments:'',contact:'',followUp:false,website:''};
  let source = 'manual', busy = false, sent = false, sendFailed = false, previousFocus = null, lastSent = 0;
  let lastNavigation = -Infinity;
  const navigate = (event, action) => {
    const now = performance.now();
    if (busy || !allowSurveyNavigation(lastNavigation, now, event?.detail ?? 1)) return false;
    lastNavigation = now; action(); return true;
  };
  const storageKey = 'axiomort-survey-seen:' + SURVEY_VERSION + ':endgame';
  const markSeen = () => { try { localStorage.setItem(storageKey,'1'); } catch {} };
  const wasSeen = () => { try { return localStorage.getItem(storageKey) === '1'; } catch { return false; } };
  const rememberExtras = () => {
    const comments = find('[name="comments"]');
    if (!comments) return;
    extras = {
      comments:comments.value, contact:find('[name="contact"]').value,
      followUp:find('[name="follow-up"]').checked, website:find('[name="website"]').value
    };
  };
  const close = () => { if (source === 'completion' && !sent && !sendFailed) return; rememberExtras(); dialog.close(); };
  dialog.addEventListener('close', () => { onClose(source); if (source !== 'completion' && previousFocus?.isConnected) previousFocus.focus(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (source !== 'completion') close(); });
  // Prevent gameplay key handlers from treating typing or Tab as game controls.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('keyup', event => event.stopPropagation());
  find('[data-close]').onclick = close;
  function button(label, action, selected = false) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'survey-choice';
    b.textContent = label; b.setAttribute('aria-pressed',String(selected)); b.onclick = action; return b;
  }
  function render(focus = true) {
    const content = find('.survey-content'); content.replaceChildren();
    find('.survey-status').textContent = '';
    const ending = source === 'completion';
    find('[data-close]').hidden = ending;
    find('[data-back]').hidden = step === 0 || sent;
    find('[data-skip]').hidden = ending || step >= QUESTIONS.length || sent;
    find('[data-next]').hidden = sent || (step < QUESTIONS.length && !QUESTIONS[step].multi);
    find('[data-next]').disabled = busy || (ending && step < QUESTIONS.length && QUESTIONS[step].multi && !(answers.more?.length));
    find('[data-back]').disabled = busy;
    find('.survey-progress span').style.width = ((Math.min(step + 1,6) / 6) * 100) + '%';
    if (sent) {
      find('.survey-step').textContent = ending ? 'CAMPAIGN COMPLETE' : 'SENT';
      find('#survey-title').textContent = ending ? 'Thank you for playing.' : 'Thank you.';
      const community = document.createElement('p'); community.className = 'survey-community';
      community.append(document.createTextNode('Want to talk directly and share more feedback? '));
      const discord = document.createElement('a'); discord.href = 'discord.html'; discord.target = '_blank'; discord.rel = 'noopener noreferrer'; discord.textContent = 'AXIOMORT Discord, coming soon';
      community.append(discord); content.append(community,button(ending ? 'Return to main menu' : 'Close',close));
    } else if (step < QUESTIONS.length) {
      const q = QUESTIONS[step];
      find('.survey-step').textContent = (ending ? 'QUESTION ' : '') + (step + 1) + ' / ' + QUESTIONS.length;
      find('#survey-title').textContent = q.title;
      if (q.multi) {
        const group = document.createElement('fieldset');
        const legend = document.createElement('legend'); legend.className = 'survey-sr'; legend.textContent = q.title; group.append(legend);
        q.options.forEach(option => {
          const label = document.createElement('label'); label.className = 'survey-check';
          const input = document.createElement('input'); input.type = 'checkbox'; input.value = option;
          input.checked = (answers.more || []).includes(option);
          input.onchange = () => {
            const current = new Set(answers.more || []);
            if (input.checked) {
              if (option === 'Not sure yet') current.clear(); else current.delete('Not sure yet');
              current.add(option);
            } else current.delete(option);
            answers.more = [...current];
            group.querySelectorAll('input').forEach(box => { box.checked = current.has(box.value); });
            if (ending) find('[data-next]').disabled = current.size === 0;
          };
          label.append(input,document.createTextNode(option)); group.append(label);
        });
        content.append(group); find('[data-next]').textContent = 'Next →';
      } else {
        q.options.forEach(option => content.append(button(option, event => navigate(event, () => { answers[q.id] = option; step++; render(); }),answers[q.id] === option)));
      }
    } else {
      find('.survey-step').textContent = ending ? 'FINAL STEP' : 'REVIEW';
      find('#survey-title').textContent = 'Your answers';
      const summary = document.createElement('dl'); summary.className = 'survey-summary';
      QUESTIONS.forEach(q => {
        const title = document.createElement('dt'); title.textContent = q.title;
        const value = document.createElement('dd'); value.textContent = q.multi ? (answers[q.id]?.join(', ') || 'Skipped') : (answers[q.id] || 'Skipped');
        summary.append(title,value);
      });
      content.append(summary);
      const optional = document.createElement('div');
      optional.innerHTML = `<details><summary>Comments <span>Optional</span></summary><label>Comments<textarea name="comments" maxlength="2000" rows="3"></textarea></label></details>
        <details><summary>Contact <span>Optional</span></summary><label>Username, email or another way to reach you<input name="contact" type="text" maxlength="254" autocomplete="off"></label><label class="survey-consent"><input name="follow-up" type="checkbox">You may contact me about this feedback.</label></details>
        <label class="survey-trap" aria-hidden="true">Leave this empty<input name="website" type="text" tabindex="-1" autocomplete="off"></label>
        <details class="survey-privacy"><summary>Privacy</summary><p>Your answers go to BreadFlows’ private inbox through FormSubmit to help improve AXIOMORT.</p><p>No identity is required. Hosting and form providers may process connection data such as IP addresses for security; this is not a guarantee of complete anonymity. FormSubmit retains submissions for 30 days; email copies remain in the BreadFlows inbox until deleted.</p><p>For privacy or deletion requests: contact@breadflows.com. Unnamed responses may be difficult to identify.</p><p><a href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener noreferrer">FormSubmit privacy information ↗</a></p></details>
        <p class="survey-disclosure">Sent privately to BreadFlows via FormSubmit.</p>`;
      content.append(optional);
      find('[name="comments"]').value = extras.comments;
      find('[name="contact"]').value = extras.contact;
      find('[name="follow-up"]').checked = extras.followUp;
      find('[name="website"]').value = extras.website;
      find('[data-next]').textContent = busy ? 'Sending…' : 'Send feedback';
      content.querySelectorAll('input,textarea').forEach(input => { input.disabled = busy; });
    }
    if (focus && dialog.open) { find('#survey-title').focus(); dialog.scrollTop = 0; }
  }
  find('[data-back]').onclick = event => navigate(event, () => { rememberExtras(); step = Math.max(0,step - 1); render(); });
  find('[data-skip]').onclick = event => navigate(event, () => { delete answers[QUESTIONS[step].id]; step++; render(); });
  find('[data-next]').onclick = async event => {
    if (busy) return;
    if (step < QUESTIONS.length) { if (source === 'completion' && !answers.more?.length) return; navigate(event, () => { step++; render(); }); return; }
    if (!navigate(event, () => {})) return;
    rememberExtras();
    if (Date.now() - lastSent < 60000) { find('.survey-status').textContent = 'Please wait a minute before sending another response.'; return; }
    let payload;
    try { payload = feedbackPayload(answers,extras,source); } catch (error) { find('.survey-status').textContent = error.message; return; }
    busy = true; render(false);
    try {
      await sendFeedback(payload);
      lastSent = Date.now(); sent = true; if (source === 'completion') markSeen();
      answers = {}; extras = {comments:'',contact:'',followUp:false,website:''};
    } catch (error) {
      busy = false; sendFailed = true; render(false); find('.survey-status').textContent = error.message;
      if (source === 'completion') find('.survey-content').append(button('Return to main menu',close));
      return;
    } finally { busy = false; }
    render();
  };
  return {
    get isOpen() { return dialog.open; },
    open(origin = 'manual') {
      if (dialog.open) return false;
      lastNavigation = -Infinity;
      source = origin; previousFocus = document.activeElement;
      dialog.dataset.mode = origin === 'completion' ? 'ending' : 'manual';
      if (origin === 'completion') { step = 0; answers = {}; extras = {comments:'',contact:'',followUp:false,website:''}; sent = wasSeen(); sendFailed = false; }
      onOpen(); render(false); dialog.showModal(); find('#survey-title').focus(); return true;
    }
  };
}
