// 강좌 선택 + 연락처 뒷 4자리 인증

var Auth = {
  courses: [],
  selectedCourse: null,

  /** 강좌 목록을 select에 렌더링 */
  renderCourseList: function(courses) {
    this.courses = courses;
    var select = document.getElementById('courseSelect');
    select.innerHTML = '<option value="">— 강좌를 선택하세요 —</option>';

    courses.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.courseCode;
      var label = c.courseCode + '  ' + c.subjectName + ' (' + c.teacherName + ')';
      if (c.submitted) label = '✓ ' + label;
      if (c.unavailable) {
        label += ' [선택불가]';
        opt.disabled = true;
      }
      opt.textContent = label;
      select.appendChild(opt);
    });
  },

  /** 강좌 선택 시 정보 표시 + 인증 섹션 노출 */
  onCourseSelect: function() {
    var val = document.getElementById('courseSelect').value;
    var infoGrid = document.getElementById('courseInfoGrid');
    var authSection = document.getElementById('authSection');

    if (!val) {
      this.selectedCourse = null;
      infoGrid.style.display = 'none';
      authSection.style.display = 'none';
      return;
    }

    var course = this.courses.find(function(c) { return c.courseCode === val; });
    if (!course) return;
    this.selectedCourse = course;

    // 정보 칩 표시
    document.getElementById('chip-subject').textContent = course.subjectName || '—';
    document.getElementById('chip-teacher').textContent = course.teacherName || '—';
    document.getElementById('chip-school').textContent = course.teacherSchool || '—';
    document.getElementById('chip-major').textContent = course.major || '—';
    document.getElementById('chip-day').textContent = course.dayOfWeek || '—';
    document.getElementById('chip-students').textContent = course.students || '—';
    infoGrid.style.display = 'grid';

    // 수강인원 오류 강좌는 선택 불가
    if (course.unavailable) {
      authSection.style.display = 'none';
      alert(course.unavailableReason + '\n담당 장학사에게 문의해 주세요: 041-640-7221');
      return;
    }

    // 인증 입력란 표시
    authSection.style.display = 'block';
    var input = document.getElementById('last4Input');
    input.value = '';
    input.disabled = false;
    input.focus();
    document.getElementById('authError').style.display = 'none';
    document.getElementById('verifyBtn').disabled = false;
    document.getElementById('verifyBtn').textContent = '확인';
  },

  /** 뒷 4자리 확인 */
  onVerify: function() {
    var courseCode = this.selectedCourse ? this.selectedCourse.courseCode : '';
    var last4 = document.getElementById('last4Input').value.trim();

    if (!courseCode) { alert('강좌를 선택해 주세요.'); return; }
    if (!/^\d{4}$/.test(last4)) {
      this.showError_('숫자 4자리를 정확히 입력해 주세요.');
      return;
    }

    var verifyBtn = document.getElementById('verifyBtn');
    verifyBtn.disabled = true;
    verifyBtn.textContent = '확인 중...';

    var self = this;
    Api.verify(courseCode, last4)
      .then(function(res) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '확인';

        if (res.success) {
          // 인증 성공 → 폼 화면으로 이동
          App.authToken = res.token;
          App.teacherContact = res.teacherContact || '';
          Form.init(self.selectedCourse, res.existing, App.config);
          App.showScreen('form');
        } else {
          self.showError_(res.error);
          if (res.locked) {
            document.getElementById('last4Input').disabled = true;
            verifyBtn.disabled = true;
          }
        }
      })
      .catch(function(err) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '확인';
        alert('서버 연결에 실패했습니다: ' + err.message);
      });
  },

  /** @private 인증 오류 메시지 표시 */
  showError_: function(msg) {
    var el = document.getElementById('authError');
    el.textContent = msg;
    el.style.display = 'block';
  }
};
