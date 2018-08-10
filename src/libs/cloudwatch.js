import AWS from 'aws-sdk';
import { deepGet } from '../helpers';
import logger from './log';

const cloudWatchLogs = new AWS.CloudWatchLogs();
const cloudWatch = new AWS.CloudWatch({ apiVersion: '2010-08-01' });

const parseSnsMessage = async message => {
  const alarmName = message.AlarmName;
  const oldState = message.OldStateValue;
  const newState = message.NewStateValue;
  const reason = message.NewStateReason;

  const requestParams = {
    metricName: message.Trigger.MetricName,
    metricNamespace: message.Trigger.Namespace
  };

  const metricFilters = await cloudWatchLogs
    .describeMetricFilters(requestParams)
    .promise();
  return metricFilters;
};

const getLogs = async (message, metricFilter) => {
  const timestamp = Date.parse(message.StateChangeTime);
  const offset =
    message.Trigger.Period * message.Trigger.EvaluationPeriods * 1000;
  const parameters = {
    logGroupName: metricFilter.logGroupName,
    filterPattern: metricFilter.filterPattern || '',
    startTime: timestamp - offset,
    endTime: timestamp
  };
  const logs = await cloudWatchLogs.filterLogEvents(parameters).promise();
  return logs;
};

const generateLogEmail = (message, events, metricFilter) => {
  const logGroup = metricFilter.logGroupName;
  const style = '<style> pre {color: red;} </style>';
  let logData = '<br/>Logs:<br/>' + style;

  for (let i in events) {
    try {
      const event = events[i];
      logData += `<pre>Log Stream: ${event['logStreamName']}`;
      let eventMessage;
      if (logGroup.indexOf('/aws/lambda') >= 0) {
        eventMessage = parseLambdaLog(event);
      } else {
        eventMessage = JSON.parse(event.message);
      }
      if (eventMessage.level) {
        logData += `message: ${
          eventMessage.message
        }<br/>properties: ${JSON.stringify(
          eventMessage.properties
        )}<br/>request id: ${deepGet(
          eventMessage,
          ['request', 'requestId'],
          ''
        )}<br/>url: ${deepGet(
          eventMessage,
          ['request', 'url'],
          ''
        )}</pre><br/>`;
      } else {
        logData += `message: ${JSON.stringify(eventMessage)}</pre><br/>`;
      }
    } catch (err) {
      logger.error(`generate email body error: ${err.message}`, null, err);
    }
  }

  const date = new Date(message.StateChangeTime);
  const text =
    'Alarm Name: ' +
    '<b>' +
    message.AlarmName +
    '</b><br/>' +
    'Alarm Time: ' +
    date.toString() +
    '<br/>' +
    logData;
  const subject = 'Alarm - ' + message.AlarmName;
  return {
    subject,
    body: text
  };
};

const tryParseJson = str => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

const parseLambdaLog = logEvent => {
  if (
    logEvent.message.startsWith('START RequestId') ||
    logEvent.message.startsWith('END RequestId') ||
    logEvent.message.startsWith('REPORT RequestId')
  ) {
    return null;
  }

  let parts = logEvent.message.split('\t', 3);
  let timestamp = parts[0];
  let requestId = parts[1];
  let event = parts[2];

  let properties = tryParseJson(event);
  if (properties) {
    properties.request = { requestId };

    let level = (properties.level || 'debug').toLowerCase();
    let message = properties.message;

    // level and message are lifted out, so no need to keep them there
    delete properties.level;
    delete properties.message;

    return { level, message, properties, '@timestamp': new Date(timestamp) };
  } else {
    return {
      level: 'debug',
      message: event,
      '@timestamp': new Date(timestamp)
    };
  }
};

const setRetention = async logGroupName => {
  const params = {
    logGroupName,
    retentionInDays: process.env.RETENTION_DAYS
  };
  await cloudWatchLogs.putRetentionPolicy(params).promise();
};

const setMetric = async logGroupName => {
  const functionName = logGroupName.split('/').reverse()[0];
  const params = {
    filterName: `${functionName}-error-filter`,
    filterPattern: '{$.level="ERROR"}',
    logGroupName,
    metricTransformations: [
      {
        metricName: `${functionName}LogError`,
        metricNamespace: 'CloudWatchLogs',
        metricValue: '1',
        defaultValue: 0.0
      }
    ]
  };
  await cloudWatchLogs.putMetricFilter(params).promise();
};

const setAlarm = async logGroupName => {
  const functionName = logGroupName.split('/').reverse()[0];

  const params = {
    AlarmName: `${functionName}ErrorAlert`,
    ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    EvaluationPeriods: 1,
    MetricName: `${functionName}LogError`,
    Namespace: 'CloudWatchLogs',
    Period: 300,
    Statistic: 'Sum',
    Threshold: 1.0,
    ActionsEnabled: true,
    AlarmDescription: `Alarm when ${functionName} has error`,
    AlarmActions: [process.env.ALARM_SNS_TOPIC],
    Unit: 'Count'
  };

  await cloudWatch.putMetricAlarm(params).promise();
};
export {
  parseSnsMessage,
  getLogs,
  generateLogEmail,
  parseLambdaLog,
  setRetention,
  setMetric,
  setAlarm
};
