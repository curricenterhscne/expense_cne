// 강좌목록 시트 조회 (연락처 제외) — 공개 API이므로 개인정보를 절대 포함하지 않습니다

/**
 * 강좌 목록을 조회하여 반환합니다.
 * - 헤더 매칭: 공백 제거 후 부분 일치 (담당자가 '담당 교사'처럼 입력할 수 있음)
 * - 교사연락처는 응답에서 제외합니다
 * - 수강인원이 숫자 변환 불가 시 unavailable: true 와 사유를 포함합니다
 * - 각 강좌에 submitted 여부를 포함합니다
 *
 * @returns {Object} { success, courses }
 */
function getCourses() {
  // 캐시 확인 (2분) — 강좌 목록은 학기 중 거의 변하지 않음
  var cache = CacheService.getScriptCache();
  var cached = cache.get('coursesList');
  if (cached) {
    return JSON.parse(cached);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.강좌목록);
  if (!sheet) {
    throw new Error('"' + SHEET.강좌목록 + '" 시트를 찾을 수 없습니다.');
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    throw new Error('강좌 데이터가 없습니다.');
  }

  // ── 헤더 매칭 (legacy findCol 방식 계승)
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

  var CI = {
    subjectCode:    findCol(['과목코드']),
    courseCode:     findCol(['강좌코드']),
    curriculum:     findCol(['교육과정']),
    subjectName:    findCol(['과목명']),
    major:          findCol(['전공']),
    teacherName:    findCol(['담당교사', '담당 교사']),
    teacherSchool:  findCol(['교사소속교', '교사 소속교', '소속교']),
    teacherContact: findCol(['교사연락처', '교사 연락처', '연락처']),
    dayOfWeek:      findCol(['수업요일']),
    students:       findCol(['수강인원', '수강 인원']),
    extraAmount:    findCol(['추가금액', '추가 금액']),
    note:           findCol(['비고'])
  };

  if (CI.courseCode === -1) {
    throw new Error('"강좌코드" 열을 찾을 수 없습니다. 헤더를 확인해 주세요.');
  }

  // ── 신청내역에서 이미 제출된 강좌코드 목록 조회
  var submittedCodes = getSubmittedCourseCodes_();

  // ── 강좌 목록 구성 (연락처 제외!)
  var courses = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var code = String(row[CI.courseCode] || '').trim();
    if (!code) continue;

    var course = {
      subjectCode:  CI.subjectCode !== -1  ? String(row[CI.subjectCode] || '').trim()  : '',
      courseCode:   code,
      curriculum:   CI.curriculum !== -1   ? String(row[CI.curriculum] || '').trim()   : '',
      subjectName:  CI.subjectName !== -1  ? String(row[CI.subjectName] || '').trim()  : '',
      major:        CI.major !== -1        ? String(row[CI.major] || '').trim()        : '',
      teacherName:  CI.teacherName !== -1  ? String(row[CI.teacherName] || '').trim()  : '',
      teacherSchool: CI.teacherSchool !== -1 ? String(row[CI.teacherSchool] || '').trim() : '',
      // ⚠ teacherContact는 의도적으로 제외 — 공개 API이므로 연락처를 내려보내면 안 됨
      dayOfWeek:    CI.dayOfWeek !== -1    ? String(row[CI.dayOfWeek] || '').trim()    : '',
      note:         CI.note !== -1         ? String(row[CI.note] || '').trim()         : '',
      submitted:    submittedCodes[code] === true
    };

    // 수강인원: 숫자 변환 불가 시 선택 불가 처리
    if (CI.students !== -1) {
      var rawStudents = row[CI.students];
      var numStudents = Number(rawStudents);
      if (isNaN(numStudents) || String(rawStudents).trim() === '' || String(rawStudents).indexOf('#') !== -1) {
        course.students = 0;
        course.unavailable = true;
        course.unavailableReason = '수강인원 데이터 오류 (' + String(rawStudents).trim() + ')';
      } else {
        course.students = numStudents;
      }
    } else {
      course.students = 0;
      course.unavailable = true;
      course.unavailableReason = '수강인원 열을 찾을 수 없습니다';
    }

    // 추가금액 (한도 초과 허용 강좌)
    if (CI.extraAmount !== -1) {
      var rawExtra = row[CI.extraAmount];
      var numExtra = Number(rawExtra);
      course.extraAmount = (!isNaN(numExtra) && numExtra > 0) ? numExtra : 0;
    } else {
      course.extraAmount = 0;
    }

    courses.push(course);
  }

  // 캐시 저장 (2분)
  cache.put('coursesList', JSON.stringify(courses), 120);

  return courses;
}

/**
 * 신청내역 시트에서 이미 제출된 강좌코드 Set(객체)을 반환합니다.
 * @private
 * @returns {Object} { '강좌코드': true, ... }
 */
function getSubmittedCourseCodes_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.신청내역);
  var result = {};

  if (!sheet || sheet.getLastRow() < 2) return result;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var code = String(data[i][COL.강좌코드 - 1] || '').trim();
    if (code) result[code] = true;
  }

  return result;
}
