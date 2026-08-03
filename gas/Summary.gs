// 집계표·미제출 목록 시트 생성

/**
 * 집계표를 생성합니다.
 * - 신청내역에서 접수상태 === '접수' 인 건만 필터링
 * - 제목·거점학교명은 설정 시트에서 읽음
 * - 병합셀 구조·색상·행 높이는 legacy/code.gs 서식 그대로 유지
 *   (공문 첨부용으로 확정된 서식이므로 임의 변경 금지)
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

  // ── 컬럼 너비 설정
  sumSheet.setColumnWidth(1, 45);   // 연번
  sumSheet.setColumnWidth(2, 110);  // 거점학교
  sumSheet.setColumnWidth(3, 120);  // 예산신청교
  sumSheet.setColumnWidth(4, 110);  // 강좌명
  sumSheet.setColumnWidth(5, 80);   // 지도강사명
  sumSheet.setColumnWidth(6, 65);   // 희망여부
  sumSheet.setColumnWidth(7, 130);  // 구분
  sumSheet.setColumnWidth(8, 230);  // 산출식
  sumSheet.setColumnWidth(9, 90);   // 금액
  sumSheet.setColumnWidth(10, 90);  // 총소요예산

  // ── 제목 행 (설정 시트 값 사용)
  sumSheet.setRowHeight(1, 30);
  var titleText = config['학기명'] + ' 「' + config['과정명'] + '」 수업운영비 신청서(서식)';
  var titleRange = sumSheet.getRange(1, 1, 1, 10);
  titleRange.merge();
  titleRange.setValue(titleText);
  titleRange.setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  titleRange.setBackground('#0d2444').setFontColor('#ffffff');

  // ── 헤더 행 (2행: 상단, 3행: 운영소요예산 하위)
  sumSheet.setRowHeight(2, 36);
  sumSheet.setRowHeight(3, 24);

  // 병합 헤더들
  sumSheet.getRange(2, 1, 2, 1).merge().setValue('연번');
  sumSheet.getRange(2, 2, 2, 1).merge().setValue('거점학교');
  sumSheet.getRange(2, 3, 2, 1).merge().setValue('예산신청교\n(강사 소속교)');
  sumSheet.getRange(2, 4, 2, 1).merge().setValue('강좌명');
  sumSheet.getRange(2, 5, 2, 1).merge().setValue('지도강사명');
  sumSheet.getRange(2, 6, 2, 1).merge().setValue('희망여부');
  sumSheet.getRange(2, 7, 1, 3).merge().setValue('운영 소요예산');
  sumSheet.getRange(3, 7, 1, 1).setValue('구분');
  sumSheet.getRange(3, 8, 1, 1).setValue('산출식');
  sumSheet.getRange(3, 9, 1, 1).setValue('금액\n(단위: 원)');
  sumSheet.getRange(2, 10, 2, 1).merge().setValue('총 소요예산\n(단위:원)');

  // 헤더 스타일
  var headerRange = sumSheet.getRange(2, 1, 2, 10);
  headerRange.setBackground('#1a3a5c');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  headerRange.setWrap(true);
  headerRange.setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID);

  // 예산신청교 헤더 글자색 연빨간색
  sumSheet.getRange(2, 3).setFontColor('#ffcccc');

  sumSheet.setFrozenRows(3);

  // ── 신청내역 데이터 읽기
  var srcData = srcSheet.getDataRange().getValues();
  if (srcData.length < 2) {
    SpreadsheetApp.getUi().alert('신청 데이터가 없습니다.');
    return;
  }

  // 접수상태 === '접수' 인 행만 필터링 (0-based 인덱스: COL.접수상태 - 1)
  var allRows = srcData.slice(1);
  var rows = allRows.filter(function(row) {
    return String(row[COL.접수상태 - 1]).trim() === '접수';
  });

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('접수상태가 "접수"인 신청 내역이 없습니다.');
    ss.deleteSheet(sumSheet);
    return;
  }

  var writeRow = 4; // 데이터 시작 행
  var seq = 1;
  var hubSchool = config['거점학교명'] || '충남온라인학교';

  rows.forEach(function(row) {
    var wantsExpense = String(row[COL.운영비희망여부 - 1]).trim() === '희망';
    var schoolName = String(row[COL.소속교 - 1]).trim();
    var courseName = (String(row[COL.강좌코드 - 1]).trim() + '\n' +
                      String(row[COL.과목명 - 1]).trim()).trim();
    var teacherName = String(row[COL.담당교사 - 1]).trim();
    var wantsStr = wantsExpense ? '희망' : '희망\n하지않음';
    var total = row[COL.총소요예산 - 1] || 0;

    // 항목 목록 추출
    var items = [];
    for (var i = 0; i < MAX_ITEMS; i++) {
      var baseCol = COL.항목시작 - 1 + i * 3; // 0-based
      var cat = String(row[baseCol] || '').trim();
      var formula = String(row[baseCol + 1] || '').trim();
      var amount = row[baseCol + 2];
      if (cat || formula || amount) {
        items.push({ cat: cat, formula: formula, amount: amount || 0 });
      }
    }

    // 희망하지 않으면 항목 1줄로
    var rowCount = (!wantsExpense || items.length === 0) ? 1 : items.length;

    // 행 높이
    for (var r = 0; r < rowCount; r++) {
      sumSheet.setRowHeight(writeRow + r, 52);
    }

    // 연번~희망여부, 총소요예산: rowCount만큼 병합
    if (rowCount > 1) {
      sumSheet.getRange(writeRow, 1, rowCount, 1).merge();
      sumSheet.getRange(writeRow, 2, rowCount, 1).merge();
      sumSheet.getRange(writeRow, 3, rowCount, 1).merge();
      sumSheet.getRange(writeRow, 4, rowCount, 1).merge();
      sumSheet.getRange(writeRow, 5, rowCount, 1).merge();
      sumSheet.getRange(writeRow, 6, rowCount, 1).merge();
      sumSheet.getRange(writeRow, 10, rowCount, 1).merge();
    }

    // 공통 정보 입력
    sumSheet.getRange(writeRow, 1).setValue(seq);
    sumSheet.getRange(writeRow, 2).setValue(hubSchool);
    sumSheet.getRange(writeRow, 3).setValue(schoolName);
    sumSheet.getRange(writeRow, 4).setValue(courseName);
    sumSheet.getRange(writeRow, 5).setValue(teacherName);
    sumSheet.getRange(writeRow, 6).setValue(wantsStr);

    // 총소요예산
    var totalCell = sumSheet.getRange(writeRow, 10);
    totalCell.setValue(total);
    totalCell.setNumberFormat('#,##0');
    totalCell.setFontWeight('bold');
    totalCell.setFontColor('#1e5fa8');

    // 운영비 항목 입력
    if (!wantsExpense || items.length === 0) {
      // 희망 안 함 — 구분~금액 빈칸
      sumSheet.getRange(writeRow, 7, 1, 3).merge().setValue('').setBackground('#f5f5f5');
    } else {
      items.forEach(function(item, i) {
        var r = writeRow + i;
        sumSheet.getRange(r, 7).setValue(item.cat);
        sumSheet.getRange(r, 8).setValue(item.formula);
        var amtCell = sumSheet.getRange(r, 9);
        amtCell.setValue(item.amount);
        amtCell.setNumberFormat('#,##0');
        amtCell.setHorizontalAlignment('right');

        // 홀짝 행 배경
        var bg = i % 2 === 0 ? '#ffffff' : '#f7f5f0';
        sumSheet.getRange(r, 7, 1, 3).setBackground(bg);
      });
    }

    // ── 행 전체 스타일
    var blockRange = sumSheet.getRange(writeRow, 1, rowCount, 10);
    blockRange.setVerticalAlignment('middle');
    blockRange.setWrap(true);
    blockRange.setBorder(true, true, true, true, false, false,
      '#c0b898', SpreadsheetApp.BorderStyle.SOLID);

    // 블록 하단 굵은 경계선
    sumSheet.getRange(writeRow + rowCount - 1, 1, 1, 10)
      .setBorder(null, null, true, null, null, null,
        '#888877', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // 정렬
    sumSheet.getRange(writeRow, 1, rowCount, 1).setHorizontalAlignment('center');
    sumSheet.getRange(writeRow, 2, rowCount, 2).setHorizontalAlignment('center');
    sumSheet.getRange(writeRow, 5, rowCount, 2).setHorizontalAlignment('center');
    sumSheet.getRange(writeRow, 10, rowCount, 1).setHorizontalAlignment('right');

    // 예산신청교 노란 배경
    sumSheet.getRange(writeRow, 3, rowCount, 1).setBackground('#ffff99');

    writeRow += rowCount;
    seq++;
  });

  // ── 합계 행
  sumSheet.setRowHeight(writeRow, 30);
  var totalRow = sumSheet.getRange(writeRow, 1, 1, 10);
  totalRow.setBackground('#1a3a5c');
  totalRow.setFontColor('#ffffff');
  totalRow.setFontWeight('bold');

  // 안내문구 — 설정 시트 값 사용
  var unitPrice = config['인당단가'] || 20000;
  var footNote = '※ 작성시 참고사항: 운영비는 수업 교사(강사) 소속교로 교부 / 수강인원 × ' +
    unitPrice.toLocaleString() + '원 한도 / 실험실습 재료 초과 시 담당장학사 041-640-7221 문의';
  sumSheet.getRange(writeRow, 1, 1, 9).merge().setValue(footNote);
  sumSheet.getRange(writeRow, 1, 1, 9).setFontSize(9)
    .setHorizontalAlignment('left').setWrap(true);

  // 총합계
  var grandTotal = rows.reduce(function(s, r) {
    return s + (Number(r[COL.총소요예산 - 1]) || 0);
  }, 0);
  var grandCell = sumSheet.getRange(writeRow, 10);
  grandCell.setValue(grandTotal);
  grandCell.setNumberFormat('#,##0');
  grandCell.setFontColor('#e8c96a');
  grandCell.setHorizontalAlignment('right');

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
  var submitMap = {}; // { courseCode: { status, ... } }
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
  var notSubmitted = []; // 미제출 — 신청 자체가 없음
  var notAccepted = [];  // 공문 미접수 — 제출됐으나 접수 아님
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

  // 열 너비
  pendSheet.setColumnWidth(1, 120);  // 강좌코드
  pendSheet.setColumnWidth(2, 150);  // 과목명
  pendSheet.setColumnWidth(3, 90);   // 담당교사
  pendSheet.setColumnWidth(4, 140);  // 소속교
  pendSheet.setColumnWidth(5, 130);  // 연락처

  // ── 요약 헤더 (1행)
  var summaryText = '전체 ' + totalCourses + '개 / 제출 ' + submittedCount +
    '개 / 접수완료 ' + acceptedCount + '개';
  var summaryRange = pendSheet.getRange(1, 1, 1, 5);
  summaryRange.merge().setValue(summaryText);
  summaryRange.setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  summaryRange.setBackground('#0d2444').setFontColor('#ffffff');
  pendSheet.setRowHeight(1, 32);

  var writeRow = 3;

  // ── 구역 1: 미제출
  writeRow = writePendingSection_(pendSheet, writeRow, '미제출 (' + notSubmitted.length + '건)',
    '온라인 신청 자체가 없는 강좌', notSubmitted);

  // 구역 간 빈 행
  writeRow++;

  // ── 구역 2: 공문 미접수
  writeRow = writePendingSection_(pendSheet, writeRow, '공문 미접수 (' + notAccepted.length + '건)',
    '온라인 제출은 됐으나 접수상태가 "접수"가 아닌 건', notAccepted);

  pendSheet.setFrozenRows(0);

  // 완료 메시지
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
 * @private
 * @param {Sheet} sheet - 대상 시트
 * @param {number} startRow - 시작 행
 * @param {string} sectionTitle - 구역 제목
 * @param {string} sectionDesc - 구역 설명
 * @param {Array} dataList - 데이터 배열
 * @returns {number} 다음 쓰기 행
 */
