// 연락처 뒷 4자리 검증 및 시도 횟수 잠금
// 대조는 서버에서만 수행합니다. 클라이언트로 연락처를 내려보내면 인증이 무의미합니다.

var AUTH_MAX_ATTEMPTS = 5;     // 최대 시도 횟수
var AUTH_LOCK_SECONDS = 600;   // 잠금 시간 (10분)
var TOKEN_TTL_SECONDS = 1800;  // 토큰 유효시간 (30분)

/**
 * 교사 본인 확인 — 강좌코드 + 연락처 뒤 4자리
 *
 * @param {string} courseCode - 강좌코드
 * @param {string} last4 - 연락처 뒤 4자리
 * @returns {Object} 성공 시 { success, token, existing }, 실패 시 { success, error, remaining, locked, lockRemaining }
 */
function verifyTeacher(courseCode, last4) {
  courseCode = String(courseCode || '').trim();
  last4 = String(last4 || '').trim();

  if (!courseCode) throw new Error('강좌코드가 없습니다.');
  if (!last4 || last4.length !== 4) throw new Error('연락처 뒤 4자리를 정확히 입력해 주세요.');

  var cache = CacheService.getScriptCache();
  var lockKey = 'authLock_' + courseCode;
  var failKey = 'authFail_' + courseCode;

  // ── 잠금 확인
  var lockUntil = cache.get(lockKey);
  if (lockUntil) {
    var remainSec = Math.max(0, Math.ceil((Number(lockUntil) - Date.now()) / 1000));
    if (remainSec > 0) {
      return {
        success: false,
        error: '입력 횟수를 초과했습니다. ' + Math.ceil(remainSec / 60) + '분 후에 다시 시도해 주세요.',
        locked: true,
        lockRemaining: remainSec
      };
    }
    // 잠금 만료됨 — 초기화
    cache.remove(lockKey);
    cache.remove(failKey);
  }

  // ── 강좌목록에서 연락처 조회
  var contact = getTeacherContact_(courseCode);
  if (contact === null) {
    throw new Error('강좌목록에서 해당 강좌를 찾을 수 없습니다.');
  }

  // ── 숫자만 추출하여 뒤 4자리 비교 (하이픈·공백 형식 차이 흡수)
  var digits = contact.replace(/[^0-9]/g, '');
  var contactLast4 = digits.slice(-4);

  if (contactLast4 !== last4) {
    // 실패 카운트 누적
    var failCount = Number(cache.get(failKey)) || 0;
    failCount++;

    if (failCount >= AUTH_MAX_ATTEMPTS) {
      // 잠금 설정
      var lockExpiry = Date.now() + AUTH_LOCK_SECONDS * 1000;
      cache.put(lockKey, String(lockExpiry), AUTH_LOCK_SECONDS);
      cache.remove(failKey);
      return {
        success: false,
        error: '입력 횟수(' + AUTH_MAX_ATTEMPTS + '회)를 초과했습니다. ' + Math.ceil(AUTH_LOCK_SECONDS / 60) + '분 후에 다시 시도해 주세요.',
        locked: true,
        lockRemaining: AUTH_LOCK_SECONDS
      };
    }

    // 실패 카운트 저장 (잠금 시간과 동일한 TTL)
    cache.put(failKey, String(failCount), AUTH_LOCK_SECONDS);
    var remaining = AUTH_MAX_ATTEMPTS - failCount;
    return {
      success: false,
      error: '연락처 뒤 4자리가 일치하지 않습니다. (남은 시도: ' + remaining + '회)',
      remaining: remaining
    };
  }

  // ── 성공: 실패 카운트 초기화
  cache.remove(failKey);

  // ── 1회용 토큰 발급
  var token = Utilities.getUuid();
  var tokenData = JSON.stringify({
    courseCode: courseCode,
    created: Date.now()
  });
  cache.put('token_' + token, tokenData, TOKEN_TTL_SECONDS);

  // ── 기존 신청 내역 조회
  var existing = getExistingSubmission_(courseCode);

  return {
    success: true,
    token: token,
    existing: existing,
    teacherContact: contact  // 본인 확인 후이므로 연락처 반환
  };
}

/**
 * 토큰 유효성 검증 후 소비(삭제)합니다.
 * 1회용이므로 검증 성공 시 즉시 삭제됩니다.
 *
 * @param {string} token - 인증 토큰
 * @param {string} courseCode - 요청의 강좌코드 (토큰에 저장된 값과 대조)
 * @returns {boolean} 유효하면 true
 */
function consumeToken(token, courseCode) {
  if (!token) throw new Error('인증 토큰이 없습니다. 본인 확인을 먼저 진행해 주세요.');

  var cache = CacheService.getScriptCache();
  var raw = cache.get('token_' + token);
  if (!raw) {
    throw new Error('인증 토큰이 만료되었거나 유효하지 않습니다. 본인 확인을 다시 진행해 주세요.');
  }

  var data = JSON.parse(raw);
  if (data.courseCode !== courseCode) {
    throw new Error('인증된 강좌와 제출 강좌가 일치하지 않습니다.');
  }

  // 1회용 — 소비 후 삭제
  cache.remove('token_' + token);
  return true;
}

// ────────────────────────────────────────────────────────────
// 내부 헬퍼 함수
// ────────────────────────────────────────────────────────────

/**
 * 강좌목록에서 해당 강좌의 교사 연락처를 반환합니다.
 * 강좌를 찾을 수 없으면 null을 반환합니다.
 * @private
 */
function getTeacherContact_(courseCode) {
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

  var codeIdx = findCol(['강좌코드']);
  var contactIdx = findCol(['교사연락처', '교사 연락처', '연락처']);
  if (codeIdx === -1 || contactIdx === -1) return null;

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][codeIdx] || '').trim() === courseCode) {
      return String(data[r][contactIdx] || '').trim();
    }
  }

  return null;
}

/**
 * 신청내역에서 해당 강좌코드의 기존 제출 데이터를 반환합니다.
 * 없으면 null을 반환합니다.
 * @private
 */
function getExistingSubmission_(courseCode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.신청내역);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.강좌코드 - 1] || '').trim() !== courseCode) continue;

    var row = data[i];
    var existing = {
      courseCode:     String(row[COL.강좌코드 - 1] || ''),
      subjectCode:   String(row[COL.과목코드 - 1] || ''),
      subjectName:   String(row[COL.과목명 - 1] || ''),
      major:         String(row[COL.전공 - 1] || ''),
      teacherName:   String(row[COL.담당교사 - 1] || ''),
      teacherSchool: String(row[COL.소속교 - 1] || ''),
      teacherContact: String(row[COL.연락처 - 1] || ''),
      dayOfWeek:     String(row[COL.수업요일 - 1] || ''),
      students:      Number(row[COL.수강인원 - 1]) || 0,
      wantsExpense:  String(row[COL.운영비희망여부 - 1]).trim() === '희망',
      totalAmount:   Number(row[COL.총소요예산 - 1]) || 0,
      note:          String(row[COL.비고 - 1] || ''),
      items:         []
    };

    // 세부 항목 추출
    for (var j = 0; j < MAX_ITEMS; j++) {
      var baseIdx = COL.항목시작 - 1 + j * 3;
      var cat = String(row[baseIdx] || '').trim();
      var formula = String(row[baseIdx + 1] || '').trim();
      var amount = Number(row[baseIdx + 2]) || 0;
      if (cat || formula || amount) {
        existing.items.push({ category: cat, formula: formula, amount: amount });
      }
    }

    return existing;
  }

  return null;
}
