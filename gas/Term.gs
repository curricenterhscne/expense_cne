// 새 학기 시작 — 사본 보관 후 원본 초기화

/**
 * 새 학기를 시작합니다.
 * 순서를 반드시 지켜야 합니다. 순서가 바뀌면 데이터가 사라집니다.
 *
 * ① 확인 대화상자 — 현재 신청 건수를 보여주고 진행 여부를 묻습니다
 * ② DriveApp.makeCopy() → 보관폴더ID로 이동
 * ③ 복사 결과 검증 — 실패 시 중단
 * ④ 신청내역 2행 이하 삭제
 * ⑤ 집계표·미제출 시트 삭제
 * ⑥ 강좌목록 2행 이하 삭제
 * ⑦ 접수번호 시퀀스 초기화
 * ⑧ 완료 안내
 */
function startNewTerm() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 설정 읽기
  var config;
  try {
    config = getConfig();
  } catch (e) {
    ui.alert('❌ 설정 오류\n\n' + e.message);
    return;
  }

  var semesterCode = config['학기코드'] || '(미지정)';

  // ── 현재 데이터 건수 확인
  var submitSheet = ss.getSheetByName(SHEET.신청내역);
  var submitCount = 0;
  if (submitSheet && submitSheet.getLastRow() > 1) {
    submitCount = submitSheet.getLastRow() - 1;
  }

  var courseSheet = ss.getSheetByName(SHEET.강좌목록);
  var courseCount = 0;
  if (courseSheet && courseSheet.getLastRow() > 1) {
    courseCount = courseSheet.getLastRow() - 1;
  }

  // ── ① 확인 대화상자
  var confirmMsg = '⚠ 새 학기 시작\n\n' +
    '현재 학기: ' + semesterCode + '\n' +
    '신청내역: ' + submitCount + '건\n' +
    '강좌목록: ' + courseCount + '건\n\n' +
    '위 데이터를 보관 사본에 백업한 뒤,\n' +
    '원본을 초기화합니다.\n\n' +
    '정말 진행하시겠습니까?';

  var response = ui.alert('새 학기 시작', confirmMsg, ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('취소되었습니다.');
    return;
  }

  // ── ② 보관 사본 생성
  var copyName = '[보관] ' + semesterCode + ' 수업운영비';
  var folderId = config['보관폴더ID'];
  var copiedFile;

  try {
    copiedFile = DriveApp.getFileById(ss.getId()).makeCopy(copyName);
  } catch (e) {
    ui.alert('❌ 사본 생성 실패\n\n' + e.message + '\n\n데이터를 삭제하지 않았습니다.');
    return;
  }

  // 보관 폴더로 이동
  try {
    var folder = DriveApp.getFolderById(folderId);
    copiedFile.moveTo(folder);
  } catch (e) {
    ui.alert('⚠ 사본은 생성되었으나 폴더 이동에 실패했습니다.\n\n' +
      '파일: ' + copiedFile.getName() + '\n' +
      '오류: ' + e.message + '\n\n' +
      '사본을 수동으로 확인한 뒤 다시 시도하세요.\n' +
      '데이터를 삭제하지 않았습니다.');
    return;
  }

  // ── ③ 복사 결과 검증
  try {
    var copiedSS = SpreadsheetApp.open(copiedFile);
    var copiedSubmit = copiedSS.getSheetByName(SHEET.신청내역);
    if (!copiedSubmit) {
      throw new Error('보관 사본에 "' + SHEET.신청내역 + '" 시트가 없습니다.');
    }
    var copiedCount = copiedSubmit.getLastRow() > 1 ? copiedSubmit.getLastRow() - 1 : 0;
    if (copiedCount !== submitCount) {
      throw new Error('신청내역 건수 불일치: 원본 ' + submitCount + '건, 사본 ' + copiedCount + '건');
    }
  } catch (e) {
    ui.alert('❌ 사본 검증 실패\n\n' + e.message + '\n\n' +
      '사본 파일: ' + copiedFile.getName() + '\n' +
      '데이터를 삭제하지 않았습니다. 사본을 확인해 주세요.');
    return;
  }

  // ── ④ 신청내역 2행 이하 삭제
  if (submitSheet && submitSheet.getLastRow() > 1) {
    submitSheet.deleteRows(2, submitSheet.getLastRow() - 1);
  }

  // ── ⑤ 집계표·미제출 시트 삭제
  var summarySheet = ss.getSheetByName(SHEET.집계표);
  if (summarySheet) ss.deleteSheet(summarySheet);

  var pendingSheet = ss.getSheetByName(SHEET.미제출);
  if (pendingSheet) ss.deleteSheet(pendingSheet);

  // ── ⑥ 강좌목록 2행 이하 삭제
  if (courseSheet && courseSheet.getLastRow() > 1) {
    courseSheet.deleteRows(2, courseSheet.getLastRow() - 1);
  }

  // ── ⑦ 접수번호 시퀀스 초기화
  PropertiesService.getScriptProperties().setProperty('submitSeq', '0');

  // 설정 캐시 무효화
  CacheService.getScriptCache().remove('appConfig');

  // ── ⑧ 완료 안내
  ui.alert(
    '✅ 새 학기 초기화 완료\n\n' +
    '보관 사본: ' + copiedFile.getName() + '\n\n' +
    '다음 작업을 진행해 주세요:\n' +
    '1. "설정" 시트의 학기명·학기코드를 수정\n' +
    '2. "설정" 시트의 접수상태를 변경\n' +
    '3. "강좌목록" 시트에 새 강좌 목록을 붙여넣기'
  );
}