function writePendingSection_(sheet, startRow, sectionTitle, sectionDesc, dataList) {
  // 구역 제목
  var titleRange = sheet.getRange(startRow, 1, 1, 5);
  titleRange.merge().setValue(sectionTitle + ' — ' + sectionDesc);
  titleRange.setFontWeight('bold').setFontSize(10);
  titleRange.setBackground('#1a3a5c').setFontColor('#ffffff');
  sheet.setRowHeight(startRow, 28);
  startRow++;

  if (dataList.length === 0) {
    sheet.getRange(startRow, 1, 1, 5).merge().setValue('해당 없음');
    sheet.getRange(startRow, 1).setHorizontalAlignment('center')
      .setFontColor('#888888');
    return startRow + 1;
  }

  // 헤더
  var headers = ['강좌코드', '과목명', '담당교사', '소속교', '연락처'];
  var headerRow = sheet.getRange(startRow, 1, 1, 5);
  headerRow.setValues([headers]);
  headerRow.setFontWeight('bold').setBackground('#e8e0d0').setFontColor('#1a3a5c');
  headerRow.setHorizontalAlignment('center');
  startRow++;

  // 데이터
  var values = dataList.map(function(d) {
    return [d.강좌코드, d.과목명, d.담당교사, d.소속교, d.연락처];
  });
  sheet.getRange(startRow, 1, values.length, 5).setValues(values);

  // 교차 배경색
  for (var i = 0; i < values.length; i++) {
    if (i % 2 === 1) {
      sheet.getRange(startRow + i, 1, 1, 5).setBackground('#f7f5f0');
    }
  }

  // 테두리
  sheet.getRange(startRow - 1, 1, values.length + 1, 5)
    .setBorder(true, true, true, true, true, true,
      '#c0b898', SpreadsheetApp.BorderStyle.SOLID);

  return startRow + values.length;
}
