// 신청 폼 렌더링·입력 검증·항목 추가삭제

var Form = {
  courseData: null,
  wantsExpense: null,
  maxAmount: 0,
  unitPrice: 0,

  /** 폼 초기화 — 인증 성공 후 호출 */
  init: function(courseData, existingData, config) {
    this.courseData = courseData;
    this.wantsExpense = null;
    this.unitPrice = config['인당단가'];
    this.extraAmount = courseData.extraAmount || 0;
    this.maxAmount = (courseData.students || 0) * this.unitPrice + this.extraAmount;

    // 강좌 요약 표시
    document.getElementById('courseSummary').innerHTML =
      '<strong>' + courseData.courseCode + '</strong> · ' +
      courseData.subjectName + ' · ' + courseData.teacherName +
      ' (' + courseData.teacherSchool + ') · 수강인원 ' + courseData.students + '명';

    // 한도 라벨
    var limitText = this.maxAmount > 0 ? this.maxAmount.toLocaleString() + '원' : '—';
    if (this.extraAmount > 0) limitText += ' (추가 ' + this.extraAmount.toLocaleString() + '원 포함)';
    document.getElementById('maxAmountLabel').textContent = limitText;
    document.getElementById('alertUnitPrice').textContent =
      this.unitPrice.toLocaleString();

    // 폼 초기화
    document.getElementById('itemList').innerHTML = '';
    document.getElementById('totalDisplay').textContent = '0';
    document.getElementById('totalBar').classList.remove('over');
    document.getElementById('limitAlert').classList.remove('show');
    document.getElementById('noteCard').style.display = 'none';
    document.getElementById('expenseSection').classList.remove('visible');
    document.getElementById('btnYes').className = 'toggle-btn';
    document.getElementById('btnNo').className = 'toggle-btn';
    document.getElementById('err-wants').classList.remove('show');
    document.getElementById('note').value = '';
    document.getElementById('submitBtn').disabled = false;

    // 수정 모드 처리
    if (existingData) {
      App.isEditMode = true;
      document.getElementById('editBanner').style.display = 'block';
      document.getElementById('submitBtnText').textContent = '수정 제출하기';
      this.populateExisting_(existingData);
    } else {
      App.isEditMode = false;
      document.getElementById('editBanner').style.display = 'none';
      document.getElementById('submitBtnText').textContent = '신청서 제출하기';
    }
  },

  /** @private 기존 신청 데이터로 폼 채우기 */
  populateExisting_: function(data) {
    if (data.wantsExpense && data.items && data.items.length > 0) {
      // 먼저 항목을 추가한 뒤 setWants 호출 — setWants 내부의 자동 addItem 방지
      var self = this;
      data.items.forEach(function(item) {
        self.addItem();
        var items = document.querySelectorAll('#itemList .expense-item');
        var last = items[items.length - 1];
        last.querySelector('.item-category').value = item.category || '';
        last.querySelector('.item-formula').value = item.formula || '';
        last.querySelector('.item-amount').value = item.amount || '';
      });
      this.setWants(true);
      this.updateTotal();
    } else {
      this.setWants(data.wantsExpense);
    }
    if (data.note) {
      document.getElementById('note').value = data.note;
    }
  },

  /** 운영비 희망 여부 토글 */
  setWants: function(val) {
    this.wantsExpense = val;
    document.getElementById('err-wants').classList.remove('show');
    document.getElementById('btnYes').className = 'toggle-btn' + (val ? ' active-yes' : '');
    document.getElementById('btnNo').className = 'toggle-btn' + (!val ? ' active-no' : '');

    var sec = document.getElementById('expenseSection');
    var note = document.getElementById('noteCard');

    if (val) {
      sec.classList.add('visible');
      note.style.display = 'block';
      if (document.querySelectorAll('#itemList .expense-item').length === 0) {
        this.addItem();
      }
    } else {
      sec.classList.remove('visible');
      note.style.display = 'block';
      document.getElementById('itemList').innerHTML = '';
      this.updateTotal();
    }
  },

  /** 항목 추가 */
  addItem: function() {
    if (this.maxAmount === 0) { alert('강좌 정보를 확인할 수 없습니다.'); return; }
    var items = document.querySelectorAll('#itemList .expense-item');
    if (items.length >= 10) { alert('항목은 최대 10개까지 추가할 수 있습니다.'); return; }

    var total = this.getCurrentTotal();
    if (total >= this.maxAmount) {
      alert('이미 최대 지원 금액(' + this.maxAmount.toLocaleString() + '원)에 도달하였습니다.\n' +
        '실험실습 재료가 추가로 필요한 경우 충남교육청 중등교육과(041-640-7221,7224)로 문의하세요.');
      return;
    }

    var id = 'item_' + Date.now();
    var num = items.length + 1;
    var div = document.createElement('div');
    div.className = 'expense-item';
    div.id = id;
    div.innerHTML =
      '<div class="expense-item-head">' +
        '<span class="item-num">항목 ' + num + '</span>' +
        '<button type="button" class="btn-remove" onclick="Form.removeItem(\'' + id + '\')">삭제</button>' +
      '</div>' +
      '<div class="expense-grid">' +
        '<div><label>물품명<span style="color:var(--red)">*</span></label>' +
          '<input type="text" placeholder="구체적인 물품명(예: 마이크로비트 보드)" class="item-category"></div>' +
        '<div><label>산출식</label>' +
          '<input type="text" placeholder="예) 마이크로비트 보드 20,000원 × 10명" class="item-formula"></div>' +
        '<div><label>금액 (원) <span style="color:var(--red)">*</span></label>' +
          '<input type="number" placeholder="0" min="0" step="1000" ' +
          'oninput="Form.onAmountInput(this)" class="item-amount" style="text-align:right;"></div>' +
      '</div>';
    document.getElementById('itemList').appendChild(div);
    this.updateTotal();
    div.querySelector('.item-category').focus();
  },

  /** 항목 삭제 */
  removeItem: function(id) {
    var el = document.getElementById(id);
    if (el) { el.remove(); this.renumberItems_(); this.updateTotal(); }
  },

  /** @private 항목 번호 재정렬 */
  renumberItems_: function() {
    document.querySelectorAll('#itemList .expense-item').forEach(function(el, i) {
      el.querySelector('.item-num').textContent = '항목 ' + (i + 1);
    });
  },

  /** 금액 입력 시 한도 제한 */
  onAmountInput: function(el) {
    if (!this.maxAmount) { this.updateTotal(); return; }
    var otherTotal = 0;
    document.querySelectorAll('#itemList .item-amount').forEach(function(inp) {
      if (inp !== el) otherTotal += parseFloat(inp.value) || 0;
    });
    var val = parseFloat(el.value) || 0;
    var allowed = Math.max(0, this.maxAmount - otherTotal);
    if (val > allowed) el.value = allowed;
    this.updateTotal();
  },

  /** 현재 총액 계산 */
  getCurrentTotal: function() {
    var t = 0;
    document.querySelectorAll('#itemList .item-amount').forEach(function(inp) {
      t += parseFloat(inp.value) || 0;
    });
    return t;
  },

  /** 총액 표시 갱신 */
  updateTotal: function() {
    var total = this.getCurrentTotal();
    document.getElementById('totalDisplay').textContent = total.toLocaleString('ko-KR');
    document.getElementById('alertMaxAmount').textContent = this.maxAmount.toLocaleString();

    var bar = document.getElementById('totalBar');
    var alertEl = document.getElementById('limitAlert');
    var btnAdd = document.getElementById('btnAdd');

    if (this.maxAmount > 0 && total > this.maxAmount) {
      bar.classList.add('over');
      alertEl.classList.add('show');
    } else {
      bar.classList.remove('over');
      alertEl.classList.remove('show');
    }

    btnAdd.textContent = (this.maxAmount > 0 && total >= this.maxAmount)
      ? '✕ 최대 금액 도달 (' + this.maxAmount.toLocaleString() + '원) — 추가 불가'
      : '+ 항목 추가';
  },

  /** 항목 데이터 수집 */
  getItems_: function() {
    var items = [];
    document.querySelectorAll('#itemList .expense-item').forEach(function(el) {
      items.push({
        category: el.querySelector('.item-category').value.trim(),
        formula: el.querySelector('.item-formula').value.trim(),
        amount: parseFloat(el.querySelector('.item-amount').value) || 0
      });
    });
    return items;
  },

  /** 유효성 검사 */
  validate: function() {
    var ok = true;
    if (this.wantsExpense === null) {
      document.getElementById('err-wants').classList.add('show');
      ok = false;
    }
    if (this.wantsExpense) {
      var items = this.getItems_();
      if (items.length === 0) { alert('운영비 항목을 1개 이상 입력해 주세요.'); return false; }
      document.querySelectorAll('#itemList .expense-item').forEach(function(el) {
        var cat = el.querySelector('.item-category');
        var amt = el.querySelector('.item-amount');
        if (!cat.value.trim()) { cat.classList.add('error'); ok = false; }
        else cat.classList.remove('error');
        if (!amt.value || parseFloat(amt.value) <= 0) { amt.classList.add('error'); ok = false; }
        else amt.classList.remove('error');
      });
      var total = this.getCurrentTotal();
      if (this.maxAmount > 0 && total > this.maxAmount) {
        alert('총 소요예산(' + total.toLocaleString() + '원)이 최대 지원 금액(' +
          this.maxAmount.toLocaleString() + '원)을 초과하였습니다.');
        return false;
      }
    }
    return ok;
  },

  /** 제출 (확인 → API 호출) */
  submit: function() {
    if (!App.authToken) {
      alert('인증 정보가 없습니다. 본인 확인을 다시 진행해 주세요.');
      App.reset();
      return;
    }
    if (!this.validate()) return;

    var items = this.wantsExpense ? this.getItems_() : [];
    var totalAmount = items.reduce(function(s, i) { return s + i.amount; }, 0);
    var course = this.courseData;

    // 확인 대화상자
    var msg = '신청 내용을 확인해 주세요.\n\n' +
      '강좌: ' + course.courseCode + ' ' + course.subjectName + '\n' +
      '교사: ' + course.teacherName + ' (' + course.teacherSchool + ')\n' +
      '운영비: ' + (this.wantsExpense ? totalAmount.toLocaleString() + '원' : '희망하지 않음') + '\n\n' +
      (App.isEditMode ? '⚠ 기존 신청서를 대체합니다.\n\n' : '') +
      '제출하시겠습니까?';
    if (!confirm(msg)) return;

    var payload = {
      token: App.authToken,
      courseCode: course.courseCode,
      subjectCode: course.subjectCode,
      subjectName: course.subjectName,
      teacherName: course.teacherName,
      teacherSchool: course.teacherSchool,
      teacherContact: App.teacherContact || '',
      major: course.major,
      dayOfWeek: course.dayOfWeek,
      students: course.students,
      wantsExpense: this.wantsExpense,
      items: items,
      totalAmount: totalAmount,
      note: document.getElementById('note').value.trim()
    };

    App.showLoading('제출 중...');
    document.getElementById('submitBtn').disabled = true;

    Api.submit(payload)
      .then(function(res) {
        App.hideLoading();
        if (res.success) {
          App.showResult(res, payload);
        } else {
          alert('제출 실패: ' + (res.error || '알 수 없는 오류'));
          document.getElementById('submitBtn').disabled = false;
        }
      })
      .catch(function(err) {
        App.hideLoading();
        alert('서버 연결에 실패했습니다: ' + err.message);
        document.getElementById('submitBtn').disabled = false;
      });
  }
};
