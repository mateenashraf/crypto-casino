/**
 * Contact form — messages sent to backend only; never stored in the browser.
 */
const ContactForm = (() => {
  const API_PATH = '/api/contact';

  function apiBase() {
    return window.__ND_CFG__?.apiBase || '';
  }

  async function submitToBackend(data) {
    const res = await fetch(`${apiBase()}${API_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        topic: data.topic,
        message: data.message,
        wallet: data.wallet || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Unable to send message');
    }
    return res.json();
  }

  function init() {
    SecureStorage.migrateLegacy();

    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        topic: form.topic.value,
        message: form.message.value.trim(),
        wallet: window.SecureWeb3?.getAddress?.() || '',
      };
      if (!data.name || !data.email || !data.message) {
        window.AppUI?.toast?.('Fill in all required fields', 'error');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      try {
        await submitToBackend(data);
        window.AppUI?.toast?.('Message received. We reply within 24 hours.', 'success');
        form.reset();
      } catch (err) {
        window.AppUI?.toast?.(err.message || 'Could not send message. Try again later.', 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  return { init };
})();

window.ContactForm = ContactForm;
