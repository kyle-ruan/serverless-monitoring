import { setRetention, setMetric, setAlarm } from '../../libs/cloudwatch';
import logger from '../../libs/log';

export const handler = async (event, context, callback) => {
  let logGroupName;

  try {
    const logGroupName = event.detail.requestParameters.logGroupName;
    if (
      !logGroupName.startsWith('/aws/lambda') &&
      !logGroupName.startsWith('/coreplus')
    ) {
      logger.debug(`${logGroupName} doesn't require error alarm`);
      callback(null, JSON.stringify({ status: 200 }));
    }
    await setRetention(logGroupName);
    await setMetric(logGroupName);
    await setAlarm(logGroupName);

    callback(null, JSON.stringify({ status: 200 }));
  } catch (err) {
    logger.error(
      `error config log group: ${err.message}`,
      { logGroup: logGroupName },
      err
    );
    callback(null, JSON.stringify({ status: 500 }));
  }
};
