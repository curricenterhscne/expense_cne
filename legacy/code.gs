/**
 * 2026학년도 1학기 온라인 공동교육과정 수업운영비 신청 — Google Apps Script 백엔드 v2
 *
 * 【스프레드시트 구조】
 *   - 시트1: "강좌목록"  ← 강좌 데이터를 여기에 붙여넣기 (헤더 1행 포함)
 *   - 시트2: "신청내역"  ← 제출 데이터 자동 생성됨 (건드리지 않아도 됨)
 *
 * 【설치 방법】
 * 1. 스프레드시트 > 확장 프로그램 > Apps Script
 * 2. Code.gs 기존 내용 전체 삭제 후 이 코드 붙여넣기
 * 3. 저장(Ctrl+S)
 * 4. 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 계정: 나 / 액세스: 모든 사용자
 * 5. 배포 후 웹 앱 URL 복사
 * 6. HTML 파일의 CONFIG.APPS_SCRIPT_URL 에 붙여넣기
 *
 * 【강좌목록 헤더 순서 (1행)】
 *   과목코드 | 강좌코드 | 교육과정 | 과목명 | 교과서 | 학점 | 시간 |
 *   전공 | 분반 | 담당 교사 | 교사 소속교 | 교사 연락처 |
 *   수업요일 | 수강 인원 | 희망요일 | 일치 | 비고
 */

const SHEET_NAME        = "신청내역";
const COURSE_SHEET_NAME = "강좌목록";

const HEADERS = [
  "공문제출",
  "접수번호",
  "제출일시",
  "강좌코드",
  "과목코드",
  "과목명",
  "전공",
  "담당교사",
  "소속학교(예산신청교)",
  "교사연락처",
  "수업요일",
  "수강인원",
  "운영비 희망여부",
  "항목1_구분", "항목1_산출식", "항목1_금액",
  "항목2_구분", "항목2_산출식", "항목2_금액",
  "항목3_구분", "항목3_산출식", "항목3_금액",
  "항목4_구분", "항목4_산출식", "항목4_금액",
  "항목5_구분", "항목5_산출식", "항목5_금액",
  "항목6_구분", "항목6_산출식", "항목6_금액",
  "항목7_구분", "항목7_산출식", "항목7_금액",
  "항목8_구분", "항목8_산출식", "항목8_금액",
  "항목9_구분", "항목9_산출식", "항목9_금액",
  "항목10_구분", "항목10_산출식", "항목10_금액",
  "총소요예산(원)",
  "비고"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
      headerRange.setValues([HEADERS]);
      headerRange.setBackground("#0d2444");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 60);   // 공문제출
      sheet.setColumnWidth(2, 70);   // 접수번호
      sheet.setColumnWidth(3, 140);  // 제출일시
      sheet.setColumnWidth(4, 110);  // 강좌코드
      sheet.setColumnWidth(6, 120);  // 과목명
      sheet.setColumnWidth(8, 90);   // 담당교사
      sheet.setColumnWidth(9, 130);  // 소속학교
    }

    const data = JSON.parse(e.postData.contents);
    const lastRow = sheet.getLastRow();
    const seq = lastRow; // 헤더 1행이므로 데이터행 수 = lastRow-1, 새 접수번호 = lastRow

    const timestamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    const row = [
      "",        // 공문제출 (담당자가 수동으로 1 입력)
      seq,
      timestamp,
      data.courseCode     || "",
      data.subjectCode    || "",
      data.subjectName    || "",
      data.major          || "",
      data.teacherName    || "",
      data.teacherSchool  || "",
      data.teacherContact || "",
      data.dayOfWeek      || "",
      data.students       || "",
      data.wantsExpense ? "희망" : "희망하지 않음",
    ];

    const items = data.items || [];
    for (let i = 0; i < 10; i++) {
      if (items[i]) {
        row.push(items[i].category || "");
        row.push(items[i].formula  || "");
        row.push(Number(items[i].amount) || 0);
      } else {
        row.push("", "", "");
      }
    }

    row.push(data.totalAmount || 0);
    row.push(data.note || "");

    sheet.appendRow(row);

    // 금액 컬럼 숫자 포맷
    const newRowIndex = sheet.getLastRow();
    const amountCols = [];
    for (let i = 0; i < 10; i++) amountCols.push(16 + i * 3); // 항목 금액: 16,19,22,...
    amountCols.push(HEADERS.length); // 총소요예산
    amountCols.forEach(col => {
      sheet.getRange(newRowIndex, col).setNumberFormat("#,##0");
    });

    // 희망 여부에 따라 셀 색상
    const wantsCell = sheet.getRange(newRowIndex, 13);
    if (data.wantsExpense) {
      wantsCell.setBackground("#e6f0ff").setFontColor("#1e5fa8");
    } else {
      wantsCell.setBackground("#f5f5f5").setFontColor("#888888");
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, seq: seq }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ────────────────────────────────────────────────────────────
// GET 요청: 강좌 목록 반환 (?action=courses)
// ────────────────────────────────────────────────────────────
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === "courses") {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(COURSE_SHEET_NAME);

      if (!sheet) {
        return jsonResponse({ success: false, error: `"${COURSE_SHEET_NAME}" 시트를 찾을 수 없습니다.` });
      }

      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        return jsonResponse({ success: false, error: "강좌 데이터가 없습니다." });
      }

      const headers = data[0];

      function findCol(candidates) {
        for (const name of candidates) {
          const idx = headers.findIndex(h => String(h).trim().replace(/\s/g,'').includes(name.replace(/\s/g,'')));
          if (idx !== -1) return idx;
        }
        return -1;
      }

      const COL = {
        subjectCode:    findCol(['과목코드']),
        courseCode:     findCol(['강좌코드']),
        subjectName:    findCol(['과목명']),
        major:          findCol(['전공']),
        teacherName:    findCol(['담당교사','담당 교사']),
        teacherSchool:  findCol(['교사소속교','교사 소속교','소속교']),
        teacherContact: findCol(['교사연락처','교사 연락처','연락처']),
        dayOfWeek:      findCol(['수업요일']),
        students:       findCol(['수강인원','수강 인원']),
      };

      const courses = data.slice(1)
        .filter(row => row[COL.courseCode] && String(row[COL.courseCode]).trim())
        .map(row => ({
          subjectCode:    String(row[COL.subjectCode]    ?? '').trim(),
          courseCode:     String(row[COL.courseCode]     ?? '').trim(),
          subjectName:    String(row[COL.subjectName]    ?? '').trim(),
          major:          String(row[COL.major]          ?? '').trim(),
          teacherName:    String(row[COL.teacherName]    ?? '').trim(),
          teacherSchool:  String(row[COL.teacherSchool]  ?? '').trim(),
          teacherContact: String(row[COL.teacherContact] ?? '').trim(),
          dayOfWeek:      String(row[COL.dayOfWeek]      ?? '').trim(),
          students:       String(row[COL.students]       ?? '').trim(),
        }));

      return jsonResponse({ success: true, courses: courses });

    } catch (err) {
      return jsonResponse({ success: false, error: err.message });
    }
  }

  return jsonResponse({ status: "ok", message: "수업운영비 신청 서버 정상 작동 중" });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════
