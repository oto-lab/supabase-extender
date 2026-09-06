var PROPS = PropertiesService.getScriptProperties();
function getConfig_() {
  var url = PROPS.getProperty('SUPABASE_URL');
  var key = PROPS.getProperty('SUPABASE_KEY');
  var table = PROPS.getProperty('SUPABASE_TABLE');
  var notifyEmail = PROPS.getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
  if (!url || !key) {
    throw new Error('SUPABASE_URL と SUPABASE_KEY をスクリプトプロパティに設定してください。');
  }
  return {
    url: url.replace(/\/$/, ''),
    key: key,
    table: table,
    notifyEmail: notifyEmail,
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
  try {
    var status = pingSupabase();
    Logger.log('Supabase keep-alive 成功 (status: ' + status + ')');
  } catch (err) {
    Logger.log('Supabase keep-alive 失敗: ' + err.message);
    notifyFailure_(err);
    throw err;
  }
}
function notifyFailure_(err) {
  try {
    var config = getConfig_();
    if (!config.notifyEmail) return;
    MailApp.sendEmail({
      to: config.notifyEmail,
      subject: '[Supabase Extender] Keep-alive 実行に失敗しました',
      body:
        'Supabaseプロジェクトへの定期アクセスに失敗しました。\n\n' +
        'エラー内容:\n' +
        err.message +
        '\n\n実行時刻: ' +
        new Date().toString(),
    });
  } catch (mailErr) {
    Logger.log('失敗通知メールの送信にも失敗しました: ' + mailErr.message);
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
