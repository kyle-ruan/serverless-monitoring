import {
  parseSnsMessage,
  getLogs,
  generateLogEmail
} from '../../libs/cloudwatch';
import logger from '../../libs/log';
import Mailgun from 'mailgun-js';

export const handler = async (event, context, callback) => {
  let logs;
  try {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const metricFilters = await parseSnsMessage(message);
    const metricFilter = metricFilters.metricFilters[0];

    logs = await getLogs(message, metricFilter);

    const email = generateLogEmail(message, logs.events, metricFilter);
    const emailRequest = {
      from: process.env.FROM,
      to: process.env.ALERT_ADDRESS,
      subject: email.subject,
      html: email.body
    };

    const mailgun = new Mailgun({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_API_URL
    });

    const response = await mailgun.messages().send(emailRequest);
    logger.debug('mailgun response', { response });
    callback(null, { status: 200 });
  } catch (err) {
    logger.error('fail to send alarm', { logs }, err);
    callback(null, { status: 500 });
  }
};
