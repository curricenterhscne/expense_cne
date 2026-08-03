// doGet / doPost 진입점 및 action별 라우팅

/**
 * GET 요청 처리
 * @param {Object} e - 이벤트 객체 (e.parameter.action 으로 분기)
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';

    switch (action) {
      case 'config':
        return jsonResponse({ success: true, data: getPublicConfig() });

      case 'courses':
        // Phase 2에서 구현
        return jsonResponse({ success: false, error: '강좌 목록 조회는 아직 구현되지 않았습니다.' });

      default:
        return jsonResponse({ success: true, message: '수업운영비 신청 서버 정상 작동 중' });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * POST 요청 처리
 * @param {Object} e - 이벤트 객체 (body의 action 필드로 분기)
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';

    switch (action) {
      case 'verify':
        // Phase 3에서 구현
        return jsonResponse({ success: false, error: '인증 기능은 아직 구현되지 않았습니다.' });

      case 'submit':
        // Phase 4에서 구현
        return jsonResponse({ success: false, error: '제출 기능은 아직 구현되지 않았습니다.' });

      default:
        return jsonResponse({ success: false, error: '알 수 없는 action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * JSON 응답 헬퍼
 * @param {Object} obj - 응답 객체
 * @returns {TextOutput}
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