// 집계표 생성 함수
// Apps Script 편집기에서 직접 실행하거나,
// 스프레드시트 메뉴 "운영비 관리 > 집계표 새로고침" 으로 실행
// ════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 운영비 관리')
    .addItem('집계표 새로고침', 'buildSummarySheet')
    .addToUi();
}

function buildSummarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const srcSheet = ss.getSheetByName(SHEET_NAME);
  if (!srcSheet) {
    SpreadsheetApp.getUi().alert('"신청내역" 시트를 찾을 수 없습니다.');
    return;
  }

  // 집계 시트 초기화
  const SUMMARY_NAME = "집계표";
  let sumSheet = ss.getSheetByName(SUMMARY_NAME);
  if (sumSheet) ss.deleteSheet(sumSheet);
  sumSheet = ss.insertSheet(SUMMARY_NAME);

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

  // ── 제목 행
  sumSheet.setRowHeight(1, 30);
  const titleRange = sumSheet.getRange(1, 1, 1, 10);
  titleRange.merge();
  titleRange.setValue('2026학년도 1학기 「참학력 온라인 공동교육과정」 수업운영비 신청서(서식)');
  titleRange.setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  titleRange.setBackground('#0d2444').setFontColor('#ffffff');

  // ── 헤더 행 (2행: 상단, 3행: 운영소요예산 하위)
  // 2행
  sumSheet.setRowHeight(2, 36);
  sumSheet.setRowHeight(3, 24);

  const h = (r, c) => sumSheet.getRange(r, c);

  // 병합 헤더들
  sumSheet.getRange(2,1,2,1).merge().setValue('연번');
  sumSheet.getRange(2,2,2,1).merge().setValue('거점학교');
  sumSheet.getRange(2,3,2,1).merge().setValue('예산신청교\n(강사 소속교)');
  sumSheet.getRange(2,4,2,1).merge().setValue('강좌명');
  sumSheet.getRange(2,5,2,1).merge().setValue('지도강사명');
  sumSheet.getRange(2,6,2,1).merge().setValue('희망여부');
  sumSheet.getRange(2,7,1,3).merge().setValue('운영 소요예산');
  sumSheet.getRange(3,7,1,1).setValue('구분');
  sumSheet.getRange(3,8,1,1).setValue('산출식');
  sumSheet.getRange(3,9,1,1).setValue('금액\n(단위: 원)');
  sumSheet.getRange(2,10,2,1).merge().setValue('총 소요예산\n(단위:원)');

  // 헤더 스타일
  const headerRange = sumSheet.getRange(2, 1, 2, 10);
  headerRange.setBackground('#1a3a5c');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  headerRange.setWrap(true);
  headerRange.setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID);

  // 예산신청교 헤더 글자색 빨간색
  sumSheet.getRange(2,3).setFontColor('#ffcccc');

  sumSheet.setFrozenRows(3);

  // ── 신청내역 데이터 읽기
  const srcData = srcSheet.getDataRange().getValues();
  if (srcData.length < 2) {
    SpreadsheetApp.getUi().alert('신청 데이터가 없습니다.');
    return;
  }

  // 신청내역 컬럼 인덱스 (0-based)
  // 공문제출(0) 접수번호(1) 제출일시(2) 강좌코드(3) 과목코드(4) 과목명(5) 전공(6)
  // 담당교사(7) 소속학교(8) 연락처(9) 수업요일(10) 수강인원(11) 희망여부(12)
  // 항목1_구분(13) 항목1_산출식(14) 항목1_금액(15) ... 항목10_금액(42)
  // 총소요예산(43) 비고(44)

  let writeRow = 4; // 데이터 시작 행
  let seq = 1;

  const allRows = srcData.slice(1); // 헤더 제외
  const rows = allRows.filter(row => String(row[0]).trim() === '1'); // 공문제출=1인 행만

  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('공문제출 열이 1로 표시된 신청 내역이 없습니다.');
    ss.deleteSheet(sumSheet);
    return;
  }

  rows.forEach(row => {
    const wantsExpense = String(row[12]).trim() === '희망';
    const schoolName   = String(row[8]).trim();   // 소속학교
    const courseName   = (String(row[3]).trim() + '\n' + String(row[5]).trim()).trim();   // 강좌코드 + 과목명
    const teacherName  = String(row[7]).trim();   // 담당교사
    const wantsStr     = wantsExpense ? '희망' : '희망\n하지않음';
    const total        = row[43] || 0;

    // 항목 목록 추출
    const items = [];
    for (let i = 0; i < 10; i++) {
      const cat    = String(row[13 + i*3] || '').trim();
      const formula = String(row[14 + i*3] || '').trim();
      const amount  = row[15 + i*3];
      if (cat || formula || amount) {
        items.push({ cat, formula, amount: amount || 0 });
      }
    }

    // 희망하지 않으면 항목 1줄로
    const rowCount = (!wantsExpense || items.length === 0) ? 1 : items.length;

    // 행 높이
    for (let r = 0; r < rowCount; r++) {
      sumSheet.setRowHeight(writeRow + r, 52);
    }

    // 연번~희망여부: rowCount만큼 병합
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
    sumSheet.getRange(writeRow, 2).setValue('충남온라인학교');
    sumSheet.getRange(writeRow, 3).setValue(schoolName);
    sumSheet.getRange(writeRow, 4).setValue(courseName);
    sumSheet.getRange(writeRow, 5).setValue(teacherName);
    sumSheet.getRange(writeRow, 6).setValue(wantsStr);

    // 총소요예산
    const totalCell = sumSheet.getRange(writeRow, 10);
    totalCell.setValue(total);
    totalCell.setNumberFormat('#,##0');
    totalCell.setFontWeight('bold');
    totalCell.setFontColor('#1e5fa8');

    // 운영비 항목 입력
    if (!wantsExpense || items.length === 0) {
      // 희망 안함 — 구분~금액 빈칸
      sumSheet.getRange(writeRow, 7, 1, 3).merge().setValue('').setBackground('#f5f5f5');
    } else {
      items.forEach((item, i) => {
        const r = writeRow + i;
        sumSheet.getRange(r, 7).setValue(item.cat);
        sumSheet.getRange(r, 8).setValue(item.formula);
        const amtCell = sumSheet.getRange(r, 9);
        amtCell.setValue(item.amount);
        amtCell.setNumberFormat('#,##0');
        amtCell.setHorizontalAlignment('right');

        // 홀짝 행 배경
        const bg = i % 2 === 0 ? '#ffffff' : '#f7f5f0';
        sumSheet.getRange(r, 7, 1, 3).setBackground(bg);
      });
    }

    // ── 행 전체 스타일
    const blockRange = sumSheet.getRange(writeRow, 1, rowCount, 10);
    blockRange.setVerticalAlignment('middle');
    blockRange.setWrap(true);
    blockRange.setBorder(true, true, true, true, false, false, '#c0b898', SpreadsheetApp.BorderStyle.SOLID);

    // 블록 하단 굵은 경계선
    sumSheet.getRange(writeRow + rowCount - 1, 1, 1, 10)
      .setBorder(null, null, true, null, null, null, '#888877', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // 연번 셀 가운데
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
  const totalRow = sumSheet.getRange(writeRow, 1, 1, 10);
  totalRow.setBackground('#1a3a5c');
  totalRow.setFontColor('#ffffff');
  totalRow.setFontWeight('bold');

  sumSheet.getRange(writeRow, 1, 1, 9).merge().setValue('※ 작성시 참고사항: 운영비는 수업 교사(강사) 소속교로 교부 / 수강인원 × 20,000원 한도 / 실험실습 재료 초과 시 담당장학사 041-640-7221 문의');
  sumSheet.getRange(writeRow, 1, 1, 9).setFontSize(9).setHorizontalAlignment('left').setWrap(true);

  // 총합계
  const grandTotal = rows.reduce((s, r) => s + (Number(r[43]) || 0), 0);
  const grandCell = sumSheet.getRange(writeRow, 10);
  grandCell.setValue(grandTotal);
  grandCell.setNumberFormat('#,##0');
  grandCell.setFontColor('#e8c96a');
  grandCell.setHorizontalAlignment('right');

  // 완료 메시지
  SpreadsheetApp.getUi().alert(`✅ 집계표 생성 완료\n총 ${rows.length}개 강좌, 합계 ${grandTotal.toLocaleString()}원`);
  ss.setActiveSheet(sumSheet);
}

// ════════════════════════════════════════════════════════════
// 디버그 함수 — 합계 불일치 원인 찾기
// Apps Script 편집기에서 debugSummaryTotal 선택 후 실행
// 실행 로그(Ctrl+Enter)에서 결과 확인
// ════════════════════════════════════════════════════════════
function debugSummaryTotal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const srcSheet = ss.getSheetByName(SHEET_NAME);
  const srcData = srcSheet.getDataRange().getValues();

  const allRows = srcData.slice(1);
  const filteredRows = allRows.filter(row => String(row[0]).trim() === '1');

  Logger.log(`전체 행 수: ${allRows.length}`);
  Logger.log(`공문제출=1 행 수: ${filteredRows.length}`);

  let grandTotal = 0;
  let issues = [];

  filteredRows.forEach((row, idx) => {
    const courseCode   = String(row[3]).trim();
    const teacherName  = String(row[7]).trim();
    const wantsExpense = String(row[12]).trim() === '희망';
    const totalCol     = Number(row[43]) || 0;  // 총소요예산 열

    // 항목 금액 직접 합산
    let itemSum = 0;
    for (let i = 0; i < 10; i++) {
      itemSum += Number(row[15 + i*3]) || 0;
    }

    grandTotal += totalCol;

    // 총소요예산 열 값과 항목 합산이 다른 경우
    if (totalCol !== itemSum && wantsExpense) {
      issues.push(`행${idx+2} [${courseCode}/${teacherName}]: 총소요예산열=${totalCol.toLocaleString()} / 항목합산=${itemSum.toLocaleString()} → 차이=${(totalCol-itemSum).toLocaleString()}`);
    }

    Logger.log(`행${idx+2} | ${courseCode} | ${teacherName} | 희망:${wantsExpense} | 총액열:${totalCol.toLocaleString()} | 항목합:${itemSum.toLocaleString()}`);
  });

  Logger.log(`\n=== 총합계(총소요예산 열 기준): ${grandTotal.toLocaleString()}원 ===`);

  if (issues.length > 0) {
    Logger.log(`\n⚠ 불일치 항목:`);
    issues.forEach(i => Logger.log(i));
  } else {
    Logger.log(`\n✅ 모든 행의 총소요예산 열 = 항목 합산 일치`);
  }
}
