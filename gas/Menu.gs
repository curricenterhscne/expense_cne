// onOpen 스프레드시트 메뉴 등록

/**
 * 스프레드시트를 열 때 커스텀 메뉴를 추가합니다.
 *
 * 📊 운영비 관리
 *  ├ 설정 확인
 *  ├ 집계표 새로고침
 *  ├ 미제출 목록 생성
 *  ├ ─────────
 *  └ 새 학기 시작
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 운영비 관리')
    .addItem('설정 확인', 'menuCheckConfig')
    .addItem('집계표 새로고침', 'menuBuildSummary')
    .addItem('미제출 목록 생성', 'menuBuildPending')
    .addSeparator()
    .addItem('새 학기 시작', 'menuStartNewTerm')
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

/**
 * 집계표를 (재)생성합니다.
 */
function menuBuildSummary() {
  buildSummarySheet();
}

/**
 * 미제출 목록을 생성합니다.
 */
function menuBuildPending() {
  buildPendingSheet();
}

/**
 * 새 학기를 시작합니다 (보관 사본 → 초기화).
 */
function menuStartNewTerm() {
  startNewTerm();
}
