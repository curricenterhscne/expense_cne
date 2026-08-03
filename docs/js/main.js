// 진입점 — 초기화 및 화면 전환 제어

var App = {
  config: null,
  authToken: null,
  teacherContact: '',
  isEditMode: false,

  /** 앱 초기화 — 설정 로드 → 접수상태 확인 → 강좌 로드 */
  init: function() {
    // 폼 제출 이벤트 연결
    document.getElementById('mainForm').addEventListener('submit', function(e) {
      e.preventDefault();
      Form.submit();
    });

    App.showLoading('설정을 불러오는 중...');

    Api.fetchConfig()
      .then(function(res) {
        if (!res.success) throw new Error(res.error || '설정 로드 실패');
        App.config = res.data;
        App.renderHeader();
        App.renderNotice();

        // 마감 여부 확인
        if (App.config['접수상태'] === '마감') {
          App.hideLoading();
          App.showScreen('closed');
          return;
        }

        return Api.fetchCourses();
      })
      .then(function(res) {
        if (!res) return; // 마감
        App.hideLoading();
        if (!res.success) throw new Error(res.error || '강좌 로드 실패');
        Auth.renderCourseList(res.courses);
        App.showScreen('auth');
      })
      .catch(function(err) {
        App.hideLoading();
        alert('초기화 실패: ' + err.message + '\n\n페이지를 새로고침해 주세요.');
      });
  },

  /** 헤더에 설정값 반영 */
  renderHeader: function() {
    var c = App.config;
    document.getElementById('headerBadge').textContent = c['학기명'] || '';
    document.getElementById('headerTitle').innerHTML =
      (c['과정명'] || '온라인 공동교육과정') + '<br><span>수업운영비 신청서</span>';
    document.getElementById('headerSub').textContent =
      (c['거점학교명'] || '') + ' · 수업 지도교사 전용';
    document.title = '수업운영비 신청서 · ' + (c['학기명'] || '');
  },

  /** 안내문구에 설정값 반영 */
  renderNotice: function() {
    var c = App.config;
    var unitPrice = (c['인당단가'] || 0).toLocaleString();
    document.getElementById('noticeLimit').innerHTML =
      '⚠ <strong>운영비 지원 한도: 수강인원 × ' + unitPrice +
      '원</strong> — 강좌 선택 후 한도가 자동 계산됩니다';
    if (c['안내문구']) {
      var extra = document.getElementById('noticeExtra');
      extra.textContent = c['안내문구'];
      extra.style.display = 'list-item';
    }
  },

  /** 화면 전환 */
  showScreen: function(name) {
    ['Closed', 'Auth', 'Form', 'Result'].forEach(function(s) {
      document.getElementById('screen' + s).style.display = 'none';
    });
    var id = 'screen' + name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById(id).style.display = 'block';
  },

  /** 로딩 오버레이 표시 */
  showLoading: function(msg) {
    document.getElementById('loadingText').textContent = msg || '처리 중...';
    document.getElementById('loadingOverlay').classList.add('show');
  },

  /** 로딩 오버레이 숨김 */
  hideLoading: function() {
    document.getElementById('loadingOverlay').classList.remove('show');
  },

  /** 완료 화면 표시 */
  showResult: function(res, payload) {
    App.showScreen('result');
    document.getElementById('resultIcon').textContent = '✅';
    document.getElementById('resultTitle').textContent =
      App.isEditMode ? '신청서가 수정되었습니다' : '신청이 완료되었습니다';
    document.getElementById('resultSub').innerHTML =
      '<strong>' + payload.teacherName + '</strong> 선생님(' + payload.teacherSchool + ')의<br>' +
      '<strong>' + payload.subjectName + '</strong> 강좌 운영비 신청을 접수하였습니다.<br><br>' +
      '공문으로 신청서를 별도 제출해 주세요.';
    if (res.seq) {
      var seqEl = document.getElementById('resultSeq');
      seqEl.textContent = '접수번호: ' + res.seq;
      seqEl.style.display = 'inline-block';
    }
  },

  /** 처음으로 돌아가기 */
  reset: function() {
    App.authToken = null;
    App.teacherContact = '';
    App.isEditMode = false;
    document.getElementById('courseSelect').value = '';
    document.getElementById('courseInfoGrid').style.display = 'none';
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('resultSeq').style.display = 'none';
    document.getElementById('mainForm').reset();
    document.getElementById('itemList').innerHTML = '';
    document.getElementById('expenseSection').classList.remove('visible');
    document.getElementById('noteCard').style.display = 'none';
    document.getElementById('btnYes').className = 'toggle-btn';
    document.getElementById('btnNo').className = 'toggle-btn';
    document.getElementById('submitBtn').disabled = false;
    App.showScreen('auth');
  }
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', App.init);
