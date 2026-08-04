// 인쇄용 A4 레이아웃 생성 및 window.print() 호출

var Print = {
  lastPayload: null,
  lastSeq: null,

  /** 제출 완료 후 인쇄 데이터 저장 */
  save: function(payload, seq) {
    this.lastPayload = payload;
    this.lastSeq = seq || '';
  },

  /** 인쇄 영역에 데이터 채우고 window.print() 호출 */
  run: function() {
    if (!this.lastPayload) {
      alert('인쇄할 신청서 데이터가 없습니다.');
      return;
    }
    this.populate_(this.lastPayload, this.lastSeq);

    // document.title → 파일명으로 사용됨
    var p = this.lastPayload;
    var config = App.config || {};
    var semester = config['학기코드'] || '';
    var origTitle = document.title;
    document.title = semester + '_수업운영비신청서_' +
      p.courseCode + '_' + p.teacherName;

    // 약간의 지연 후 인쇄 (브라우저 렌더링 대기)
    setTimeout(function() {
      window.print();
      // 인쇄 대화상자 닫힌 후 제목 복원
      document.title = origTitle;
    }, 200);
  },

  /** @private 인쇄 영역에 데이터 렌더링 */
  populate_: function(p, seq) {
    var config = App.config || {};

    // 헤더
    document.getElementById('psBadge').textContent = config['학기명'] || '';
    document.getElementById('psSchool').textContent =
      (config['거점학교명'] || '') + ' · ' +
      (config['과정명'] || '온라인 공동교육과정');

    // 날짜·접수번호
    var now = new Date();
    var dateStr = now.getFullYear() + '.' +
      String(now.getMonth() + 1).padStart(2, '0') + '.' +
      String(now.getDate()).padStart(2, '0');
    document.getElementById('psDate').textContent = '제출일: ' + dateStr;
    var seqEl = document.getElementById('psSeq');
    if (seq) {
      seqEl.textContent = '접수번호: ' + seq;
      seqEl.style.display = '';
    } else {
      seqEl.style.display = 'none';
    }

    // 강좌 정보
    document.getElementById('ps-courseCode').textContent = p.courseCode || '';
    document.getElementById('ps-subject').textContent = p.subjectName || '';
    document.getElementById('ps-teacher').textContent = p.teacherName || '';
    document.getElementById('ps-school2').textContent = p.teacherSchool || '';
    document.getElementById('ps-major').textContent = p.major || '';
    document.getElementById('ps-day').textContent = p.dayOfWeek || '';
    document.getElementById('ps-students').textContent =
      (p.students || 0) + '명';
    document.getElementById('ps-contact').textContent = p.teacherContact || '';

    // 희망 여부
    var wantsEl = document.getElementById('ps-wants');
    if (p.wantsExpense) {
      wantsEl.textContent = '✔ 희망합니다';
      wantsEl.className = 'ps-wants-yes';
    } else {
      wantsEl.textContent = '✕ 희망하지 않습니다';
      wantsEl.className = 'ps-wants-no';
    }

    // 소요예산 내역
    var expSec = document.getElementById('psExpenseSection');
    var tbody = document.getElementById('psExpenseBody');
    tbody.innerHTML = '';

    if (p.wantsExpense && p.items && p.items.length > 0) {
      expSec.style.display = '';
      p.items.forEach(function(item, i) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="center">' + (i + 1) + '</td>' +
          '<td>' + (item.category || '') + '</td>' +
          '<td>' + (item.formula || '') + '</td>' +
          '<td class="right bold">' +
            (item.amount || 0).toLocaleString('ko-KR') + '</td>';
        tbody.appendChild(tr);
      });
      document.getElementById('psTotalAmount').textContent =
        (p.totalAmount || 0).toLocaleString('ko-KR') + '원';
    } else {
      expSec.style.display = 'none';
    }

    // 비고
    var noteSec = document.getElementById('psNoteSection');
    if (p.note) {
      noteSec.style.display = '';
      document.getElementById('psNoteContent').textContent = p.note;
      // 항목이 있으면 ④, 없으면 ③
      document.getElementById('psNoteTitle').textContent =
        (p.wantsExpense && p.items && p.items.length > 0) ? '④ 비고' : '③ 비고';
    } else {
      noteSec.style.display = 'none';
    }

    // 참고사항 — 수강인원 × 단가 동적 표시
    var unitPrice = config['인당단가'] || 20000;
    var students = p.students || 0;
    var baseBudget = students * unitPrice;
    var extraAmount = (Form.courseData && Form.courseData.extraAmount) || 0;
    var limit = baseBudget + extraAmount;
    var limitDesc = '수강인원 ' + students + '명 × ' + unitPrice.toLocaleString() + '원';
    if (extraAmount > 0) limitDesc += ' + 추가 ' + extraAmount.toLocaleString() + '원';
    document.getElementById('psRefLimit').textContent =
      '운영비는 수업 교사(강사) 소속교로 교부 (' + limitDesc + ' = ' +
      limit.toLocaleString() + '원)';

    // 푸터
    document.getElementById('psFooter').textContent =
      '충청남도교육청 · ' + (config['거점학교명'] || '') + ' · ' +
      (config['학기명'] || '') + ' ' +
      (config['과정명'] || '온라인 공동교육과정') + ' 수업운영비 신청서';
  }
};
