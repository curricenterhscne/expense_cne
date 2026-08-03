// 설정 시트에서 학기명·단가 등 환경값 읽기 — 모든 설정은 여기서만 가져옵니다

/**
 * '설정' 시트의 A열(키) / B열(값)을 객체로 반환합니다.
 * CacheService로 5분간 캐싱하여 반복 호출 시 시트 접근을 줄입니다.
 *
 * @returns {Object} { 학기명, 과정명, 거점학교명, 학기코드, 인당단가, ... }
 */
function getConfig() {
  // 캐시 확인
  var cache = CacheService.getScriptCache();
  var cached = cache.get('appConfig');
  if (cached) {
    return JSON.parse(cached);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.설정);
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: "' + SHEET.설정 + '"');
  }

  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var val = data[i][1];
    if (key) {
      config[key] = (val === null || val === undefined) ? '' : val;
    }
  }

  // 필수 키 검증
  var requiredKeys = [
    '학기명', '과정명', '거점학교명', '학기코드', '인당단가',
    '신청시작일', '신청마감일', '접수상태', '담당자연락처', '보관폴더ID', '안내문구'
  ];
  var missing = [];
  for (var j = 0; j < requiredKeys.length; j++) {
    if (!(requiredKeys[j] in config) || config[requiredKeys[j]] === '') {
      missing.push(requiredKeys[j]);
    }
  }
  if (missing.length > 0) {
    throw new Error('"' + SHEET.설정 + '" 시트에 필수 키가 없습니다: ' + missing.join(', '));
  }

  // 인당단가 숫자 변환
  var unitPrice = Number(config['인당단가']);
  if (isNaN(unitPrice) || unitPrice <= 0) {
    throw new Error('"인당단가" 값이 올바른 숫자가 아닙니다: ' + config['인당단가']);
  }
  config['인당단가'] = unitPrice;

  // 캐시 저장 (5분)
  cache.put('appConfig', JSON.stringify(config), 300);

  return config;
}

/**
 * 클라이언트에 내려보낼 공개 설정만 추려 반환합니다.
 * 담당자연락처, 보관폴더ID 등 내부 정보는 제외합니다.
 */
function getPublicConfig() {
  var c = getConfig();
  return {
    학기명:     c['학기명'],
    과정명:     c['과정명'],
    거점학교명: c['거점학교명'],
    학기코드:   c['학기코드'],
    인당단가:   c['인당단가'],
    신청시작일: c['신청시작일'],
    신청마감일: c['신청마감일'],
    접수상태:   c['접수상태'],
    안내문구:   c['안내문구']
  };
}
