// GAS 백엔드와의 통신
// ⚠ POST 시 Content-Type 헤더를 붙이지 않습니다 (GAS CORS 규칙)

var Api = {

  /** GET: 설정값 조회 */
  fetchConfig: function() {
    return fetch(CONFIG.GAS_URL + '?action=config')
      .then(function(res) { return res.json(); });
  },

  /** GET: 강좌 목록 조회 */
  fetchCourses: function() {
    return fetch(CONFIG.GAS_URL + '?action=courses')
      .then(function(res) { return res.json(); });
  },

  /** POST: 본인 확인 (뒷 4자리 대조) */
  verify: function(courseCode, last4) {
    return fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'verify', courseCode: courseCode, last4: last4 })
    }).then(function(res) { return res.json(); });
  },

  /** POST: 신청서 제출 */
  submit: function(payload) {
    payload.action = 'submit';
    return fetch(CONFIG.GAS_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(function(res) { return res.json(); });
  }
};
