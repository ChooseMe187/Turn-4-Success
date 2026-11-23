(() => {
  'use strict';
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');
  const menuIcon = menuButton?.querySelector('use');
  const closeMenu = () => {nav.classList.remove('is-open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation');menuIcon?.setAttribute('href','#i-menu');};
  menuButton.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open',open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    menuIcon?.setAttribute('href',open?'#i-close':'#i-menu');
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  document.addEventListener('click',e=>{if(!e.target.closest('.nav-wrap'))closeMenu();});
  document.getElementById('year').textContent = String(new Date().getFullYear());
  document.querySelectorAll('[data-service]').forEach(button=>{
    button.addEventListener('click',()=>{
      document.getElementById('service').value=button.dataset.service;
      document.getElementById('contact').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
      setTimeout(()=>document.getElementById('fullName').focus({preventScroll:true}),500);
    });
  });
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries, obs)=>{
    entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');obs.unobserve(entry.target);}});
  },{threshold:.08,rootMargin:'0px 0px -35px 0px'}) : null;
  document.querySelectorAll('[data-reveal]').forEach(el=>observer?observer.observe(el):el.classList.add('revealed'));
  const form = document.getElementById('quote-form');
  const submit = form.querySelector('button[type="submit"]');
  const status = document.getElementById('quote-status');
  let submissionId;
  const resetSubmissionId = () => { submissionId = undefined; };
  form.addEventListener('input', resetSubmissionId);
  form.addEventListener('change', resetSubmissionId);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;
    submissionId ??= crypto.randomUUID();
    submit.disabled = true;
    status.textContent = 'Sending your request…';
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'X-Submission-ID': submissionId },
        body: new FormData(form),
      });
      const result = await response.json();
      status.textContent = result.message;
      if (response.ok) {
        form.reset();
        summary.textContent = 'No photos selected';
        resetSubmissionId();
      }
    } catch {
      status.textContent = 'We could not send your request. Please retry or email us directly.';
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelectorAll('[data-request]').forEach(a=>a.addEventListener('click',()=>{document.getElementById('service').value=a.dataset.request;}));
  const input=document.getElementById('projectPhotos');
  const summary=document.getElementById('photo-summary');
  input.addEventListener('change',()=>{
    const photos=[...input.files];
    if(photos.length>5||photos.some(file=>file.size>3*1024*1024)||photos.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type))){
      input.value=''; summary.textContent='Please choose up to 5 JPEG, PNG or WebP images, each 3 MB or smaller.';return;
    }
    summary.textContent=photos.length?photos.map(file=>file.name).join(' · '):'No photos selected';
  });
  const tasks=[...document.querySelectorAll('input[name="makeReadyChecklist"]')];
  const progress=document.getElementById('check-progress');
  const feedback=document.getElementById('checklist-feedback');
  const getSelected=()=>tasks.filter(t=>t.checked).map(t=>t.value);
  const updateCheck=()=>{progress.textContent=`${getSelected().length} of ${tasks.length} selected`;feedback.textContent='';};
  tasks.forEach(t=>t.addEventListener('change',updateCheck));updateCheck();
  document.getElementById('copy-checklist').addEventListener('click',async()=>{
    const chosen=getSelected(); const result='TURNING 4 SUCCESS — MAKE-READY CHECKLIST\n'+(chosen.length?chosen.map(t=>'- '+t).join('\n'):'No tasks selected');
    try{await navigator.clipboard.writeText(result);feedback.textContent='Checklist copied to clipboard.';}
    catch{feedback.textContent='Clipboard unavailable. Select the tasks and copy manually.';}
  });
})();
