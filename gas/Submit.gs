// 신청 데이터 upsert (강좌코드 기준 덮어쓰기) — 이번 재개발의 핵심 기능

/**
 * 신청서를 제출(upsert)합니다.
 * - 강좌코드로 기존 행을 찾아 있으면 갱신, 없으면 추가
 * - 갱신 시: 접수번호·최초제출일시·접수상태는 유지, 최종수정일시 갱신, 수정횟수 +1
 * - 전체를 LockService로 감싸 동시 제출에 대비
 * - 서버에서 검증: 마감 여부, 한도 초과, 항목 수, 강좌코드 유효성
 *
 * @param {Object} payload - 신청 데이터
 * @returns {Object} { success, seq, isUpdate }
 */
function submitApplication(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // ── 1. 서버 검증
    var config = getConfig();

    // 접수상태가 마감이면 거부
    if (config['접수상태'] === '마감') {
      throw new Error('신청이 마감되었습니다.');
    }

    // 필수 필드 확인
    var courseCode = String(payload.courseCode || '').trim();
    if (!courseCode) {
      throw new Error('강좌코드가 없습니다.');
    }

    // 강좌코드가 강좌목록에 존재하는지 확인
    var courseInfo = findCourseByCode_(courseCode);
    if (!courseInfo) {
      throw new Error('강좌목록에 없는 강좌코드입니다: ' + courseCode);
    }

    // 항목 수 검증
    var items = payload.items || [];
    if (items.length > MAX_ITEMS) {
      throw new Error('세부 항목은 최대 ' + MAX_ITEMS + '개까지 입력 가능합니다.');
    }

    // 총액 검증 — 운영비를 희망하는 경우에만
    var wantsExpense = payload.wantsExpense === true;
    var totalAmount = Number(payload.totalAmount) || 0;

    if (wantsExpense) {
      var maxBudget = courseInfo.students * config['인당단가'];
      if (totalAmount > maxBudget) {
        throw new Error(
          '총소요예산(' + totalAmount.toLocaleString() + '원)이 한도(' +
          maxBudget.toLocaleString() + '원 = ' + courseInfo.students + '명 × ' +
          config['인당단가'].toLocaleString() + '원)를 초과합니다.'
        );
      }

      // 항목 금액 합과 총액이 일치하는지 확인
      var itemSum = 0;
      for (var v = 0; v < items.length; v++) {
        itemSum += Number(items[v].amount) || 0;
      }
      if (itemSum !== totalAmount) {
        throw new Error('항목 금액의 합(' + itemSum.toLocaleString() + '원)과 총소요예산(' + totalAmount.toLocaleString() + '원)이 일치하지 않습니다.');
      }
    }

    // ── 2. 신청내역 시트 준비
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET.신청내역);

    if (!sheet) {
      sheet = createSubmitSheet_(ss);
    }

    // ── 3. 타임스탬프
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    // ── 4. 데이터 행 구성 (공통 부분)
    var rowData = buildRowData_(payload, courseInfo, items, wantsExpense, totalAmount);

    // ── 5. upsert — 강좌코드로 기존 행 검색
    var allData = sheet.getDataRange().getValues();
    var existingRow = -1;
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][COL.강좌코드 - 1] || '').trim() === courseCode) {
        existingRow = i + 1; // 1-based 행 번호
        break;
      }
    }

    var seq;
    var isUpdate = false;

    if (existingRow > 0) {
      // ── 갱신: 접수상태·접수번호·최초제출일시 유지
      isUpdate = true;
      seq = allData[existingRow - 1][COL.접수번호 - 1];
      var prevCount = Number(allData[existingRow - 1][COL.수정횟수 - 1]) || 0;

      // 접수상태는 기존값 유지 (덮어쓰지 않음!)
      var existingStatus = allData[existingRow - 1][COL.접수상태 - 1];
      var existingFirstSubmit = allData[existingRow - 1][COL.최초제출일시 - 1];

      // 전체 행 덮어쓰기 (접수상태·접수번호·최초제출일시·수정횟수 보존)
      var updateRow = [existingStatus, seq, existingFirstSubmit, now, prevCount + 1];
      updateRow = updateRow.concat(rowData);

      sheet.getRange(existingRow, 1, 1, updateRow.length).setValues([updateRow]);
      applyRowFormat_(sheet, existingRow, wantsExpense);

    } else {
      // ── 신규: 접수번호 채번, 접수상태 '미접수'
      seq = getNextSeq_();
      var newRow = ['미접수', seq, now, now, 1];
      newRow = newRow.concat(rowData);

      sheet.appendRow(newRow);
      var newRowIndex = sheet.getLastRow();
      applyRowFormat_(sheet, newRowIndex, wantsExpense);

      // 접수상태 열에 데이터 유효성 검사 설정
      applyStatusValidation_(sheet, newRowIndex);
    }

    return { success: true, seq: seq, isUpdate: isUpdate };

  } finally {
    lock.releaseLock();
  }
}

// ────────────────────────────────────────────────────────────
// 내부 헬퍼 함수
// ────────────────────────────────────────────────────────────

/**
 * 강좌목록에서 강좌코드로 강좌 정보를 찾습니다.
 * 수강인원 숫자 변환이 불가하면 null을 반환합니다 (신청 불가 강좌).
 * @private
 */
