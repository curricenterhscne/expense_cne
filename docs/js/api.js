// GAS 백엔드와의 통신
// ⚠ POST 시 Content-Type 헤더를 붙이지 않습니다 (GAS CORS 규칙)

var Api = {

  /**
   * fetch 래퍼 — GAS 콜드스타트 시 HTML을 반환하는 문제에 대응
   * - 응답 텍스트를 직접 JSON.parse 시도, 실패 시 재시도
   * @private
   */
  request_: function(url, options, retries) {
    if (retries === undefined) retries = 2;

    return fetch(url, options)
      .then(function(res) { return res.text(); })
      .then(function(text) {
        try {
          return JSON.parse(text);
        } catch (e) {
          // JSON이 아닌 응답 (HTML 리다이렉트 페이지 등) → 재시도
          if (retries > 0) {
            App.showLoading('서버 연결 재시도 중...');
            return new Promise(function(resolve) {
              setTimeout(resolve, 2000);
            }).then(function() {
              return Api.request_(url, options, retries - 1);
            });
          }
          throw new Error('서버가 응답하지 않습니다. 페이지를 새로고침해 주세요.');
        }
      })
      .catch(function(err) {
        // 네트워크 오류 (오프라인 등) → 재시도
        if (err.message.indexOf('서버가 응답') !== -1) throw err;
        if (retries > 0) {
          App.showLoading('서버 연결 재시도 중...');
          return new Promise(function(resolve) {
            setTimeout(resolve, 2000);
          }).then(function() {
            return Api.request_(url, options, retries - 1);
          });
        }
        throw new Error('서버 연결에 실패했습니다. 인터넷 연결을 확인해 주세요.');
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
