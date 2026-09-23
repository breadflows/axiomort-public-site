// Public submission endpoint, not a secret. Responses go to BreadFlows' private inbox.
export const FEEDBACK_ENDPOINT = 'https://formsubmit.co/ajax/contact@breadflows.com';
export const SURVEY_VERSION = 'island-playtest-2026-09-v1';
export const QUESTIONS = [
  {id:'enjoyment', title:'Did you enjoy playing?', options:['Yes','Some parts','No']},
  {id:'direction', title:'Did you know what to do next?', options:['Yes','Sometimes','No']},
  {id:'performance', title:'How did it run?', options:['Smoothly','Some lag','Hard to play']},
  {id:'more', title:'What would you like more of?', multi:true, options:['Exploring islands','Building and crafting','Rift challenges','Flying ships','Not sure yet']},
  {id:'return', title:'Would you play another demo?', options:['Yes','Maybe','No']}
];
const safeText = (value, max) => String(value || '').trim().slice(0, max).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function feedbackPayload(answers, extras = {}, source = 'manual') {
  const payload = {
    _subject:'AXIOMORT | demo survey',
    _template:'table',
    _honey:String(extras.website || '').slice(0,200),
    'Survey version':SURVEY_VERSION,
    'Opened from':['completion','pause','feedback-page'].includes(source) ? source : 'manual'
  };
  let answered = 0;
  for (const q of QUESTIONS) {
    if (q.multi) {
      const selected = q.options.filter(option => Array.isArray(answers[q.id]) && answers[q.id].includes(option));
      const valid = selected.includes('Not sure yet') ? ['Not sure yet'] : selected;
      payload[q.title] = valid.length ? valid.join('; ') : 'Skipped';
      if (valid.length) answered++;
    } else {
      payload[q.title] = q.options.includes(answers[q.id]) ? answers[q.id] : 'Skipped';
      if (payload[q.title] !== 'Skipped') answered++;
    }
  }
  const comments = safeText(extras.comments, 2000);
  const contact = safeText(extras.contact, 254);
  if (!answered && !comments) throw new Error('Choose at least one answer, or leave an optional comment.');
  if (payload._honey) throw new Error('Unable to send this response.');
  if (comments) payload['Optional comments'] = comments;
  if (contact) payload['Optional contact'] = contact;
  payload['May contact about this feedback'] = contact && extras.followUp === true ? 'Yes' : 'No';
  return payload;
}
export async function sendFeedback(payload, request = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await request(FEEDBACK_ENDPOINT, {
      method:'POST', headers:{'Content-Type':'application/json', Accept:'application/json'},
      credentials:'omit', referrerPolicy:'strict-origin',
      body:JSON.stringify(payload), signal:controller.signal
    });
    const result = await response.json();
    if (/activat|confirm.{0,40}email|check.{0,40}email/i.test(String(result?.message || '')))
      throw new Error('The feedback inbox needs activation. Your answers are still here. Please try again later.');
    if (!response.ok || (result?.success !== true && result?.success !== 'true'))
      throw new Error('Feedback was not accepted. Your answers are still here. Please try again later.');
    return true;
  } catch (error) {
    if (error instanceof Error && /^(The feedback inbox|Feedback was not accepted)/.test(error.message)) throw error;
    throw new Error('We could not confirm delivery. Your answers are still here. If you retry, a duplicate may arrive.');
  } finally { clearTimeout(timer); }
}

// A click on the old question must not select an answer on the next one.
export function allowSurveyNavigation(lastNavigation, now, clickDetail = 1) {
  return clickDetail <= 1 && now - lastNavigation >= 300;
}
