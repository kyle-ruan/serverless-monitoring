import Promise from 'bluebird';
import { processAll } from '../../libs/datadog';
const zlib = Promise.promisifyAll(require('zlib'));

export const handler = async (event, context, callback) => {
  try {
    const payload = new Buffer(event.awslogs.data, 'base64');
    const json = (await zlib.gunzipAsync(payload)).toString('utf8');
    const logEvent = JSON.parse(json);

    await processAll(logEvent);
    callback(null, JSON.stringify({ status: 200 }));
  } catch (err) {
    callback(null, JSON.stringify({ status: 500 }));
  }
};