function findCourseByCode_(courseCode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.강좌목록);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var headers = data[0];

  function findCol(candidates) {
    for (var c = 0; c < candidates.length; c++) {
      var target = candidates[c].replace(/\s/g, '');
      for (var i = 0; i < headers.length; i++) {
        if (String(headers[i]).trim().replace(/\s/g, '').indexOf(target) !== -1) {
          return i;
        }
      }
    }
    return -1;
  }

  var ci = {
    courseCode: findCol(['강좌코드']),
    students:  findCol(['수강인원', '수강 인원'])
  };

  if (ci.courseCode === -1) return null;

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][ci.courseCode] || '').trim() === courseCode) {
      var rawStudents = ci.students !== -1 ? data[r][ci.students] : 0;
      var numStudents = Number(rawStudents);
      if (isNaN(numStudents) || String(rawStudents).indexOf('#') !== -1) {
        // 수강인원 데이터 오류 — 신청 불가
        throw new Error('강좌 "' + courseCode + '"의 수강인원 데이터에 오류가 있습니다: ' + String(rawStudents));
      }
      return { students: numStudents };
    }
  }

  return null;
}

/**
 * 신청 데이터를 시트 행 배열로 변환합니다 (강좌코드 ~ 비고).
 * 접수상태·접수번호·제출일시·수정횟수는 포함하지 않습니다.
 * @private
 */
function buildRowData_(payload, courseInfo, items, wantsExpense, totalAmount) {
  var row = [
    String(payload.courseCode || '').trim(),
    String(payload.subjectCode || '').trim(),
    String(payload.subjectName || '').trim(),
    String(payload.major || '').trim(),
    String(payload.teacherName || '').trim(),
    String(payload.teacherSchool || '').trim(),
    String(payload.teacherContact || '').trim(),
    String(payload.dayOfWeek || '').trim(),
    Number(payload.students) || 0,
    wantsExpense ? '희망' : '희망하지 않음'
  ];

  // 세부 항목 10칸 (구분·산출식·금액 × 10)
  for (var i = 0; i < MAX_ITEMS; i++) {
    if (items[i]) {
      row.push(
        String(items[i].category || '').trim(),
        String(items[i].formula || '').trim(),
        Number(items[i].amount) || 0
      );
    } else {
      row.push('', '', '');
    }
  }

  row.push(totalAmount);
  row.push(String(payload.note || '').trim());

  return row;
}

/**
 * 신청내역 시트를 헤더·서식과 함께 생성합니다.
 * @private
 */
function createSubmitSheet_(ss) {
  var sheet = ss.insertSheet(SHEET.신청내역);

  // 헤더 입력
  var headerRange = sheet.getRange(1, 1, 1, SUBMIT_HEADERS.length);
  headerRange.setValues([SUBMIT_HEADERS]);
  headerRange.setBackground('#0d2444');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // 주요 열 너비
  sheet.setColumnWidth(COL.접수상태, 70);
  sheet.setColumnWidth(COL.접수번호, 70);
  sheet.setColumnWidth(COL.최초제출일시, 140);
  sheet.setColumnWidth(COL.최종수정일시, 140);
  sheet.setColumnWidth(COL.수정횟수, 60);
  sheet.setColumnWidth(COL.강좌코드, 110);
  sheet.setColumnWidth(COL.과목명, 120);
  sheet.setColumnWidth(COL.담당교사, 90);
  sheet.setColumnWidth(COL.소속교, 130);
  sheet.setColumnWidth(COL.운영비희망여부, 80);
  sheet.setColumnWidth(COL.총소요예산, 100);

  return sheet;
}

/**
 * 행에 숫자 포맷·색상 등 서식을 적용합니다.
 * @private
 */
function applyRowFormat_(sheet, rowIndex, wantsExpense) {
  // 금액 열 숫자 포맷
  for (var i = 0; i < MAX_ITEMS; i++) {
    var amountCol = COL.항목시작 + i * 3 + 2; // 항목N_금액
    sheet.getRange(rowIndex, amountCol).setNumberFormat('#,##0');
  }
  sheet.getRange(rowIndex, COL.총소요예산).setNumberFormat('#,##0');

  // 운영비 희망 여부 셀 색상
  var wantsCell = sheet.getRange(rowIndex, COL.운영비희망여부);
  if (wantsExpense) {
    wantsCell.setBackground('#e6f0ff').setFontColor('#1e5fa8');
  } else {
    wantsCell.setBackground('#f5f5f5').setFontColor('#888888');
  }
}

/**
 * 접수상태 열에 '미접수/접수/보류' 드롭다운 유효성 검사를 설정합니다.
 * @private
 */
function applyStatusValidation_(sheet, rowIndex) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['미접수', '접수', '보류'], true)
    .setAllowInvalid(false)
    .setHelpText('미접수 / 접수 / 보류 중 선택하세요')
    .build();
  sheet.getRange(rowIndex, COL.접수상태).setDataValidation(rule);
}

/**
 * PropertiesService 기반 독립 시퀀스로 접수번호를 채번합니다.
 * getLastRow() 방식과 달리 행 삭제 시에도 번호가 중복되지 않습니다.
 * @private
 */
function getNextSeq_() {
  var props = PropertiesService.getScriptProperties();
  var current = Number(props.getProperty('submitSeq')) || 0;
  var next = current + 1;
  props.setProperty('submitSeq', String(next));
  return next;
}
