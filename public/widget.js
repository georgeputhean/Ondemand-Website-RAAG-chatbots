(function(){
  const APP_URL = (document.currentScript && document.currentScript.getAttribute('data-app-url')) || window.RAAG_APP_URL || '';
  if (!APP_URL) { console.warn('[RAAG Widget] Missing data-app-url'); return; }
  const button = document.createElement('button');
  button.textContent = 'Chat with us';
  button.style.position = 'fixed';
  button.style.right = '20px';
  button.style.bottom = '20px';
  button.style.padding = '10px 14px';
  button.style.background = '#2563eb';
  button.style.color = '#fff';
  button.style.border = 'none';
  button.style.borderRadius = '9999px';
  button.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)';
  button.style.cursor = 'pointer';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.right = '20px';
  container.style.bottom = '80px';
  container.style.width = '380px';
  container.style.height = '560px';
  container.style.border = '1px solid #e5e7eb';
  container.style.borderRadius = '12px';
  container.style.overflow = 'hidden';
  container.style.display = 'none';
  container.style.background = '#fff';
  container.style.zIndex = '999999';

  const iframe = document.createElement('iframe');
  iframe.src = APP_URL + '/chat';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  container.appendChild(iframe);

  button.addEventListener('click', () => {
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  });

  document.body.appendChild(container);
  document.body.appendChild(button);
})();


