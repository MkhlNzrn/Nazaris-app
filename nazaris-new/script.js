(function () {
  'use strict';

  // Theme toggle
  var themeToggle = document.getElementById('theme-toggle');
  var html = document.documentElement;
  
  // Load saved theme or default to dark
  var savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      var currentTheme = html.getAttribute('data-theme');
      var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }

  // Mobile menu toggle
  var header = document.querySelector('.header');
  var burger = document.querySelector('.burger');
  if (header && burger) {
    burger.addEventListener('click', function () {
      header.classList.toggle('open');
    });
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        header.classList.remove('open');
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!header.contains(e.target) && header.classList.contains('open')) {
        header.classList.remove('open');
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      var target = document.querySelector(href);
      if (target) {
        var headerHeight = header ? header.offsetHeight : 0;
        var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Services accordion
  var serviceToggles = document.querySelectorAll('.service-toggle');
  serviceToggles.forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      var serviceItem = this.closest('.service-item');
      var isActive = serviceItem.classList.contains('active');
      
      // Close all other items
      document.querySelectorAll('.service-item').forEach(function(item) {
        item.classList.remove('active');
        item.querySelector('.service-toggle').setAttribute('aria-expanded', 'false');
      });
      
      // Toggle current item
      if (!isActive) {
        serviceItem.classList.add('active');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Phone input formatting
  var phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function (e) {
      var v = e.target.value.replace(/\D/g, '');
      if (v.length > 0 && v[0] === '8') v = '7' + v.slice(1);
      if (v.length > 0 && v[0] !== '7') v = '7' + v;
      v = v.slice(0, 11);
      var formatted = '';
      if (v.length > 0) formatted += '+7';
      if (v.length > 1) formatted += ' (' + v.slice(1, 4);
      if (v.length >= 4) formatted += ') ';
      if (v.length > 4) formatted += v.slice(4, 7);
      if (v.length > 7) formatted += '-' + v.slice(7, 9);
      if (v.length > 9) formatted += '-' + v.slice(9, 11);
      e.target.value = formatted;
    });
  }

  // File upload handler
  var fileInput = document.getElementById('file');
  var fileName = document.getElementById('file-name');
  if (fileInput && fileName) {
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        fileName.textContent = file.name;
        fileName.style.display = 'block';
      } else {
        fileName.textContent = '';
        fileName.style.display = 'none';
      }
    });
  }

  // Form submission
  var form = document.getElementById('contact-form');
  var formMessage = document.getElementById('form-message');
  if (!form || !formMessage) return;

  var submitBtn = form.querySelector('.btn-submit');
  
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    formMessage.textContent = '';
    formMessage.className = 'form-message';

    // Get form values
    var name = form.querySelector('input[name="name"]').value.trim();
    var phone = form.querySelector('input[name="phone"]').value.trim();
    var email = form.querySelector('input[name="email"]').value.trim();
    var workType = form.querySelector('select[name="work-type"]').value;
    var budget = form.querySelector('input[name="budget"]').value.trim();
    var message = form.querySelector('textarea[name="message"]').value.trim();
    var file = form.querySelector('input[name="file"]').files[0];

    // Validation
    if (!name) {
      formMessage.textContent = 'Укажите имя.';
      formMessage.classList.add('error');
      form.querySelector('input[name="name"]').focus();
      return;
    }
    
    if (!phone || phone.replace(/\D/g, '').length < 11) {
      formMessage.textContent = 'Укажите корректный номер телефона.';
      formMessage.classList.add('error');
      form.querySelector('input[name="phone"]').focus();
      return;
    }
    
    if (!email || !email.includes('@')) {
      formMessage.textContent = 'Укажите корректный email.';
      formMessage.classList.add('error');
      form.querySelector('input[name="email"]').focus();
      return;
    }
    
    if (!workType) {
      formMessage.textContent = 'Выберите тип работы.';
      formMessage.classList.add('error');
      form.querySelector('select[name="work-type"]').focus();
      return;
    }

    // Prepare form data
    var formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('workType', workType);
    formData.append('budget', budget);
    formData.append('message', message);
    if (file) {
      formData.append('file', file);
    }

    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      var btnText = submitBtn.querySelector('span');
      if (btnText) {
        btnText.textContent = 'Отправка…';
      }
    }

    try {
      // Try to send via API if available
      var res = await fetch('/api/contact', {
        method: 'POST',
        body: formData
      });
      
      var data = await res.json().catch(function () { 
        return { ok: false, error: 'Ошибка обработки ответа сервера' };
      });

      if (res.ok && data.ok) {
        formMessage.textContent = 'Заявка отправлена успешно! Мы свяжемся с вами в ближайшее время.';
        formMessage.classList.add('success');
        form.reset();
        if (fileName) fileName.textContent = '';
        
        // Scroll to message
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        throw new Error(data.error || 'Ошибка отправки');
      }
    } catch (err) {
      // Fallback: send via mailto or show contact info
      console.error('Form submission error:', err);
      
      // Create mailto link with form data
      var subject = encodeURIComponent('Заявка с сайта NAZARIS');
      var body = encodeURIComponent(
        'Имя: ' + name + '\n' +
        'Телефон: ' + phone + '\n' +
        'Email: ' + email + '\n' +
        'Тип работы: ' + (workType || 'Не указан') + '\n' +
        'Бюджет: ' + (budget || 'Не указан') + '\n' +
        'Сообщение: ' + (message || 'Нет дополнительной информации')
      );
      
      formMessage.innerHTML = 'Ошибка отправки через форму. Пожалуйста, свяжитесь с нами напрямую:<br>' +
        '<a href="mailto:nazaris@internet.ru?subject=' + subject + '&body=' + body + '" style="color: #6366f1; text-decoration: underline;">nazaris@internet.ru</a> или ' +
        '<a href="tel:+79811031203" style="color: #6366f1; text-decoration: underline;">+7 981 103-12-03</a>';
      formMessage.classList.add('error');
    }

    // Re-enable submit button
    if (submitBtn) {
      submitBtn.disabled = false;
      var btnText = submitBtn.querySelector('span');
      if (btnText) {
        btnText.textContent = 'Отправить заявку';
      }
    }
  });

  // Header scroll effect
  var lastScroll = 0;
  window.addEventListener('scroll', function() {
    var currentScroll = window.pageYOffset;
    if (header) {
      if (currentScroll > 100) {
        header.style.background = 'rgba(10, 10, 15, 0.95)';
      } else {
        header.style.background = 'rgba(10, 10, 15, 0.8)';
      }
    }
    lastScroll = currentScroll;
  });

  // Intersection Observer for animations
  var observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe service cards and contact items
  document.querySelectorAll('.service-card, .contact-item').forEach(function(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
})();
