// 집계표·미제출 목록 시트 생성

/**
 * 집계표를 생성합니다.
 * - 신청내역에서 접수상태 === '접수' 인 건만 필터링
 * - 제목·거점학교명은 설정 시트에서 읽음
 * - 병합셀 구조·색상·행 높이는 legacy/code.gs 서식 그대로 유지
 *   (공문 첨부용으로 확정된 서식이므로 임의 변경 금지)
 *
 * ★ 성능 최적화: 값 배열을 메모리에서 조립 → setValues() 1회로 쓰고,
 *   서식은 범위 단위 일괄 적용 (개별 셀 호출 최소화)
 */
function buildSummarySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var srcSheet = ss.getSheetByName(SHEET.신청내역);
  if (!srcSheet) {
    SpreadsheetApp.getUi().alert('"' + SHEET.신청내역 + '" 시트를 찾을 수 없습니다.');
    return;
  }

  var config = getConfig();

  // 집계 시트 초기화
  var sumSheet = ss.getSheetByName(SHEET.집계표);
  if (sumSheet) ss.deleteSheet(sumSheet);
  sumSheet = ss.insertSheet(SHEET.집계표);

  // ── 신청내역 데이터 읽기
  var srcData = srcSheet.getDataRange().getValues();
  if (srcData.length < 2) {
    SpreadsheetApp.getUi().alert('신청 데이터가 없습니다.');
    return;
  }

  // 접수상태 === '접수' 인 행만 필터링
  var rows = srcData.slice(1).filter(function(row) {
    return String(row[COL.접수상태 - 1]).trim() === '접수';
  });

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('접수상태가 "접수"인 신청 내역이 없습니다.');
    ss.deleteSheet(sumSheet);
    return;
  }

  // ── 1단계: 메모리에서 전체 데이터 조립
  var hubSchool = config['거점학교명'] || '충남온라인학교';
  var allValues = [];   // 2D 배열 (데이터 영역 전체)
  var merges = [];       // { row, col, rowSpan, colSpan } — 0-based from data start
  var itemRowBgs = [];   // { row, bg } — 항목 홀짝 배경
  var noExpenseRows = []; // 희망안함 행 (구분~금액 병합+회색)
  var totalAmounts = [];  // { row, amount } — 총소요예산 값
  var blockBorders = [];  // 블록 하단 굵은 선 행
  var schoolRows = [];    // 예산신청교 노란 배경
  var rowHeights = [];    // { row, height }

  var seq = 1;
  var grandTotal = 0;

  rows.forEach(function(row) {
    var wantsExpense = String(row[COL.운영비희망여부 - 1]).trim() === '희망';
    var schoolName = String(row[COL.소속교 - 1]).trim();
    var courseName = (String(row[COL.강좌코드 - 1]).trim() + '\n' +
                      String(row[COL.과목명 - 1]).trim()).trim();
    var teacherName = String(row[COL.담당교사 - 1]).trim();
    var wantsStr = wantsExpense ? '희망' : '희망\n하지않음';
    var total = Number(row[COL.총소요예산 - 1]) || 0;
    grandTotal += total;

    // 항목 추출
    var items = [];
    for (var i = 0; i < MAX_ITEMS; i++) {
      var baseCol = COL.항목시작 - 1 + i * 3;
      var cat = String(row[baseCol] || '').trim();
      var formula = String(row[baseCol + 1] || '').trim();
      var amount = row[baseCol + 2];
      if (cat || formula || amount) {
        items.push({ cat: cat, formula: formula, amount: amount || 0 });
      }
    }

    var rowCount = (!wantsExpense || items.length === 0) ? 1 : items.length;
    var startIdx = allValues.length; // 현재 데이터 배열 내 인덱스

    // 행 높이 기록
    for (var r = 0; r < rowCount; r++) {
      rowHeights.push({ row: startIdx + r, height: 52 });
    }

    // 첫 행에 공통 정보, 나머지 행은 빈칸 (병합될 영역)
    if (!wantsExpense || items.length === 0) {
      allValues.push([seq, hubSchool, schoolName, courseName, teacherName, wantsStr, '', '', '', total]);
      noExpenseRows.push(startIdx);
    } else {
      for (var j = 0; j < items.length; j++) {
        allValues.push([
          j === 0 ? seq : '',
          j === 0 ? hubSchool : '',
          j === 0 ? schoolName : '',
          j === 0 ? courseName : '',
          j === 0 ? teacherName : '',
          j === 0 ? wantsStr : '',
          items[j].cat,
          items[j].formula,
          items[j].amount,
          j === 0 ? total : ''
        ]);
        // 항목 홀짝 배경
        itemRowBgs.push({ row: startIdx + j, bg: j % 2 === 0 ? '#ffffff' : '#f7f5f0' });
      }
    }

    // 병합 정보 (rowCount > 1일 때)
    if (rowCount > 1) {
      [0, 1, 2, 3, 4, 5, 9].forEach(function(col) { // 연번~희망여부 + 총소요예산
        merges.push({ row: startIdx, col: col, rowSpan: rowCount, colSpan: 1 });
      });
    }

    // 총소요예산 위치
    totalAmounts.push({ row: startIdx, amount: total });

    // 예산신청교 노란 배경
    for (var k = 0; k < rowCount; k++) {
      schoolRows.push(startIdx + k);
    }

    // 블록 하단 경계선
    blockBorders.push(startIdx + rowCount - 1);

    seq++;
  });

  // ── 2단계: 시트 구조 설정 (열 너비, 헤더)
  var colWidths = [45, 110, 120, 110, 80, 65, 130, 230, 90, 90];
  for (var w = 0; w < colWidths.length; w++) {
    sumSheet.setColumnWidth(w + 1, colWidths[w]);
  }

  // 제목 행 (1행)
  sumSheet.setRowHeight(1, 30);
  var titleText = config['학기명'] + ' 「' + config['과정명'] + '」 수업운영비 신청서(서식)';
  var titleRange = sumSheet.getRange(1, 1, 1, 10);
  titleRange.merge().setValue(titleText);
  titleRange.setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setBackground('#0d2444').setFontColor('#ffffff');

  // 헤더 (2~3행)
  sumSheet.setRowHeight(2, 36);
  sumSheet.setRowHeight(3, 24);

  var headerValues = [
    ['연번', '거점학교', '예산신청교\n(강사 소속교)', '강좌명', '지도강사명', '희망여부', '운영 소요예산', '', '', '총 소요예산\n(단위:원)'],
    ['', '', '', '', '', '', '구분', '산출식', '금액\n(단위: 원)', '']
  ];
  sumSheet.getRange(2, 1, 2, 10).setValues(headerValues);

  // 헤더 병합
  [[2,1,2,1],[2,2,2,1],[2,3,2,1],[2,4,2,1],[2,5,2,1],[2,6,2,1],[2,7,1,3],[2,10,2,1]].forEach(function(m) {
    sumSheet.getRange(m[0], m[1], m[2], m[3]).merge();
  });

  // 헤더 스타일
  var headerRange = sumSheet.getRange(2, 1, 2, 10);
  headerRange.setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID);
  sumSheet.getRange(2, 3).setFontColor('#ffcccc');
  sumSheet.setFrozenRows(3);

  // ── 3단계: 데이터 일괄 쓰기
  var dataStartRow = 4;
  if (allValues.length > 0) {
    sumSheet.getRange(dataStartRow, 1, allValues.length, 10).setValues(allValues);
  }

  // ── 4단계: 서식 일괄 적용

  // 행 높이
  rowHeights.forEach(function(rh) {
    sumSheet.setRowHeight(dataStartRow + rh.row, rh.height);
  });

  // 전체 데이터 영역 기본 스타일
  var dataRange = sumSheet.getRange(dataStartRow, 1, allValues.length, 10);
  dataRange.setVerticalAlignment('middle').setWrap(true);

  // 정렬: 연번(중앙), 거점학교~예산신청교(중앙), 지도강사~희망(중앙), 총소요예산(오른쪽)
  sumSheet.getRange(dataStartRow, 1, allValues.length, 1).setHorizontalAlignment('center');
  sumSheet.getRange(dataStartRow, 2, allValues.length, 2).setHorizontalAlignment('center');
  sumSheet.getRange(dataStartRow, 5, allValues.length, 2).setHorizontalAlignment('center');
  sumSheet.getRange(dataStartRow, 9, allValues.length, 1).setHorizontalAlignment('right');
  sumSheet.getRange(dataStartRow, 10, allValues.length, 1).setHorizontalAlignment('right');

  // 금액 서식
  sumSheet.getRange(dataStartRow, 9, allValues.length, 2).setNumberFormat('#,##0');

  // 병합 처리
  merges.forEach(function(m) {
    sumSheet.getRange(dataStartRow + m.row, m.col + 1, m.rowSpan, m.colSpan).merge();
  });

  // 희망안함 행: 구분~금액 병합 + 회색 배경
  noExpenseRows.forEach(function(idx) {
    sumSheet.getRange(dataStartRow + idx, 7, 1, 3).merge().setBackground('#f5f5f5');
  });

  // 항목 홀짝 배경
  itemRowBgs.forEach(function(rb) {
    sumSheet.getRange(dataStartRow + rb.row, 7, 1, 3).setBackground(rb.bg);
  });

  // 총소요예산 스타일
  totalAmounts.forEach(function(ta) {
    sumSheet.getRange(dataStartRow + ta.row, 10).setFontWeight('bold').setFontColor('#1e5fa8');
  });

  // 예산신청교 노란 배경
  schoolRows.forEach(function(idx) {
    sumSheet.getRange(dataStartRow + idx, 3).setBackground('#ffff99');
  });

  // 블록 하단 굵은 경계선
  blockBorders.forEach(function(idx) {
    sumSheet.getRange(dataStartRow + idx, 1, 1, 10)
      .setBorder(null, null, true, null, null, null,
        '#888877', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  // 전체 테두리 (블록 단위 대신 전체에 적용)
  dataRange.setBorder(true, true, true, true, true, true,
    '#c0b898', SpreadsheetApp.BorderStyle.SOLID);

  // ── 합계 행
  var totalRow = dataStartRow + allValues.length;
  sumSheet.setRowHeight(totalRow, 30);
  var totalRowRange = sumSheet.getRange(totalRow, 1, 1, 10);
  totalRowRange.setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');

  var unitPrice = config['인당단가'] || 20000;
  var footNote = '※ 작성시 참고사항: 운영비는 수업 교사(강사) 소속교로 교부 / 수강인원 × ' +
    unitPrice.toLocaleString() + '원 한도 / 실험실습 재료 초과 시 담당장학사 041-640-7221 문의';
  sumSheet.getRange(totalRow, 1, 1, 9).merge().setValue(footNote);
  sumSheet.getRange(totalRow, 1).setFontSize(9).setHorizontalAlignment('left').setWrap(true);

  var grandCell = sumSheet.getRange(totalRow, 10);
  grandCell.setValue(grandTotal).setNumberFormat('#,##0')
    .setFontColor('#e8c96a').setHorizontalAlignment('right');

  // 완료 메시지
  SpreadsheetApp.getUi().alert(
    '✅ 집계표 생성 완료\n총 ' + rows.length + '개 강좌, 합계 ' +
    grandTotal.toLocaleString() + '원'
  );
  ss.setActiveSheet(sumSheet);
}

// ────────────────────────────────────────────────────────────
// 미제출 목록
// ────────────────────────────────────────────────────────────

/**
 * 강좌목록과 신청내역을 대조해 '미제출' 시트를 만듭니다.
 * - 미제출: 온라인 신청 자체가 없는 강좌
 * - 공문 미접수: 온라인 제출은 됐으나 접수상태가 '접수'가 아닌 건
 * - 담당자가 독촉 연락에 쓰는 시트이므로 연락처 포함
 */
function buildPendingSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var courseSheet = ss.getSheetByName(SHEET.강좌목록);
  var submitSheet = ss.getSheetByName(SHEET.신청내역);

  if (!courseSheet) {
    SpreadsheetApp.getUi().alert('"' + SHEET.강좌목록 + '" 시트를 찾을 수 없습니다.');
    return;
  }

  // ── 강좌목록 읽기
  var courseData = courseSheet.getDataRange().getValues();
  if (courseData.length < 2) {
    SpreadsheetApp.getUi().alert('강좌목록이 비어 있습니다.');
    return;
  }

  var courseHeaders = courseData[0];
  function findCol(candidates) {
    for (var c = 0; c < candidates.length; c++) {
      var target = candidates[c].replace(/\s/g, '');
      for (var i = 0; i < courseHeaders.length; i++) {
        if (String(courseHeaders[i]).trim().replace(/\s/g, '').indexOf(target) !== -1) {
          return i;
        }
      }
    }
    return -1;
  }

  var ci = {
    강좌코드: findCol(['강좌코드']),
    과목명:   findCol(['과목명']),
    담당교사: findCol(['담당교사', '담당 교사']),
    소속교:   findCol(['소속교', '교사소속교', '교사 소속교']),
    연락처:   findCol(['연락처', '교사연락처', '교사 연락처'])
  };

  // ── 신청내역 읽기 — 강좌코드별 접수상태 맵
  var submitMap = {};
  if (submitSheet) {
    var submitData = submitSheet.getDataRange().getValues();
    for (var s = 1; s < submitData.length; s++) {
      var code = String(submitData[s][COL.강좌코드 - 1] || '').trim();
      if (code) {
        submitMap[code] = {
          status: String(submitData[s][COL.접수상태 - 1] || '').trim()
        };
      }
    }
  }

  // ── 분류
  var notSubmitted = [];
  var notAccepted = [];
  var totalCourses = courseData.length - 1;
  var submittedCount = 0;
  var acceptedCount = 0;

  for (var r = 1; r < courseData.length; r++) {
    var row = courseData[r];
    var courseCode = ci.강좌코드 !== -1 ? String(row[ci.강좌코드] || '').trim() : '';
    if (!courseCode) continue;

    var info = {
      강좌코드: courseCode,
      과목명:   ci.과목명 !== -1 ? String(row[ci.과목명] || '').trim() : '',
      담당교사: ci.담당교사 !== -1 ? String(row[ci.담당교사] || '').trim() : '',
      소속교:   ci.소속교 !== -1 ? String(row[ci.소속교] || '').trim() : '',
      연락처:   ci.연락처 !== -1 ? String(row[ci.연락처] || '').trim() : ''
    };

    var submitted = submitMap[courseCode];
    if (!submitted) {
      notSubmitted.push(info);
    } else {
      submittedCount++;
      if (submitted.status === '접수') {
        acceptedCount++;
      } else {
        notAccepted.push(info);
      }
    }
  }

  // ── 시트 초기화
  var pendSheet = ss.getSheetByName(SHEET.미제출);
  if (pendSheet) ss.deleteSheet(pendSheet);
  pendSheet = ss.insertSheet(SHEET.미제출);

  var colWidths = [120, 150, 90, 140, 130];
  for (var w = 0; w < colWidths.length; w++) {
    pendSheet.setColumnWidth(w + 1, colWidths[w]);
  }

  // 요약 헤더 (1행)
  var summaryText = '전체 ' + totalCourses + '개 / 제출 ' + submittedCount +
    '개 / 접수완료 ' + acceptedCount + '개';
  var summaryRange = pendSheet.getRange(1, 1, 1, 5);
  summaryRange.merge().setValue(summaryText);
  summaryRange.setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  summaryRange.setBackground('#0d2444').setFontColor('#ffffff');
  pendSheet.setRowHeight(1, 32);

  var writeRow = 3;
  writeRow = writePendingSection_(pendSheet, writeRow, '미제출 (' + notSubmitted.length + '건)',
    '온라인 신청 자체가 없는 강좌', notSubmitted);
  writeRow++;
  writeRow = writePendingSection_(pendSheet, writeRow, '공문 미접수 (' + notAccepted.length + '건)',
    '온라인 제출은 됐으나 접수상태가 "접수"가 아닌 건', notAccepted);

  pendSheet.setFrozenRows(0);

  SpreadsheetApp.getUi().alert(
    '✅ 미제출 목록 생성 완료\n\n' +
    '전체: ' + totalCourses + '개\n' +
    '미제출: ' + notSubmitted.length + '개\n' +
    '공문 미접수: ' + notAccepted.length + '개\n' +
    '접수 완료: ' + acceptedCount + '개'
  );
  ss.setActiveSheet(pendSheet);
}

/**
 * 미제출 시트에 구역(제목 + 헤더 + 데이터)을 작성합니다.
 * ★ 데이터를 setValues() 1회로 일괄 쓰기
 * @private
 */
function writePendingSection_(sheet, startRow, sectionTitle, sectionDesc, dataList) {
  // 구역 제목
  var titleRange = sheet.getRange(startRow, 1, 1, 5);
  titleRange.merge().setValue(sectionTitle + ' — ' + sectionDesc);
  titleRange.setFontWeight('bold').setFontSize(10)
    .setBackground('#1a3a5c').setFontColor('#ffffff');
  sheet.setRowHeight(startRow, 28);
  startRow++;

  if (dataList.length === 0) {
    sheet.getRange(startRow, 1, 1, 5).merge().setValue('해당 없음');
    sheet.getRange(startRow, 1).setHorizontalAlignment('center').setFontColor('#888888');
    return startRow + 1;
  }

  // 헤더
  var headers = ['강좌코드', '과목명', '담당교사', '소속교', '연락처'];
  sheet.getRange(startRow, 1, 1, 5).setValues([headers])
    .setFontWeight('bold').setBackground('#e8e0d0').setFontColor('#1a3a5c')
    .setHorizontalAlignment('center');
  startRow++;

  // 데이터 일괄 쓰기
  var values = dataList.map(function(d) {
    return [d.강좌코드, d.과목명, d.담당교사, d.소속교, d.연락처];
  });
  var dataRange = sheet.getRange(startRow, 1, values.length, 5);
  dataRange.setValues(values);

  // 교차 배경색 — 홀수 행만 한 번에
  for (var i = 1; i < values.length; i += 2) {
    sheet.getRange(startRow + i, 1, 1, 5).setBackground('#f7f5f0');
  }

  // 테두리 (헤더 포함 범위)
  sheet.getRange(startRow - 1, 1, values.length + 1, 5)
    .setBorder(true, true, true, true, true, true,
      '#c0b898', SpreadsheetApp.BorderStyle.SOLID);

  return startRow + values.length;
}
