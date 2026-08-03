// onOpen 스프레드시트 메뉴 등록

/**
 * 스프레드시트를 열 때 커스텀 메뉴를 추가합니다.
 * 메뉴 항목은 이후 Phase에서 기능 구현 시 추가합니다.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 운영비 관리')
    .addItem('설정 확인', 'menuCheckConfig')
    .addToUi();
}

/**
 * 설정 시트 값을 읽어 정상인지 확인하는 메뉴 동작
 */
function menuCheckConfig() {
  try {
    var config = getConfig();
    SpreadsheetApp.getUi().alert(
      '✅ 설정 확인 완료\n\n' +
      '학기명: ' + config['학기명'] + '\n' +
      '과정명: ' + config['과정명'] + '\n' +
      '거점학교명: ' + config['거점학교명'] + '\n' +
      '인당단가: ' + Number(config['인당단가']).toLocaleString() + '원\n' +
      '접수상태: ' + config['접수상태']
    );
  } catch (err) {
    SpreadsheetApp.getUi().alert('❌ 설정 오류\n\n' + err.message);
  }
}
