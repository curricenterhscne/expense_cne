// GAS 백엔드와의 통신
// ⚠ POST 시 Content-Type 헤더를 붙이지 않습니다 (GAS CORS 규칙)

var Api = {

  /**
   * fetch 래퍼 — GAS 콜드스타트 시 HTML을 반환하는 문제에 대응
   * - 응답이 JSON이 아니면 자동 재시도 (최대 retries회)
   * @private
   */
  request_: function(url, options, retries) {
    if (retries === undefined) retries = 2;

    return fetch(url, options).then(function(res) {
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1 && ct.indexOf('text/javascript') === -1) {
        // GAS가 HTML(로그인/에러 페이지)을 반환한 경우
        if (retries > 0) {
          return new Promise(function(resolve) {
            setTimeout(resolve, 1000);
          }).then(function() {
            return Api.request_(url, options, retries - 1);
          });
        }
        throw new Error('서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');
      }
      return res.json();
    });
  },

  /** GET: 설정 + 강좌 목록을 한 번에 조회 (네트워크 1회) */
  fetchInit: function() {
    return Api.request_(CONFIG.GAS_URL + '?action=init');
  },

  /** POST: 본인 확인 (뒷 4자리 대조) */
  verify: function(courseCode, last4) {
    return Api.request_(CONFIG.GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'verify', courseCode: courseCode, last4: last4 })
    });
  },

  /** POST: 신청서 제출 */
  submit: function(payload) {
    payload.action = 'submit';
    return Api.request_(CONFIG.GAS_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
