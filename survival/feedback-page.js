import {createFeedback} from './feedback.js?v=20260922-copy';

const survey = createFeedback();
document.getElementById('open-survey').onclick = () => survey.open('feedback-page');
survey.open('feedback-page');
