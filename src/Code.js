var PROPS = PropertiesService.getScriptProperties();
var DISCORD_COLOR_GREEN = 5763719;
var DISCORD_COLOR_RED = 15548997;
function toBool_(value) {
  return String(value).toLowerCase() === 'true';
}
function getConfig_() {
  var url = PROPS.getProperty('SUPABASE_URL');
  var key = PROPS.getProperty('SUPABASE_KEY');
  var table = PROPS.getProperty('SUPABASE_TABLE');
  if (!url || !key) {
    throw new Error('SUPABASE_URL と SUPABASE_KEY をスクリプトプロパティに設定してください。');
  }
  return {
    url: url.replace(/\/$/, ''),
    key: key,
    table: table,
    notifyEmail: PROPS.getProperty('NOTIFY_EMAIL'),
    mailOnlyOnFailure: toBool_(PROPS.getProperty('MAIL_ONLY_ON_FAILURE')),
    discordWebhookUrl: PROPS.getProperty('DISCORD_WEBHOOK_URL'),
    discordOnlyOnFailure: toBool_(PROPS.getProperty('DISCORD_ONLY_ON_FAILURE')),
  };
}
function pingSupabase() {
  var config = getConfig_();
  var endpoint = config.table
    ? config.url + '/rest/v1/' + config.table + '?select=*&limit=1'
    : config.url + '/rest/v1/';
  var response = UrlFetchApp.fetch(endpoint, {
    method: 'get',
    headers: {
      apikey: config.key,
      Authorization: 'Bearer ' + config.key,
    },
    muteHttpExceptions: true,
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      'Supabaseへのリクエストが失敗しました (status: ' + status + '): ' + response.getContentText()
    );
  }
  return status;
}
function keepAlive() {
  var success = true;
  var errorMessage = '';
  try {
    var status = pingSupabase();
    Logger.log('Supabase keep-alive 成功 (status: ' + status + ')');
  } catch (err) {
    success = false;
    errorMessage = err.message;
    Logger.log('Supabase keep-alive 失敗: ' + errorMessage);
  }
  notifyMail_(success, errorMessage);
  notifyDiscord_(success, errorMessage);
  if (!success) {
    throw new Error(errorMessage);
  }
}
function notifyMail_(success, errorMessage) {
  var config = getConfig_();
  if (!config.notifyEmail) return;
  if (config.mailOnlyOnFailure && success) return;
  try {
    MailApp.sendEmail({
      to: config.notifyEmail,
      subject: success
        ? '[Supabase Extender] Keep-alive 成功'
        : '[Supabase Extender] Keep-alive 失敗',
      body:
        (success
          ? 'Supabaseプロジェクトへの定期アクセスに成功しました。'
          : 'Supabaseプロジェクトへの定期アクセスに失敗しました。\n\nエラー内容:\n' + errorMessage) +
        '\n\n実行時刻: ' +
        new Date().toString(),
    });
  } catch (mailErr) {
    Logger.log('通知メールの送信に失敗しました: ' + mailErr.message);
  }
}
function notifyDiscord_(success, errorMessage) {
  var config = getConfig_();
  if (!config.discordWebhookUrl) return;
  if (config.discordOnlyOnFailure && success) return;
  var payload = {
    embeds: [
      {
        title: success ? 'Keep-alive 成功' : 'Keep-alive 失敗',
        description: success
          ? 'Supabaseプロジェクトへの定期アクセスに成功しました。'
          : 'Supabaseプロジェクトへの定期アクセスに失敗しました。\n\n' + errorMessage,
        color: success ? DISCORD_COLOR_GREEN : DISCORD_COLOR_RED,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  try {
    UrlFetchApp.fetch(config.discordWebhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (webhookErr) {
    Logger.log('Discord通知の送信に失敗しました: ' + webhookErr.message);
  }
}
function createWeeklyTrigger() {
  removeTriggers_();
  ScriptApp.newTrigger('keepAlive').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  Logger.log('毎週月曜 6時台に keepAlive を実行するトリガーを作成しました。');
}
function removeTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) {
      return t.getHandlerFunction() === 'keepAlive';
    })
    .forEach(function (t) {
      ScriptApp.deleteTrigger(t);
    });
}
